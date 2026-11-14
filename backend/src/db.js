const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'biblioteca.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Datos iniciales: solo se insertan si la tabla está vacía.
function sembrar(tabla, nombres) {
  const { n } = db.prepare(`SELECT COUNT(*) n FROM ${tabla}`).get();
  if (n > 0) return;
  const ins = db.prepare(`INSERT INTO ${tabla} (nombre) VALUES (?)`);
  nombres.forEach((x) => ins.run(x));
}

sembrar('actividad', ['Lectura', 'Tareas', 'Uso de computadora', 'Taller', 'Préstamo de libro', 'Otra']);
sembrar('ocupacion', ['Estudiante', 'Empleado(a)', 'Ama de casa', 'Jubilado(a)', 'Otra']);
sembrar('categoria', ['Literatura', 'Infantil', 'Historia', 'Ciencias', 'Consulta']);

const CONFIG_INICIAL = {
  plazo_dias: '7',               // RN-04
  max_prestamos: '3',            // RN-05
  bloquear_vencidos: '1',        // RN-06
  rangos_edad: '0-12,13-17,18-29,30-59,60+', // RN-03
};
const insConf = db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
Object.entries(CONFIG_INICIAL).forEach(([k, v]) => insConf.run(k, v));

// Usuaria inicial. La contraseña se debe cambiar en Administración al primer ingreso.
if (db.prepare('SELECT COUNT(*) n FROM usuario').get().n === 0) {
  db.prepare('INSERT INTO usuario (nombre, usuario, password_hash) VALUES (?, ?, ?)')
    .run('Encargada', 'encargada', bcrypt.hashSync('biblioteca123', 10));
}

function config() {
  const filas = db.prepare('SELECT clave, valor FROM configuracion').all();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

module.exports = { db, config, DB_PATH };
