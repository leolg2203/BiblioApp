import { useEffect, useState } from 'react'
import { api, descargar } from '../api'
import { Barras, Mensaje } from '../componentes'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Por omisión, el mes anterior (el que se entrega a inicio de mes)
function mesAnterior() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

export default function Reporte() {
  const [periodo, setPeriodo] = useState(mesAnterior())
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')
  const qs = `anio=${periodo.anio}&mes=${periodo.mes}`

  useEffect(() => {
    setError('')
    api.get(`/reportes/mensual?${qs}`).then(setRep).catch((e) => setError(e.message))
  }, [qs])

  const opciones = []
  const hoy = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    opciones.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 })
  }

  const exportar = (tipo) => descargar(`/reportes/mensual/${tipo}?${qs}`, `reporte-${periodo.anio}-${String(periodo.mes).padStart(2, '0')}.${tipo === 'excel' ? 'xlsx' : 'pdf'}`).catch((e) => setError(e.message))
  // La comparación solo tiene sentido con un mes ya terminado
  const mesEnCurso = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1
  const cambio = rep && rep.total_mes_anterior && !mesEnCurso ?Math.round(((rep.total_visitas - rep.total_mes_anterior) * 100) / rep.total_mes_anterior) : null
  const mesPrevio = MESES[(periodo.mes + 10) % 12].toLowerCase()

  return (
    <>
      <div className="encabezado">
        <div className="titulo">
          <h1>Reporte mensual</h1>
          <p className="sub">{rep?.titulo}</p>
        </div>
        <div className="acciones" style={{ alignItems: 'flex-end' }}>
          <div className="campo">
            <label htmlFor="mes">Periodo</label>
            <select id="mes" className="input" style={{ minWidth: 180 }} value={`${periodo.anio}-${periodo.mes}`}
              onChange={(e) => { const [a, m] = e.target.value.split('-').map(Number); setPeriodo({ anio: a, mes: m }) }}>
              {opciones.map((o) => <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{MESES[o.mes - 1]} {o.anio}</option>)}
            </select>
          </div>
          <button className="btn" onClick={() => exportar('excel')}>Exportar Excel</button>
          <button className="btn primario" onClick={() => exportar('pdf')}>Exportar PDF</button>
        </div>
      </div>
      <Mensaje>{error}</Mensaje>
      {rep && (
        <>
          <div className="cifras">
            <div className="cifra">
              <span>Total de visitas</span><strong>{rep.total_visitas}</strong>
              {cambio !== null && <span style={{ fontSize: 13, fontWeight: 600, color: cambio >= 0 ? 'var(--verde)' : 'var(--aviso)' }}>{cambio >= 0 ? '+' : ''}{cambio}% vs. {mesPrevio}</span>}
            </div>
            <div className="cifra"><span>Visitantes distintos</span><strong>{rep.visitantes_distintos}</strong></div>
            <div className="cifra"><span>Promedio por día con visitas</span><strong>{rep.promedio_dia}</strong></div>
            <div className="cifra"><span>Préstamos realizados</span><strong>{rep.prestamos}</strong></div>
          </div>
          <div className="rejilla-graficas">
            <section className="tarjeta"><h2>Visitas por género</h2><Barras datos={rep.por_genero} /></section>
            <section className="tarjeta"><h2>Visitas por rango de edad</h2><Barras datos={rep.por_edad} /></section>
            <section className="tarjeta"><h2>Visitas por actividad</h2><Barras datos={rep.por_actividad} /></section>
            <section className="tarjeta"><h2>Visitas por ocupación</h2><Barras datos={rep.por_ocupacion} /></section>
            <section className="tarjeta"><h2>Visitas por día de la semana</h2><Barras datos={rep.por_dia} /></section>
          </div>
        </>
      )}
    </>
  )
}
