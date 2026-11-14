// Llena la base con datos de ejemplo para probar o presentar el sistema.
// Uso: npm run demo   (solo funciona si todavía no hay visitantes registrados)
const { db } = require('../src/db');
const { hoy, sumarDias, edadEn } = require('../src/util');

if (db.prepare('SELECT COUNT(*) n FROM visitante').get().n > 0) {
  console.log('La base ya tiene visitantes; no se agregaron datos de ejemplo.');
  process.exit(0);
}

let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const elegir = (xs) => xs[Math.floor(azar() * xs.length)];
const id = (tabla, nombre) => db.prepare(`SELECT id FROM ${tabla} WHERE nombre = ?`).get(nombre).id;

const LIBROS = [
  ['Cien años de soledad', 'Gabriel García Márquez', 'Literatura', 'A-3', 3],
  ['Don Quijote de la Mancha', 'Miguel de Cervantes', 'Literatura', 'A-1', 2],
  ['El principito', 'Antoine de Saint-Exupéry', 'Infantil', 'C-2', 4],
  ['Pedro Páramo', 'Juan Rulfo', 'Literatura', 'A-4', 1],
  ['La Odisea', 'Homero', 'Literatura', 'A-2', 2],
  ['El origen de las especies', 'Charles Darwin', 'Ciencias', 'D-1', 1],
  ['Diccionario escolar de la lengua española', 'Varios autores', 'Consulta', 'E-1', 3],
  ['Cuentos de la selva', 'Horacio Quiroga', 'Infantil', 'C-1', 2],
];
const NOMBRES = ['Ana Sofía Ruiz', 'José Luis Moreno', 'Carmen Valenzuela', 'Diego Armenta', 'Rosa Elena Quiroz',
  'María López Castro', 'Mario Félix Ibarra', 'Marisol Acosta Peña', 'Luis Fernando Soto', 'Valeria Ochoa',
  'Martín Gastélum', 'Daniela Félix', 'Jorge Encinas', 'Paola Durazo', 'Héctor Robles', 'Lucía Bojórquez'];
// Género de cada nombre de NOMBRES, en el mismo orden
const GENEROS = ['Femenino', 'Masculino', 'Femenino', 'Masculino', 'Femenino', 'Femenino', 'Masculino', 'Femenino',
  'Masculino', 'Femenino', 'Masculino', 'Femenino', 'Masculino', 'Femenino', 'Masculino', 'Prefiero no decir'];
const OCUPACIONES = ['Estudiante', 'Estudiante', 'Empleado(a)', 'Ama de casa', 'Jubilado(a)'];
const ACTIVIDADES = ['Lectura', 'Tareas', 'Uso de computadora', 'Taller', 'Préstamo de libro'];

db.transaction(() => {
  let n = 1;
  LIBROS.forEach(([titulo, autor, cat, ubic, copias]) => {
    const lid = db.prepare('INSERT INTO libro (titulo, autor, categoria_id, ubicacion) VALUES (?, ?, ?, ?)')
      .run(titulo, autor, id('categoria', cat), `Estante ${ubic}`).lastInsertRowid;
    for (let i = 0; i < copias; i++) {
      db.prepare('INSERT INTO ejemplar (libro_id, codigo_inventario) VALUES (?, ?)').run(lid, `INV-${String(n++).padStart(4, '0')}`);
    }
  });

  const visitantes = NOMBRES.map((nombre, i) => {
    const anioNac = 1950 + Math.floor(azar() * 66);
    const fnac = `${anioNac}-${String(1 + (i % 12)).padStart(2, '0')}-15`;
    return db.prepare('INSERT INTO visitante (nombre, fecha_nacimiento, genero, ocupacion_id, es_frecuente) VALUES (?, ?, ?, ?, 1)')
      .run(nombre, fnac, GENEROS[i], id('ocupacion', elegir(OCUPACIONES))).lastInsertRowid;
  });

  // Visitas de los últimos 60 días (sin domingos)
  const fin = hoy();
  for (let d = 60; d >= 0; d--) {
    const fecha = sumarDias(fin, -d);
    if (new Date(`${fecha}T12:00:00`).getDay() === 0) continue;
    const cuantas = 3 + Math.floor(azar() * 8);
    for (let k = 0; k < cuantas; k++) {
      const vid = elegir(visitantes);
      const v = db.prepare('SELECT fecha_nacimiento FROM visitante WHERE id = ?').get(vid);
      const h = 9 + Math.floor(azar() * 9);
      const entrada = `${String(h).padStart(2, '0')}:${String(Math.floor(azar() * 60)).padStart(2, '0')}`;
      db.prepare('INSERT INTO visita (visitante_id, actividad_id, usuario_id, fecha, hora_entrada, hora_salida, edad) VALUES (?, ?, 1, ?, ?, ?, ?)')
        .run(vid, id('actividad', elegir(ACTIVIDADES)), fecha, entrada, d === 0 ? null : `${String(h + 1).padStart(2, '0')}:00`, edadEn(v.fecha_nacimiento, fecha));
    }
  }

  // Préstamos: algunos devueltos, algunos activos y dos vencidos
  const prestar = (ejemplarId, visitanteId, dias, devuelto) => {
    const fp = sumarDias(fin, -dias);
    db.prepare('INSERT INTO prestamo (ejemplar_id, visitante_id, usuario_id, fecha_prestamo, fecha_limite, fecha_devolucion, estado) VALUES (?, ?, 1, ?, ?, ?, ?)')
      .run(ejemplarId, visitanteId, fp, sumarDias(fp, 7), devuelto ? sumarDias(fp, 5) : null, devuelto ? 'Devuelto' : 'Activo');
    if (!devuelto) db.prepare("UPDATE ejemplar SET estado = 'Prestado' WHERE id = ?").run(ejemplarId);
  };
  prestar(1, visitantes[0], 30, true);
  prestar(5, visitantes[3], 25, true);
  prestar(2, visitantes[5], 3, false);
  prestar(9, visitantes[9], 12, false);   // vencido
  prestar(4, visitantes[8], 10, false);   // vencido
  db.prepare("UPDATE ejemplar SET estado = 'Dañado', notas = 'Páginas sueltas' WHERE id = 10").run();
})();

console.log('Datos de ejemplo agregados.');
