const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { firmar, requiereSesion } = require('../auth');
const { ErrorApp } = require('../util');

const r = express.Router();

// CU-01 Iniciar sesión
r.post('/login', (req, res) => {
  const { usuario, password } = req.body || {};
  const u = db.prepare('SELECT * FROM usuario WHERE usuario = ? AND activo = 1').get(String(usuario || '').trim());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    throw new ErrorApp(401, 'Usuario o contraseña incorrectos.');
  }
  res.json({ token: firmar(u), usuario: { id: u.id, nombre: u.nombre, usuario: u.usuario } });
});

// CU-11 Cambiar contraseña
r.post('/password', requiereSesion, (req, res) => {
  const { actual, nueva } = req.body || {};
  const u = db.prepare('SELECT * FROM usuario WHERE id = ?').get(req.usuario.id);
  if (!u || !bcrypt.compareSync(String(actual || ''), u.password_hash)) {
    throw new ErrorApp(400, 'La contraseña actual no es correcta.');
  }
  if (!nueva || String(nueva).length < 8) throw new ErrorApp(400, 'La nueva contraseña debe tener al menos 8 caracteres.');
  db.prepare('UPDATE usuario SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(nueva), 10), u.id);
  res.json({ ok: true });
});

module.exports = r;
