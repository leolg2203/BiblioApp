// Utilidades de fecha en hora local (la de la computadora de la biblioteca).
const pad = (n) => String(n).padStart(2, '0');

function hoy(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function horaActual(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  return hoy(new Date(a, m - 1, d + dias));
}

// Edad cumplida en una fecha dada (RN-02).
function edadEn(fechaNacimiento, fecha) {
  if (!fechaNacimiento) return null;
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [a, m, d] = fecha.split('-').map(Number);
  let edad = a - an;
  if (m < mn || (m === mn && d < dn)) edad -= 1;
  return edad;
}

// "0-12,13-17,60+" -> [{etiqueta, min, max}]
function parsearRangos(texto) {
  return texto.split(',').map((r) => r.trim()).filter(Boolean).map((r) => {
    if (r.endsWith('+')) {
      const min = Number(r.slice(0, -1));
      return { etiqueta: `${min} años o más`, min, max: Infinity };
    }
    const [min, max] = r.split('-').map(Number);
    return { etiqueta: `${min}–${max} años`, min, max };
  });
}

class ErrorApp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

module.exports = { hoy, horaActual, sumarDias, edadEn, parsearRangos, ErrorApp };
