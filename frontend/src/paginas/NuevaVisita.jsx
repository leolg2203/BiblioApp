import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fechaCorta } from '../api'
import { Mensaje } from '../componentes'

const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir']
const VACIO = { nombre: '', fecha_nacimiento: '', edad: '', genero: '', ocupacion_id: '', es_frecuente: true }

export default function NuevaVisita() {
  const [catalogos, setCatalogos] = useState({ actividades: [], ocupaciones: [] })
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [elegido, setElegido] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [actividad, setActividad] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [hora, setHora] = useState(new Date())

  useEffect(() => {
    api.get('/catalogos').then(setCatalogos).catch((e) => setError(e.message))
    const t = setInterval(() => setHora(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const t = setTimeout(() => api.get(`/visitantes?q=${encodeURIComponent(busqueda)}`).then(setResultados).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function registrar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    try {
      const cuerpo = { actividad_id: Number(actividad) }
      if (elegido) cuerpo.visitante_id = elegido.id
      else cuerpo.visitante = { ...form, ocupacion_id: form.ocupacion_id ? Number(form.ocupacion_id) : null }
      await api.post('/visitas', cuerpo)
      setExito(`Visita de ${elegido ? elegido.nombre : form.nombre} registrada.`)
      setElegido(null); setForm(VACIO); setActividad(''); setBusqueda(''); setResultados([])
    } catch (err) { setError(err.message) }
  }

  const actividades = catalogos.actividades.filter((a) => a.activo)
  const ocupaciones = catalogos.ocupaciones.filter((o) => o.activo)

  return (
    <>
      <div className="titulo encabezado">
        <div className="titulo">
          <Link to="/" style={{ fontSize: 14, textDecoration: 'none' }}>← Panel de inicio</Link>
          <h1>Nueva visita</h1>
          <p className="sub">La fecha y la hora se registran solas: {hora.toLocaleDateString('es-MX')} · {hora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <form className="fila" onSubmit={registrar}>
        <section className="tarjeta angosta">
          <h2>1. ¿Ya ha venido antes?</h2>
          <div className="campo">
            <label htmlFor="buscar">Buscar por nombre o credencial</label>
            <input id="buscar" type="search" className="input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe al menos 2 letras" />
          </div>
          <div>
            {resultados.map((v) => (
              <div className="resultado" key={v.id}>
                <div className="info">
                  <strong>{v.nombre}</strong>
                  <small>{[v.ocupacion, v.edad != null && `${v.edad} años`, v.ultima_visita && `última visita ${fechaCorta(v.ultima_visita)}`].filter(Boolean).join(' · ')}</small>
                </div>
                <button type="button" className="btn chico" onClick={() => { setElegido(v); setResultados([]); setBusqueda('') }}>Seleccionar</button>
              </div>
            ))}
            {busqueda.trim().length >= 2 && resultados.length === 0 && <p className="nota">No se encontró. Llena sus datos en el formulario.</p>}
          </div>
        </section>
        <section className="tarjeta ancha">
          <h2>2. Datos del visitante</h2>
          {elegido ? (
            <div className="elegido">
              <div className="info" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong>{elegido.nombre}</strong>
                <span style={{ fontSize: 14 }}>{[elegido.ocupacion, elegido.genero, elegido.edad != null && `${elegido.edad} años`].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="acciones" style={{ gap: 8 }}>
                <Link className="btn chico" to={`/visitantes/${elegido.id}`}>Editar datos</Link>
                <button type="button" className="btn chico" onClick={() => setElegido(null)}>Cambiar</button>
              </span>
            </div>
          ) : (
            <div className="rejilla-2">
              <div className="campo completo">
                <label htmlFor="nombre">Nombre completo</label>
                <input id="nombre" className="input" value={form.nombre} onChange={cambiar('nombre')} placeholder="Ej. Juan Pérez García" />
              </div>
              <div className="campo">
                <label htmlFor="nac">Fecha de nacimiento</label>
                <input id="nac" type="date" className="input" value={form.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} />
              </div>
              <div className="campo">
                <label htmlFor="edad">o solo la edad</label>
                <input id="edad" type="number" min="0" max="120" className="input" value={form.edad} onChange={cambiar('edad')} disabled={!!form.fecha_nacimiento} />
              </div>
              <div className="campo">
                <label htmlFor="genero">Género</label>
                <select id="genero" className="input" value={form.genero} onChange={cambiar('genero')}>
                  <option value="">Selecciona…</option>
                  {GENEROS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="ocupacion">Ocupación</label>
                <select id="ocupacion" className="input" value={form.ocupacion_id} onChange={cambiar('ocupacion_id')}>
                  <option value="">Selecciona…</option>
                  {ocupaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <label className="check completo"><input type="checkbox" checked={form.es_frecuente} onChange={cambiar('es_frecuente')} />Guardar como visitante frecuente</label>
            </div>
          )}
          <fieldset>
            <legend>Actividad a realizar</legend>
            <div className="chips">
              {actividades.map((a) => (
                <label key={a.id} className={`chip-opcion${String(actividad) === String(a.id) ? ' sel' : ''}`}>
                  <input type="radio" name="actividad" value={a.id} checked={String(actividad) === String(a.id)} onChange={(e) => setActividad(e.target.value)} />{a.nombre}
                </label>
              ))}
            </div>
          </fieldset>
          <Mensaje>{error}</Mensaje>
          <div className="acciones" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--linea)', paddingTop: 16 }}>
            <Link className="btn" to="/">Cancelar</Link>
            <button className="btn primario">Registrar visita</button>
          </div>
          <p className="nota">Aviso de privacidad: los datos se usan solo para las estadísticas de la biblioteca y no se comparten.</p>
        </section>
      </form>
    </>
  )
}
