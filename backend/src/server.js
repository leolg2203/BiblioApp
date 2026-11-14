const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { requiereSesion } = require('./auth');
const { DB_PATH } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.use('/api/auth', require('./routes/auth'));
// Todo lo demás requiere sesión iniciada (RN-10)
app.use('/api', requiereSesion,
  require('./routes/visitas'),
  require('./routes/inventario'),
  require('./routes/prestamos'),
  require('./routes/reportes'),
  require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// En producción el backend también sirve el frontend compilado (frontend/dist).
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Errores: los de negocio llevan status; los demás se registran y se responde 500.
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'Ese dato ya existe o no es válido (por ejemplo, un ISBN o código repetido).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BiblioApp escuchando en http://localhost:${PORT} (base de datos: ${DB_PATH})`));
}

module.exports = app;
