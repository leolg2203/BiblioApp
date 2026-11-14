const express = require('express');
const { db } = require('../db');
const { hoy, horaActual, edadEn, ErrorApp } = require('../util');

const r = express.Router();
const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir'];

// CU-04 Buscar visitantes (por nombre o credencial)
r.get('/visitantes', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const filas = db.prepare(`
    SELECT v.*, o.nombre AS ocupacion,
           (SELECT MAX(fecha) FROM visita WHERE visitante_id = v.id) AS ultima_visita,
           (SELECT edad FROM visita WHERE visitante_id = v.id ORDER BY fecha DESC, hora_entrada DESC LIMIT 1) AS ultima_edad
    FROM visitante v LEFT JOIN ocupacion o ON o.id = v.ocupacion_id
    WHERE v.nombre LIKE ? OR v.codigo_credencial LIKE ?
    ORDER BY v.es_frecuente DESC, ultima_visita DESC
    LIMIT 15`).all(q, q);
  const fecha = hoy();
  res.json(filas.map((v) => ({ ...v, edad: edadEn(v.fecha_nacimiento, fecha) ?? v.ultima_edad })));
});

function validarVisitante(v) {
  if (!v || !String(v.nombre || '').trim()) throw new ErrorApp(400, 'Escribe el nombre del visitante.');
  if (!GENEROS.includes(v.genero)) throw new ErrorApp(400, 'Elige el género.');
  if (!v.fecha_nacimiento && (v.edad === undefined || v.edad === null || v.edad === '')) {
    throw new ErrorApp(400, 'Captura la fecha de nacimiento o la edad.');
  }
}

function crearVisitante(v) {
  validarVisitante(v);
  const info = db.prepare(`INSERT INTO visitante (nombre, fecha_nacimiento, genero, ocupacion_id, codigo_credencial, es_frecuente)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    String(v.nombre).trim(), v.fecha_nacimiento || null, v.genero, v.ocupacion_id || null,
    v.codigo_credencial ? String(v.codigo_credencial).trim() : null, v.es_frecuente ? 1 : 0);
  return info.lastInsertRowid;
}

r.post('/visitantes', (req, res) => {
  const id = crearVisitante(req.body);
  res.status(201).json(db.prepare('SELECT * FROM visitante WHERE id = ?').get(id));
});

r.put('/visitantes/:id', (req, res) => {
  const v = req.body;
  validarVisitante(v);
  db.prepare(`UPDATE visitante SET nombre=?, fecha_nacimiento=?, genero=?, ocupacion_id=?, codigo_credencial=?, es_frecuente=? WHERE id=?`)
    .run(String(v.nombre).trim(), v.fecha_nacimiento || null, v.genero, v.ocupacion_id || null,
      v.codigo_credencial || null, v.es_frecuente ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM visitante WHERE id = ?').get(req.params.id));
});

// Visitas de un día (por omisión, hoy)
r.get('/visitas', (req, res) => {
  const fecha = req.query.fecha || hoy();
  res.json(db.prepare(`
    SELECT vi.*, v.nombre, a.nombre AS actividad
    FROM visita vi JOIN visitante v ON v.id = vi.visitante_id JOIN actividad a ON a.id = vi.actividad_id
    WHERE vi.fecha = ? ORDER BY vi.hora_entrada DESC`).all(fecha));
});

// CU-02 Registrar visita. Fecha y hora las pone el sistema (RN-01).
r.post('/visitas', (req, res) => {
  const { visitante_id, visitante, actividad_id } = req.body || {};
  if (!actividad_id) throw new ErrorApp(400, 'Elige la actividad a realizar.');
  const fecha = hoy();
  const id = db.transaction(() => {
    const vid = visitante_id || crearVisitante(visitante);
    const v = db.prepare('SELECT * FROM visitante WHERE id = ?').get(vid);
    if (!v) throw new ErrorApp(404, 'No se encontró el visitante.');
    const edad = edadEn(v.fecha_nacimiento, fecha) ?? (visitante && visitante.edad !== '' ? Number(visitante.edad) : null)
      ?? db.prepare('SELECT edad FROM visita WHERE visitante_id = ? ORDER BY id DESC LIMIT 1').get(vid)?.edad ?? null;
    return db.prepare(`INSERT INTO visita (visitante_id, actividad_id, usuario_id, fecha, hora_entrada, edad)
      VALUES (?, ?, ?, ?, ?, ?)`).run(vid, actividad_id, req.usuario.id, fecha, horaActual(), edad).lastInsertRowid;
  })();
  res.status(201).json(db.prepare('SELECT * FROM visita WHERE id = ?').get(id));
});

// CU-03 Registrar salida
r.patch('/visitas/:id/salida', (req, res) => {
  const info = db.prepare('UPDATE visita SET hora_salida = ? WHERE id = ? AND hora_salida IS NULL').run(horaActual(), req.params.id);
  if (!info.changes) throw new ErrorApp(400, 'La visita no existe o ya tiene salida.');
  res.json({ ok: true });
});

// Resumen para el panel de inicio
r.get('/panel', (req, res) => {
  const fecha = hoy();
  const mes = fecha.slice(0, 7);
  res.json({
    fecha,
    visitas_hoy: db.prepare('SELECT COUNT(*) n FROM visita WHERE fecha = ?').get(fecha).n,
    visitas_mes: db.prepare("SELECT COUNT(*) n FROM visita WHERE substr(fecha,1,7) = ?").get(mes).n,
    prestamos_activos: db.prepare("SELECT COUNT(*) n FROM prestamo WHERE estado = 'Activo'").get().n,
    prestamos_vencidos: db.prepare("SELECT COUNT(*) n FROM prestamo WHERE estado = 'Activo' AND fecha_limite < ?").get(fecha).n,
    vencidos: db.prepare(`
      SELECT p.id, p.fecha_limite, v.nombre AS visitante, l.titulo
      FROM prestamo p JOIN visitante v ON v.id = p.visitante_id
      JOIN ejemplar e ON e.id = p.ejemplar_id JOIN libro l ON l.id = e.libro_id
      WHERE p.estado = 'Activo' AND p.fecha_limite < ? ORDER BY p.fecha_limite LIMIT 5`).all(fecha),
  });
});

module.exports = r;
