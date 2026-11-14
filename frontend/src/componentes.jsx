import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { guardarSesion, leerSesion } from './api'

export function IconoLibro({ tam = 28 }) {
  return (
    <svg aria-hidden="true" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="#1F6F5C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5z" /><path d="M4 19.5A2 2 0 0 0 6 21h13" /><path d="M8 7h7" />
    </svg>
  )
}

const MENU = [
  ['/', 'Panel de inicio'],
  ['/visitas/nueva', 'Visitantes'],
  ['/inventario', 'Inventario'],
  ['/prestamos', 'Préstamos'],
  ['/reportes', 'Reportes'],
  ['/administracion', 'Administración'],
]

export function Layout() {
  const navigate = useNavigate()
  const sesion = leerSesion()
  const salir = () => { guardarSesion(null); navigate('/login') }
  return (
    <div className="app">
      <nav className="menu" aria-label="Menú principal">
        <div className="logo"><IconoLibro />BiblioApp</div>
        {MENU.map(([ruta, texto]) => (
          <NavLink key={ruta} to={ruta} end={ruta === '/'} className={({ isActive }) => `item${isActive ? ' active' : ''}`}>{texto}</NavLink>
        ))}
        <div className="usuario">
          <strong>{sesion?.usuario?.nombre || 'Encargada'}</strong>
          <a href="#" onClick={(e) => { e.preventDefault(); salir() }} style={{ color: 'var(--gris)' }}>Cerrar sesión</a>
        </div>
      </nav>
      <main className="contenido"><Outlet /></main>
    </div>
  )
}

export function Mensaje({ tipo = 'error', children }) {
  if (!children) return null
  return <div className={`mensaje ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function Barras({ datos }) {
  const max = Math.max(1, ...datos.map((d) => d.total))
  return (
    <div className="barras">
      {datos.map((d) => (
        <div className="barra" key={d.etiqueta}>
          <span className="eti">{d.etiqueta}</span>
          <div className="pista"><div className="relleno" style={{ width: `${(100 * d.total) / max}%` }} /></div>
          <span className="val">{d.total}</span>
        </div>
      ))}
      {datos.length === 0 && <p className="nota">Sin datos en este periodo.</p>}
    </div>
  )
}

export function EstadoEjemplar({ estado, vencido }) {
  const clase = estado === 'Disponible' ? 'ok' : estado === 'Prestado' ? 'aviso' : ''
  return <span className={`estado ${clase}`}>{estado}{vencido ? ' · vencido' : ''}</span>
}
