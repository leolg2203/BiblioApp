const express = require('express');
const { db } = require('../db');
const { ErrorApp } = require('../util');

const r = express.Router();
const ESTADOS_MANUALES = ['Disponible', 'Dañado', 'Extraviado', 'Baja'];

function siguienteCodigo() {
  const fila = db.prepare("SELECT codigo_inventario c FROM ejemplar WHERE codigo_inventario LIKE 'INV-%' ORDER BY CAST(substr(codigo_inventario, 5) AS INTEGER) DESC LIMIT 1").get();
  const n = fila ? Number(fila.c.slice(4)) + 1 : 1;
  return `INV-${String(n).padStart(4, '0')}`;
}

// CU-06 Consultar inventario
r.get('/libros', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const params = [q, q, q];
  let filtro = '';
  if (req.query.categoria_id) { filtro += ' AND l.categoria_id = ?'; params.push(req.query.categoria_id); }
  let having = '';
  if (req.query.disponibilidad === 'con') having = 'HAVING disponibles > 0';
  if (req.query.disponibilidad === 'sin') having = 'HAVING disponibles = 0';
  const porPagina = 20;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const base = `
    SELECT l.*, c.nombre AS categoria,
      SUM(CASE WHEN e.estado = 'Disponible' THEN 1 ELSE 0 END) AS disponibles,
      SUM(CASE WHEN e.estado <> 'Baja' THEN 1 ELSE 0 END) AS total
    FROM libro l LEFT JOIN categoria c ON c.id = l.categoria_id LEFT JOIN ejemplar e ON e.libro_id = l.id
    WHERE (l.titulo LIKE ? OR l.autor LIKE ? OR IFNULL(l.isbn,'') LIKE ?) ${filtro}
    GROUP BY l.id ${having}`;
  const total = db.prepare(`SELECT COUNT(*) n FROM (${base})`).get(...params).n;
  const libros = db.prepare(`${base} ORDER BY l.titulo LIMIT ? OFFSET ?`).all(...params, porPagina, (pagina - 1) * porPagina);
  const resumen = db.prepare(`SELECT
      (SELECT COUNT(*) FROM libro) AS titulos,
      SUM(estado <> 'Baja') AS ejemplares,
      SUM(estado = 'Disponible') AS disponibles,
      SUM(estado = 'Prestado') AS prestados,
      SUM(estado IN ('Dañado','Extraviado')) AS danados
    FROM ejemplar`).get();
  res.json({ libros, total, pagina, porPagina, resumen });
});

// Ficha del libro
r.get('/libros/:id', (req, res) => {
  const libro = db.prepare('SELECT l.*, c.nombre AS categoria FROM libro l LEFT JOIN categoria c ON c.id = l.categoria_id WHERE l.id = ?').get(req.params.id);
  if (!libro) throw new ErrorApp(404, 'No se encontró el libro.');
  const ejemplares = db.prepare(`
    SELECT e.*, p.id AS prestamo_id, p.fecha_limite, v.nombre AS visitante
    FROM ejemplar e
    LEFT JOIN prestamo p ON p.ejemplar_id = e.id AND p.estado = 'Activo'
    LEFT JOIN visitante v ON v.id = p.visitante_id
    WHERE e.libro_id = ? ORDER BY e.codigo_inventario`).all(req.params.id);
  const historial = db.prepare(`
    SELECT p.fecha_prestamo, p.fecha_devolucion, p.estado, e.codigo_inventario, v.nombre AS visitante
    FROM prestamo p JOIN ejemplar e ON e.id = p.ejemplar_id JOIN visitante v ON v.id = p.visitante_id
    WHERE e.libro_id = ? ORDER BY p.id DESC LIMIT 10`).all(req.params.id);
  res.json({ ...libro, ejemplares, historial });
});

function datosLibro(b) {
  if (!String(b.titulo || '').trim()) throw new ErrorApp(400, 'El título es obligatorio.');
  return [String(b.titulo).trim(), b.autor || null, b.isbn ? String(b.isbn).trim() : null, b.editorial || null,
    b.anio ? Number(b.anio) : null, b.categoria_id || null, b.ubicacion || null];
}

// CU-05 Gestionar libros y ejemplares
r.post('/libros', (req, res) => {
  const datos = datosLibro(req.body);
  const n = Math.max(0, Math.min(50, Number(req.body.ejemplares ?? 1)));
  const id = db.transaction(() => {
    const libroId = db.prepare('INSERT INTO libro (titulo, autor, isbn, editorial, anio, categoria_id, ubicacion) VALUES (?,?,?,?,?,?,?)')
      .run(...datos).lastInsertRowid;
    for (let i = 0; i < n; i++) {
      db.prepare('INSERT INTO ejemplar (libro_id, codigo_inventario) VALUES (?, ?)').run(libroId, siguienteCodigo());
    }
    return libroId;
  })();
  res.status(201).json({ id });
});

r.put('/libros/:id', (req, res) => {
  const info = db.prepare('UPDATE libro SET titulo=?, autor=?, isbn=?, editorial=?, anio=?, categoria_id=?, ubicacion=? WHERE id=?')
    .run(...datosLibro(req.body), req.params.id);
  if (!info.changes) throw new ErrorApp(404, 'No se encontró el libro.');
  res.json({ ok: true });
});

r.post('/libros/:id/ejemplares', (req, res) => {
  if (!db.prepare('SELECT 1 FROM libro WHERE id = ?').get(req.params.id)) throw new ErrorApp(404, 'No se encontró el libro.');
  const codigo = String(req.body?.codigo_inventario || '').trim() || siguienteCodigo();
  const id = db.prepare('INSERT INTO ejemplar (libro_id, codigo_inventario) VALUES (?, ?)').run(req.params.id, codigo).lastInsertRowid;
  res.status(201).json(db.prepare('SELECT * FROM ejemplar WHERE id = ?').get(id));
});

// Cambiar estado de un ejemplar. "Prestado" solo lo pone el módulo de préstamos (RN-07, RN-08).
r.patch('/ejemplares/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM ejemplar WHERE id = ?').get(req.params.id);
  if (!e) throw new ErrorApp(404, 'No se encontró el ejemplar.');
  if (e.estado === 'Prestado') throw new ErrorApp(400, 'El ejemplar está prestado: registra primero la devolución.');
  const { estado, notas } = req.body || {};
  if (!ESTADOS_MANUALES.includes(estado)) throw new ErrorApp(400, 'Estado no válido.');
  db.prepare('UPDATE ejemplar SET estado = ?, notas = ? WHERE id = ?').run(estado, notas ?? e.notas, e.id);
  res.json(db.prepare('SELECT * FROM ejemplar WHERE id = ?').get(e.id));
});

// Búsqueda de ejemplares para prestar
r.get('/ejemplares', (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  res.json(db.prepare(`
    SELECT e.*, l.titulo, l.autor FROM ejemplar e JOIN libro l ON l.id = e.libro_id
    WHERE (l.titulo LIKE ? OR l.autor LIKE ? OR IFNULL(l.isbn,'') LIKE ? OR e.codigo_inventario LIKE ?) AND e.estado <> 'Baja'
    ORDER BY l.titulo, e.codigo_inventario LIMIT 30`).all(q, q, q, q));
});

module.exports = r;
