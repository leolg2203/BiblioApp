# BiblioApp

Sistema web para la biblioteca comunitaria. Sustituye la libreta y la captura manual en Excel:

- **Visitantes:** registro rápido de visitas. La fecha y la hora se ponen solas, hay búsqueda de visitantes frecuentes y se registra la salida.
- **Inventario:** libros y ejemplares con código de inventario (INV-0001…), estado de cada ejemplar y ficha del libro.
- **Préstamos:** préstamo, devolución, préstamos activos y vencidos. Aplica las reglas de plazo, máximo por visitante y bloqueo por vencidos.
- **Reportes:** reporte mensual por género, rango de edad, actividad, ocupación y día de la semana, exportable a **PDF** y **Excel**.
- **Administración:** reglas de préstamo, catálogos, importación del Excel anterior, cambio de contraseña y respaldo.

## Tecnologías

| Parte | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite + React Router |
| Backend | Node.js + Express 5 |
| Base de datos | SQLite (`better-sqlite3`); un solo archivo en `backend/data/biblioteca.db` |
| Autenticación | JWT + contraseñas cifradas con bcrypt |
| Reportes | `pdfkit` (PDF) y `exceljs` (Excel) |

## Requisitos

- [Node.js](https://nodejs.org) 20 o más reciente (se probó con Node 22).

## Cómo correrlo en desarrollo

```bash
npm run instalar        # instala backend y frontend
npm run demo            # (opcional) llena la base con datos de ejemplo
npm run dev:backend     # API en http://localhost:3000
npm run dev:frontend    # en otra terminal: app en http://localhost:5173
```

Usuario inicial: **`encargada`**, contraseña **`biblioteca123`**. Cámbiala en *Administración → Mi cuenta* al primer ingreso.

## Cómo instalarlo en la computadora de la biblioteca

```bash
npm run instalar
npm run build           # compila el frontend
npm start               # sirve la app completa en http://localhost:3000
```

El backend sirve también el frontend compilado, así que solo hace falta abrir `http://localhost:3000` en el navegador. Para producción conviene definir la variable de entorno `JWT_SECRET` con un valor secreto propio. La base de datos queda en `backend/data/biblioteca.db`. Haz respaldos desde *Administración → Descargar respaldo*.

## Estructura

```
backend/
  src/schema.sql        tablas del modelo entidad-relación
  src/db.js             conexión y datos iniciales (catálogos, configuración, usuaria)
  src/routes/           auth, visitas, inventario, préstamos, reportes, admin
  scripts/datos-demo.js datos de ejemplo
frontend/
  src/paginas/          una pantalla por archivo (según los bocetos)
  src/api.js            cliente de la API
  src/styles.css        estilos
```

## API (resumen)

Todas las rutas, excepto `/api/auth/login`, requieren el encabezado `Authorization: Bearer <token>`.

| Método y ruta | Caso de uso |
| --- | --- |
| `POST /api/auth/login` · `POST /api/auth/password` | CU-01, CU-11 |
| `GET /api/panel` · `GET /api/visitas` · `POST /api/visitas` · `PATCH /api/visitas/:id/salida` | CU-02, CU-03 |
| `GET/POST /api/visitantes` · `PUT /api/visitantes/:id` | CU-04 |
| `GET/POST /api/libros` · `GET/PUT /api/libros/:id` · `POST /api/libros/:id/ejemplares` · `PATCH /api/ejemplares/:id` | CU-05, CU-06 |
| `POST /api/prestamos` · `POST /api/prestamos/:id/devolucion` · `GET /api/prestamos?estado=activos\|vencidos` | CU-07, CU-08, CU-09 |
| `GET /api/reportes/mensual?anio=&mes=` (+ `/pdf`, `/excel`) | CU-10 |
| `GET /api/catalogos` · `POST/DELETE /api/catalogos/:tipo` · `GET/PUT /api/configuracion` | CU-12 |
| `POST /api/admin/importar` · `GET /api/admin/respaldo` | CU-13 |

## Importar el Excel anterior

En *Administración → Importar visitas de Excel*, elige el `.xlsx`. La primera fila debe tener encabezados. Se reconocen **Fecha, Hora, Nombre, Edad, Género/Sexo, Ocupación y Actividad**, y solo Fecha y Nombre son obligatorias. Antes de guardar se muestra una vista previa.
