import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, fechaCorta, hoyISO } from '../api'
import { EstadoEjemplar, Mensaje } from '../componentes'

function useBusqueda(ruta, texto, minimo = 2) {
  const [res, setRes] = useState([])
  useEffect(() => {
    if (texto.trim().length < minimo) { setRes([]); return }
    const t = setTimeout(() => api.get(`${ruta}${encodeURIComponent(texto)}`).then(setRes).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [ruta, texto, minimo])
  return res
}

// CU-07 Registrar préstamo
function NuevoPrestamo({ alTerminar }) {
  const [qVis, setQVis] = useState('')
  const [visitante, setVisitante] = useState(null)
  const [eleg, setEleg] = useState(null)
  const [qLib, setQLib] = useState('')
  const [ejemplar, setEjemplar] = useState(null)
  const [error, setError] = useState('')
  const visitantes = useBusqueda('/visitantes?q=', visitante ? '' : qVis)
  const ejemplares = useBusqueda('/ejemplares?q=', qLib)

  useEffect(() => {
    if (!visitante) { setEleg(null); return }
    api.get(`/prestamos/elegibilidad/${visitante.id}`).then(setEleg).catch((e) => setError(e.message))
  }, [visitante])

  async function confirmar() {
    setError('')
    try {
      await api.post('/prestamos', { visitante_id: visitante.id, ejemplar_id: ejemplar.id })
      alTerminar(`Préstamo registrado: ${ejemplar.titulo} (${ejemplar.codigo_inventario}) a ${visitante.nombre}.`)
    } catch (e) { setError(e.message) }
  }

  const hoy = hoyISO()
  const limite = eleg ? (() => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + eleg.plazo_dias); return d.toISOString().slice(0, 10) })() : null

  return (
    <div className="fila">
      <div className="ancha pila">
        <section className="tarjeta">
          <h2>1. Visitante</h2>
          {visitante ? (
            <div className="elegido">
              <div className="info" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong>{visitante.nombre}</strong>
                {eleg && <span style={{ fontSize: 14 }}>{eleg.activos} préstamos activos de {eleg.maximo} permitidos · {eleg.vencidos ? `${eleg.vencidos} vencido(s)` : 'sin vencidos'}</span>}
              </div>
              <button className="btn chico" onClick={() => { setVisitante(null); setQVis('') }}>Cambiar</button>
            </div>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="qvis">Buscar visitante por nombre o credencial</label>
                <input id="qvis" type="search" className="input" value={qVis} onChange={(e) => setQVis(e.target.value)} placeholder="Escribe al menos 2 letras" />
              </div>
              <div>
                {visitantes.map((v) => (
                  <div className="resultado" key={v.id}>
                    <div className="info"><strong>{v.nombre}</strong><small>{v.ocupacion}</small></div>
                    <button className="btn chico" onClick={() => setVisitante(v)}>Elegir</button>
                  </div>
                ))}
                {qVis.trim().length >= 2 && visitantes.length === 0 && <p className="nota">No se encontró. Regístralo primero en <Link to="/visitas/nueva">Nueva visita</Link>.</p>}
              </div>
            </>
          )}
        </section>
        <section className="tarjeta">
          <h2>2. Libro</h2>
          <div className="campo">
            <label htmlFor="qlib">Buscar por título, autor, ISBN o código de inventario</label>
            <input id="qlib" type="search" className="input" value={qLib} onChange={(e) => setQLib(e.target.value)} />
          </div>
          {ejemplares.length > 0 && (
            <div className="tabla-caja">
              <table>
                <thead><tr><th>Ejemplar</th><th>Título</th><th>Estado</th><th><span className="oculto">Acción</span></th></tr></thead>
                <tbody>
                  {ejemplares.map((e) => (
                    <tr key={e.id} className={ejemplar?.id === e.id ? 'sel' : ''}>
                      <td><strong>{e.codigo_inventario}</strong></td>
                      <td>{e.titulo}</td>
                      <td><EstadoEjemplar estado={e.estado} /></td>
                      <td className="der">
                        {ejemplar?.id === e.id ? <strong style={{ color: 'var(--verde)', fontSize: 14 }}>✓ Elegido</strong>
                          : e.estado === 'Disponible' ? <button className="btn chico" onClick={() => setEjemplar(e)}>Elegir</button>
                            : <span className="nota">No disponible</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <section className="tarjeta angosta">
        <h2>3. Resumen</h2>
        <dl className="datos">
          <dt>Visitante</dt><dd>{visitante?.nombre || '—'}</dd>
          <dt>Libro</dt><dd>{ejemplar?.titulo || '—'}</dd>
          <dt>Ejemplar</dt><dd>{ejemplar?.codigo_inventario || '—'}</dd>
          <dt>Fecha de préstamo</dt><dd>{fechaCorta(hoy)}</dd>
          <dt>Fecha límite</dt><dd>{limite ? fechaCorta(limite) : '—'}</dd>
        </dl>
        {eleg && <p className="nota">Plazo de {eleg.plazo_dias} días; se cambia en Administración.</p>}
        {eleg && !eleg.puede && <Mensaje tipo="aviso">{eleg.motivo}</Mensaje>}
        <Mensaje>{error}</Mensaje>
        <button className="btn primario grande" disabled={!visitante || !ejemplar || (eleg && !eleg.puede)} onClick={confirmar}>Confirmar préstamo</button>
      </section>
    </div>
  )
}

// CU-08 Registrar devolución
function Devolucion({ preseleccion, alTerminar }) {
  const [q, setQ] = useState('')
  const [prestamo, setPrestamo] = useState(preseleccion || null)
  const [danado, setDanado] = useState(false)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const lista = useBusqueda('/prestamos?estado=activos&q=', q)
  const hoy = hoyISO()

  async function confirmar() {
    setError('')
    try {
      await api.post(`/prestamos/${prestamo.id}/devolucion`, { danado, notas })
      alTerminar(`Devolución registrada: ${prestamo.titulo} (${prestamo.codigo_inventario}).`)
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="fila">
      <section className="tarjeta ancha">
        <h2>1. Buscar el préstamo</h2>
        <div className="campo">
          <label htmlFor="qdev">Visitante, título o código de inventario</label>
          <input id="qdev" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe al menos 2 letras" />
        </div>
        <div className="pila" style={{ gap: 10 }}>
          {lista.map((p) => (
            <div key={p.id} className={`tarjeta-sel${prestamo?.id === p.id ? ' sel' : ''}`}>
              <div className="info" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong>{p.titulo}</strong>
                <span style={{ fontSize: 14, color: 'var(--tinta-2)' }}>{p.visitante} · {p.codigo_inventario} · límite {fechaCorta(p.fecha_limite)}</span>
              </div>
              {prestamo?.id === p.id
                ? <span className={`estado ${p.fecha_limite < hoy ? 'aviso' : 'ok'}`}>{p.fecha_limite < hoy ? 'Vencido' : 'A tiempo'} · ✓ Elegido</span>
                : <button className="btn chico" onClick={() => setPrestamo(p)}>Elegir</button>}
            </div>
          ))}
          {q.trim().length >= 2 && lista.length === 0 && <p className="nota">No hay préstamos activos que coincidan.</p>}
        </div>
      </section>
      <section className="tarjeta angosta">
        <h2>2. Recibir el libro</h2>
        <dl className="datos">
          <dt>Libro</dt><dd>{prestamo?.titulo || '—'}</dd>
          <dt>Visitante</dt><dd>{prestamo?.visitante || '—'}</dd>
          <dt>Ejemplar</dt><dd>{prestamo?.codigo_inventario || '—'}</dd>
          <dt>Fecha de devolución</dt><dd>{fechaCorta(hoy)}</dd>
        </dl>
        <fieldset>
          <legend>¿En qué estado regresa?</legend>
          <div className="pila" style={{ gap: 8 }}>
            <label className={`chip-opcion${!danado ? ' sel' : ''}`} style={{ borderRadius: 8 }}><input type="radio" name="estado" checked={!danado} onChange={() => setDanado(false)} />Buen estado (queda disponible)</label>
            <label className={`chip-opcion${danado ? ' sel' : ''}`} style={{ borderRadius: 8 }}><input type="radio" name="estado" checked={danado} onChange={() => setDanado(true)} />Dañado</label>
          </div>
        </fieldset>
        <div className="campo">
          <label htmlFor="notas">Notas (opcional)</label>
          <textarea id="notas" className="input" placeholder="Ej. portada despegada" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <Mensaje>{error}</Mensaje>
        <button className="btn primario grande" disabled={!prestamo} onClick={confirmar}>Confirmar devolución</button>
      </section>
    </div>
  )
}

function Lista({ estado, alDevolver }) {
  const [lista, setLista] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => api.get(`/prestamos?estado=${estado}&q=${encodeURIComponent(q)}`).then(setLista).catch(() => {}), 200)
    return () => clearTimeout(t)
  }, [estado, q])
  return (
    <section className="tarjeta">
      <div className="campo" style={{ maxWidth: 420 }}>
        <label htmlFor="qlista">Filtrar</label>
        <input id="qlista" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Visitante, título o código" />
      </div>
      <div className="tabla-caja">
        <table style={{ minWidth: 700 }}>
          <thead><tr><th>Visitante</th><th>Libro</th><th>Ejemplar</th><th>Prestado</th><th>Límite</th><th><span className="oculto">Acción</span></th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>{p.visitante}</td>
                <td><strong>{p.titulo}</strong></td>
                <td>{p.codigo_inventario}</td>
                <td>{fechaCorta(p.fecha_prestamo)}</td>
                <td><span className={`estado ${p.vencido ? 'aviso' : 'ok'}`}>{fechaCorta(p.fecha_limite)}</span></td>
                <td className="der"><button className="btn chico" onClick={() => alDevolver(p)}>Recibir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="nota" style={{ padding: 8 }}>No hay préstamos en esta lista.</p>}
      </div>
    </section>
  )
}

const SECCIONES = [['nuevo', 'Nuevo préstamo'], ['devolucion', 'Devolución'], ['activos', 'Activos'], ['vencidos', 'Vencidos']]

export default function Prestamos() {
  const { seccion = 'nuevo' } = useParams()
  const navigate = useNavigate()
  const [exito, setExito] = useState('')
  const [pre, setPre] = useState(null)
  const [clave, setClave] = useState(0) // reinicia el formulario después de guardar

  const terminar = (msg) => { setExito(msg); setPre(null); setClave(clave + 1); window.scrollTo(0, 0) }

  return (
    <>
      <div className="pila">
        <h1>Préstamos</h1>
        <div className="pestanas">
          {SECCIONES.map(([s, t]) => (
            <Link key={s} to={`/prestamos/${s}`} className={seccion === s ? 'active' : ''} onClick={() => setExito('')}>{t}</Link>
          ))}
        </div>
      </div>
      <Mensaje tipo="exito">{exito}</Mensaje>
      {seccion === 'nuevo' && <NuevoPrestamo key={clave} alTerminar={terminar} />}
      {seccion === 'devolucion' && <Devolucion key={`${clave}-${pre?.id}`} preseleccion={pre} alTerminar={terminar} />}
      {(seccion === 'activos' || seccion === 'vencidos') && (
        <Lista estado={seccion} alDevolver={(p) => { setPre(p); setExito(''); navigate('/prestamos/devolucion') }} />
      )}
    </>
  )
}
