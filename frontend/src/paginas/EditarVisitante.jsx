import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, fechaCorta } from '../api'
import { Mensaje } from '../componentes'

const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir']

// CU-04 Modificar los datos de un visitante
export default function EditarVisitante() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [v, setV] = useState(null)
  const [form, setForm] = useState(null)
  const [ocupaciones, setOcupaciones] = useState([])
  const [msg, setMsg] = useState({})

  useEffect(() => {
    api.get('/catalogos').then((c) => setOcupaciones(c.ocupaciones)).catch(() => {})
    api.get(`/visitantes/${id}`).then((d) => {
      setV(d)
      setForm({ nombre: d.nombre, fecha_nacimiento: d.fecha_nacimiento || '', genero: d.genero, ocupacion_id: d.ocupacion_id || '',
        codigo_credencial: d.codigo_credencial || '', es_frecuente: !!d.es_frecuente })
    }).catch((e) => setMsg({ error: e.message }))
  }, [id])

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setMsg({})
    try {
      await api.put(`/visitantes/${id}`, { ...form, ocupacion_id: form.ocupacion_id ? Number(form.ocupacion_id) : null })
      navigate('/visitantes')
    } catch (err) { setMsg({ error: err.message }) }
  }

  if (!form) return <Mensaje>{msg.error}</Mensaje>
  // Muestra las ocupaciones activas y, si la del visitante está desactivada, también esa
  const opciones = ocupaciones.filter((o) => o.activo || o.id === Number(form.ocupacion_id))

  return (
    <>
      <div className="titulo encabezado">
        <div className="titulo">
          <Link to="/visitantes" style={{ fontSize: 14, textDecoration: 'none' }}>← Visitantes</Link>
          <h1>{v.nombre}</h1>
          <p className="sub">{v.total_visitas} visitas registradas · {v.prestamos_activos} préstamos activos</p>
        </div>
      </div>
      <div className="fila">
        <form className="tarjeta ancha" onSubmit={guardar}>
          <h2>Datos del visitante</h2>
          <div className="rejilla-2">
            <div className="campo completo">
              <label htmlFor="nombre">Nombre completo</label>
              <input id="nombre" className="input" value={form.nombre} onChange={cambiar('nombre')} required />
            </div>
            <div className="campo">
              <label htmlFor="nac">Fecha de nacimiento</label>
              <input id="nac" type="date" className="input" value={form.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} />
            </div>
            <div className="campo">
              <label htmlFor="genero">Género</label>
              <select id="genero" className="input" value={form.genero} onChange={cambiar('genero')}>
                {GENEROS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="ocupacion">Ocupación</label>
              <select id="ocupacion" className="input" value={form.ocupacion_id} onChange={cambiar('ocupacion_id')}>
                <option value="">Sin dato</option>
                {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cred">Código de credencial (opcional)</label>
              <input id="cred" className="input" value={form.codigo_credencial} onChange={cambiar('codigo_credencial')} />
            </div>
            <label className="check completo"><input type="checkbox" checked={form.es_frecuente} onChange={cambiar('es_frecuente')} />Visitante frecuente (aparece primero en la búsqueda)</label>
          </div>
          <p className="nota">Los cambios no alteran las visitas que ya están registradas: cada visita conserva la edad que tenía ese día, así los reportes pasados no cambian.</p>
          <Mensaje>{msg.error}</Mensaje>
          <div className="acciones" style={{ justifyContent: 'flex-end' }}>
            <Link className="btn" to="/visitantes">Cancelar</Link>
            <button className="btn primario">Guardar cambios</button>
          </div>
        </form>
        <section className="tarjeta angosta">
          <h2>Últimas visitas</h2>
          {v.visitas.length === 0 && <p className="nota">Sin visitas registradas.</p>}
          {v.visitas.map((x, i) => (
            <div className="resultado" key={i}>
              <span>{x.actividad}</span>
              <span style={{ color: 'var(--gris)' }}>{fechaCorta(x.fecha)} · {x.hora_entrada}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
