const express = require('express');
const { db, config } = require('../db');
const { hoy, sumarDias, ErrorApp } = require('../util');

const r = express.Router();

function elegibilidad(visitanteId) {
  const c = config();
  const fecha = hoy();
  const activos = db.prepare("SELECT COUNT(*) n FROM prestamo WHERE visitante_id = ? AND estado = 'Activo'").get(visitanteId).n;
  const vencidos = db.prepare("SELECT COUNT(*) n FROM prestamo WHERE visitante_id = ? AND estado = 'Activo' AND fecha_limite < ?").get(visitanteId, fecha).n;
  const maximo = Number(c.max_prestamos);
  let motivo = null;
  if (c.bloquear_vencidos === '1' && vencidos > 0) motivo = 'Tiene un préstamo vencido. Registra la devolución antes de prestar otro libro.';
  else if (activos >= maximo) motivo = `Ya tiene ${activos} préstamos activos, el máximo permitido es ${maximo}.`;
  return { activos, vencidos, maximo, puede: !motivo, motivo, plazo_dias: Number(c.plazo_dias) };
}

r.get('/prestamos/elegibilidad/:visitanteId', (req, res) => res.json(elegibilidad(req.params.visitanteId)));

// Lista de préstamos: ?estado=activos|vencidos|todos, ?q= busca visitante, título o código
r.get('/prestamos', (req, res) => {
  const fecha = hoy();
  const q = `%${String(req.query.q || '').trim()}%`;
  let filtro = '';
  if (req.query.estado === 'activos') filtro = "AND p.estado = 'Activo'";
  if (req.query.estado === 'vencidos') filtro = `AND p.estado = 'Activo' AND p.fecha_limite < '${fecha}'`;
  res.json(db.prepare(`
    SELECT p.*, v.nombre AS visitante, l.titulo, e.codigo_inventario,
      (p.estado = 'Activo' AND p.fecha_limite < ?) AS vencido
    FROM prestamo p JOIN visitante v ON v.id = p.visitante_id
    JOIN ejemplar e ON e.id = p.ejemplar_id JOIN libro l ON l.id = e.libro_id
    WHERE (v.nombre LIKE ? OR l.titulo LIKE ? OR e.codigo_inventario LIKE ?) ${filtro}
    ORDER BY p.estado, p.fecha_limite LIMIT 100`).all(fecha, q, q, q));
});

// CU-07 Registrar préstamo (RN-04 a RN-07)
r.post('/prestamos', (req, res) => {
  const { visitante_id, ejemplar_id } = req.body || {};
  if (!visitante_id || !ejemplar_id) throw new ErrorApp(400, 'Elige el visitante y el ejemplar.');
  const id = db.transaction(() => {
    const el = elegibilidad(visitante_id);
    if (!el.puede) throw new ErrorApp(400, el.motivo);
    const e = db.prepare('SELECT * FROM ejemplar WHERE id = ?').get(ejemplar_id);
    if (!e) throw new ErrorApp(404, 'No se encontró el ejemplar.');
    if (e.estado !== 'Disponible') throw new ErrorApp(400, `El ejemplar ${e.codigo_inventario} no está disponible (${e.estado}).`);
    const fecha = hoy();
    const pid = db.prepare(`INSERT INTO prestamo (ejemplar_id, visitante_id, usuario_id, fecha_prestamo, fecha_limite)
      VALUES (?, ?, ?, ?, ?)`).run(ejemplar_id, visitante_id, req.usuario.id, fecha, sumarDias(fecha, el.plazo_dias)).lastInsertRowid;
    db.prepare("UPDATE ejemplar SET estado = 'Prestado' WHERE id = ?").run(ejemplar_id);
    return pid;
  })();
  res.status(201).json(db.prepare('SELECT * FROM prestamo WHERE id = ?').get(id));
});

// CU-08 Registrar devolución
r.post('/prestamos/:id/devolucion', (req, res) => {
  const { danado, notas } = req.body || {};
  db.transaction(() => {
    const p = db.prepare('SELECT * FROM prestamo WHERE id = ?').get(req.params.id);
    if (!p) throw new ErrorApp(404, 'No se encontró el préstamo.');
    if (p.estado !== 'Activo') throw new ErrorApp(400, 'Este préstamo ya fue devuelto.');
    db.prepare("UPDATE prestamo SET estado = 'Devuelto', fecha_devolucion = ? WHERE id = ?").run(hoy(), p.id);
    db.prepare('UPDATE ejemplar SET estado = ?, notas = COALESCE(?, notas) WHERE id = ?')
      .run(danado ? 'Dañado' : 'Disponible', notas || null, p.ejemplar_id);
  })();
  res.json({ ok: true });
});

module.exports = r;
