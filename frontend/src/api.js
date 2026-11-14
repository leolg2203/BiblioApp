// Cliente de la API. Guarda la sesión en localStorage para no pedir la contraseña en cada recarga.
const CLAVE = 'biblioapp.sesion';

export function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}

export function guardarSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch { /* almacenamiento no disponible */ }
}

async function pedir(metodo, ruta, cuerpo) {
  const sesion = leerSesion();
  const res = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  if (res.status === 401 && ruta !== '/auth/login') {
    guardarSesion(null);
    window.location.assign('/login');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
  return datos;
}

export const api = {
  get: (r) => pedir('GET', r),
  post: (r, b = {}) => pedir('POST', r, b),
  put: (r, b = {}) => pedir('PUT', r, b),
  patch: (r, b = {}) => pedir('PATCH', r, b),
  del: (r) => pedir('DELETE', r),
};

// Descarga un archivo (PDF, Excel, respaldo) usando la sesión.
export async function descargar(ruta, nombre) {
  const sesion = leerSesion();
  const res = await fetch(`/api${ruta}`, { headers: { Authorization: `Bearer ${sesion?.token}` } });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'No se pudo descargar el archivo.');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// Fechas: el backend usa YYYY-MM-DD
export function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diasEntre(desdeISO, hastaISO) {
  return Math.round((Date.parse(hastaISO) - Date.parse(desdeISO)) / 86400000);
}
