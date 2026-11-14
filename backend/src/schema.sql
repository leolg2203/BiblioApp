-- Esquema de BiblioApp (SQLite). Sigue el modelo entidad-relación del documento de diseño.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuario (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  usuario       TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'encargada',
  activo        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ocupacion (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS actividad (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categoria (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS visitante (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT    NOT NULL,
  fecha_nacimiento  TEXT,                       -- YYYY-MM-DD, opcional
  genero            TEXT    NOT NULL CHECK (genero IN ('Femenino','Masculino','Otro','Prefiero no decir')),
  ocupacion_id      INTEGER REFERENCES ocupacion(id),
  codigo_credencial TEXT    UNIQUE,
  es_frecuente      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visita (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  visitante_id INTEGER NOT NULL REFERENCES visitante(id),
  actividad_id INTEGER NOT NULL REFERENCES actividad(id),
  usuario_id   INTEGER REFERENCES usuario(id),
  fecha        TEXT    NOT NULL,                -- YYYY-MM-DD (RN-01)
  hora_entrada TEXT    NOT NULL,                -- HH:MM (RN-01)
  hora_salida  TEXT,
  edad         INTEGER                          -- edad al momento de la visita (RN-02)
);
CREATE INDEX IF NOT EXISTS idx_visita_fecha ON visita(fecha);

CREATE TABLE IF NOT EXISTS libro (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn         TEXT UNIQUE,
  titulo       TEXT NOT NULL,
  autor        TEXT,
  editorial    TEXT,
  anio         INTEGER,
  categoria_id INTEGER REFERENCES categoria(id),
  ubicacion    TEXT
);

CREATE TABLE IF NOT EXISTS ejemplar (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id          INTEGER NOT NULL REFERENCES libro(id),
  codigo_inventario TEXT    NOT NULL UNIQUE,
  estado            TEXT    NOT NULL DEFAULT 'Disponible'
                    CHECK (estado IN ('Disponible','Prestado','Dañado','Extraviado','Baja')),
  notas             TEXT
);

CREATE TABLE IF NOT EXISTS prestamo (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ejemplar_id      INTEGER NOT NULL REFERENCES ejemplar(id),
  visitante_id     INTEGER NOT NULL REFERENCES visitante(id),
  usuario_id       INTEGER REFERENCES usuario(id),
  fecha_prestamo   TEXT    NOT NULL,
  fecha_limite     TEXT    NOT NULL,
  fecha_devolucion TEXT,
  estado           TEXT    NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo','Devuelto'))
);
CREATE INDEX IF NOT EXISTS idx_prestamo_estado ON prestamo(estado);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
