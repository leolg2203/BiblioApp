const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { db, config } = require('../db');
const { hoy, ErrorApp } = require('../util');

const r = express.Router();
// tipo en la URL -> [tabla, tabla y columna que la usan]
const CATALOGOS = {
  actividades: ['actividad', 'visita', 'actividad_id'],
  ocupaciones: ['ocupacion', 'visitante', 'ocupacion_id'],
  categorias: ['categoria', 'libro', 'categoria_id'],
};
function catalogo(tipo) {
  const c = CATALOGOS[tipo];
  if (!c) throw new ErrorApp(404, 'Catálogo no válido.');
  return c;
}

// CU-12 Gestionar catálogos
r.get('/catalogos', (req, res) => {
  const out = {};
  Object.entries(CATALOGOS).forEach(([tipo, [tabla]]) => {
    out[tipo] = db.prepare(`SELECT * FROM ${tabla} ORDER BY activo DESC, nombre`).all();
  });
  res.json(out);
});

r.post('/catalogos/:tipo', (req, res) => {
  const [tabla] = catalogo(req.params.tipo);
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) throw new ErrorApp(400, 'Escribe un nombre.');
  const existe = db.prepare(`SELECT * FROM ${tabla} WHERE lower(nombre) = lower(?)`).get(nombre);
  if (existe) {
    db.prepare(`UPDATE ${tabla} SET activo = 1 WHERE id = ?`).run(existe.id);
    return res.json({ ...existe, activo: 1 });
  }
  const id = db.prepare(`INSERT INTO ${tabla} (nombre) VALUES (?)`).run(nombre).lastInsertRowid;
  res.status(201).json(db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id));
});

// Quitar: si ya se usó, se desactiva para conservar el historial; si no, se borra.
r.delete('/catalogos/:tipo/:id', (req, res) => {
  const [tabla, usada, columna] = catalogo(req.params.tipo);
  const enUso = db.prepare(`SELECT 1 FROM ${usada} WHERE ${columna} = ? LIMIT 1`).get(req.params.id);
  if (enUso) db.prepare(`UPDATE ${tabla} SET activo = 0 WHERE id = ?`).run(req.params.id);
  else db.prepare(`DELETE FROM ${tabla} WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, desactivado: !!enUso });
});

// Reglas de préstamo y rangos de edad
r.get('/configuracion', (req, res) => res.json(config()));

r.put('/configuracion', (req, res) => {
  const b = req.body || {};
  const plazo = Number(b.plazo_dias);
  const max = Number(b.max_prestamos);
  if (!(plazo >= 1 && plazo <= 90)) throw new ErrorApp(400, 'El plazo debe estar entre 1 y 90 días.');
  if (!(max >= 1 && max <= 20)) throw new ErrorApp(400, 'El máximo de préstamos debe estar entre 1 y 20.');
  const rangos = String(b.rangos_edad || '').replace(/[–—]/g, '-').replace(/\s/g, '');
  if (!/^(\d+-\d+,)*(\d+-\d+|\d+\+)$/.test(rangos)) throw new ErrorApp(400, 'Escribe los rangos como 0-12,13-17,60+');
  const up = db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?');
  db.transaction(() => {
    up.run(String(plazo), 'plazo_dias');
    up.run(String(max), 'max_prestamos');
    up.run(b.bloquear_vencidos ? '1' : '0', 'bloquear_vencidos');
    up.run(rangos, 'rangos_edad');
  })();
  res.json(config());
});

// Respaldo: descarga una copia completa de la base de datos
r.get('/admin/respaldo', async (req, res) => {
  const destino = path.join(os.tmpdir(), `biblioapp-respaldo-${Date.now()}.db`);
  await db.backup(destino);
  res.download(destino, `biblioapp-respaldo-${hoy()}.db`, () => fs.unlink(destino, () => {}));
});

// CU-13 Importar visitas históricas desde Excel
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const ALIAS = {
  fecha: ['fecha', 'dia'], hora: ['hora', 'hora de entrada', 'entrada'], nombre: ['nombre', 'nombre completo'],
  edad: ['edad'], genero: ['genero', 'sexo'], ocupacion: ['ocupacion'], actividad: ['actividad', 'actividad a realizar'],
};

function valorTexto(v) {
  if (v && typeof v === 'object') return v.text ?? v.result ?? (v.richText ? v.richText.map((t) => t.text).join('') : '');
  return v;
}

function fechaISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(valorTexto(v) || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // dd/mm/aaaa
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function horaTexto(v) {
  if (v instanceof Date) return v.toISOString().slice(11, 16);
  const m = String(valorTexto(v) || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00';
}

function genero(v) {
  const s = norm(valorTexto(v));
  if (['f', 'femenino', 'mujer'].includes(s)) return 'Femenino';
  if (['m', 'masculino', 'hombre'].includes(s)) return 'Masculino';
  if (s.startsWith('prefiero')) return 'Prefiero no decir';
  return s ? 'Otro' : 'Prefiero no decir';
}

function idCatalogo(tabla, nombre) {
  const n = String(valorTexto(nombre) || '').trim() || 'Otra';
  const f = db.prepare(`SELECT id FROM ${tabla} WHERE lower(nombre) = lower(?)`).get(n);
  return f ? f.id : db.prepare(`INSERT INTO ${tabla} (nombre) VALUES (?)`).run(n).lastInsertRowid;
}

r.post('/admin/importar', async (req, res) => {
  const { archivo, vistaPrevia } = req.body || {};
  if (!archivo) throw new ErrorApp(400, 'Elige un archivo .xlsx.');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(Buffer.from(archivo, 'base64')); } catch { throw new ErrorApp(400, 'No se pudo leer el archivo. Debe ser .xlsx.'); }
  const hoja = wb.worksheets[0];
  if (!hoja) throw new ErrorApp(400, 'El archivo no tiene hojas.');

  const columnas = {};
  hoja.getRow(1).eachCell((celda, col) => {
    const h = norm(valorTexto(celda.value));
    Object.entries(ALIAS).forEach(([campo, alias]) => { if (alias.includes(h) && !columnas[campo]) columnas[campo] = col; });
  });
  const faltan = ['fecha', 'nombre'].filter((c) => !columnas[c]);
  if (faltan.length) throw new ErrorApp(400, `No encontré las columnas: ${faltan.join(', ')}. La primera fila debe tener los encabezados.`);

  const filas = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return;
    const celda = (c) => (columnas[c] ? fila.getCell(columnas[c]).value : null);
    filas.push({ n, fecha: fechaISO(celda('fecha')), hora: horaTexto(celda('hora')), nombre: String(valorTexto(celda('nombre')) || '').trim(),
      edad: Number(valorTexto(celda('edad'))) || null, genero: genero(celda('genero')),
      ocupacion: valorTexto(celda('ocupacion')), actividad: valorTexto(celda('actividad')) });
  });
  const validas = filas.filter((f) => f.fecha && f.nombre);
  const errores = filas.filter((f) => !(f.fecha && f.nombre)).slice(0, 10).map((f) => `Fila ${f.n}: falta la fecha o el nombre`);

  if (vistaPrevia) {
    return res.json({ columnas: Object.keys(columnas), total: filas.length, validas: validas.length, muestra: validas.slice(0, 5), errores });
  }
  db.transaction(() => {
    const buscar = db.prepare('SELECT id FROM visitante WHERE lower(nombre) = lower(?) LIMIT 1');
    const insV = db.prepare('INSERT INTO visitante (nombre, genero, ocupacion_id) VALUES (?, ?, ?)');
    const insVi = db.prepare('INSERT INTO visita (visitante_id, actividad_id, usuario_id, fecha, hora_entrada, edad) VALUES (?, ?, ?, ?, ?, ?)');
    validas.forEach((f) => {
      const vid = buscar.get(f.nombre)?.id ?? insV.run(f.nombre, f.genero, idCatalogo('ocupacion', f.ocupacion)).lastInsertRowid;
      insVi.run(vid, idCatalogo('actividad', f.actividad), req.usuario.id, f.fecha, f.hora, f.edad);
    });
  })();
  res.json({ importadas: validas.length, omitidas: filas.length - validas.length, errores });
});

module.exports = r;
