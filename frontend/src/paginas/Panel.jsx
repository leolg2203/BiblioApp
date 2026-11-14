import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, diasEntre } from '../api'
import { Mensaje } from '../componentes'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  const d = new Date(`${iso}T12:00:00`)
  const texto = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
  return texto[0].toUpperCase() + texto.slice(1)
}

export default function Panel() {
  const [panel, setPanel] = useState(null)
  const [visitas, setVisitas] = useState([])
  const [error, setError] = useState('')

  async function cargar() {
    try {
      const [p, v] = await Promise.all([api.get('/panel'), api.get('/visitas')])
      setPanel(p)
      setVisitas(v)
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { cargar() }, [])

  async function salida(id) {
    try { await api.patch(`/visitas/${id}/salida`); cargar() } catch (e) { setError(e.message) }
  }

  return (
    <>
      <div className="encabezado">
        <div className="titulo">
          <h1>Panel de inicio</h1>
          {panel && <p className="sub">{fechaLarga(panel.fecha)}</p>}
        </div>
        <div className="acciones">
          <Link className="btn" to="/prestamos">Nuevo préstamo</Link>
          <Link className="btn primario" to="/visitas/nueva">+ Nueva visita</Link>
        </div>
      </div>
      <Mensaje>{error}</Mensaje>
      {panel && (
        <div className="cifras">
          <div className="cifra"><span>Visitas de hoy</span><strong>{panel.visitas_hoy}</strong></div>
          <div className="cifra"><span>Visitas en el mes</span><strong>{panel.visitas_mes}</strong></div>
          <div className="cifra"><span>Préstamos activos</span><strong>{panel.prestamos_activos}</strong></div>
          <div className={`cifra${panel.prestamos_vencidos ? ' alerta' : ''}`}><span>Préstamos vencidos</span><strong>{panel.prestamos_vencidos}</strong></div>
        </div>
      )}
      <div className="fila">
        <section className="tarjeta ancha">
          <h2>Visitantes en la biblioteca hoy</h2>
          {visitas.length === 0 ? <p className="nota">Todavía no hay visitas registradas hoy.</p> : (
            <div className="tabla-caja">
              <table>
                <thead><tr><th>Entrada</th><th>Nombre</th><th>Actividad</th><th className="der">Salida</th></tr></thead>
                <tbody>
                  {visitas.map((v) => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--gris)' }}>{v.hora_entrada}</td>
                      <td>{v.nombre}</td>
                      <td>{v.actividad}</td>
                      <td className="der">{v.hora_salida
                        ? <span style={{ color: 'var(--gris)' }}>{v.hora_salida}</span>
                        : <button className="btn chico" onClick={() => salida(v.id)}>Registrar salida</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="tarjeta angosta">
          <div className="encabezado" style={{ alignItems: 'center' }}>
            <h2>Préstamos vencidos</h2>
            <Link to="/prestamos/vencidos" style={{ fontSize: 14 }}>Ver todos</Link>
          </div>
          {panel?.vencidos.length === 0 && <p className="nota">No hay préstamos vencidos.</p>}
          {panel?.vencidos.map((p) => (
            <div className="resultado" key={p.id}>
              <div className="info">
                <strong>{p.titulo}</strong>
                <small>{p.visitante} · venció hace {diasEntre(p.fecha_limite, panel.fecha)} día(s)</small>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
