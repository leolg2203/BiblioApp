import { useEffect, useState } from 'react'
import { api, descargar, hoyISO } from '../api'
import { Mensaje } from '../componentes'

function Reglas() {
  const [c, setC] = useState(null)
  const [msg, setMsg] = useState({})
  useEffect(() => { api.get('/configuracion').then((x) => setC({ ...x, bloquear_vencidos: x.bloquear_vencidos === '1' })).catch(() => {}) }, [])
  if (!c) return null
  async function guardar(e) {
    e.preventDefault()
    try {
      const x = await api.put('/configuracion', c)
      setC({ ...x, bloquear_vencidos: x.bloquear_vencidos === '1' })
      setMsg({ exito: 'Reglas guardadas.' })
    } catch (err) { setMsg({ error: err.message }) }
  }
  return (
    <form className="tarjeta" onSubmit={guardar}>
      <h2>Reglas de préstamo</h2>
      <div className="rejilla-2">
        <div className="campo"><label htmlFor="plazo">Plazo (días)</label><input id="plazo" type="number" min="1" className="input" value={c.plazo_dias} onChange={(e) => setC({ ...c, plazo_dias: e.target.value })} /></div>
        <div className="campo"><label htmlFor="max">Máximo por visitante</label><input id="max" type="number" min="1" className="input" value={c.max_prestamos} onChange={(e) => setC({ ...c, max_prestamos: e.target.value })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={c.bloquear_vencidos} onChange={(e) => setC({ ...c, bloquear_vencidos: e.target.checked })} />Bloquear préstamos si hay uno vencido</label>
      <div className="campo">
        <label htmlFor="rangos">Rangos de edad para el reporte</label>
        <input id="rangos" className="input" value={c.rangos_edad} onChange={(e) => setC({ ...c, rangos_edad: e.target.value })} />
        <span className="nota">Sepáralos con comas; el último puede ser "60+".</span>
      </div>
      <Mensaje tipo="exito">{msg.exito}</Mensaje><Mensaje>{msg.error}</Mensaje>
      <button className="btn primario" style={{ alignSelf: 'flex-start' }}>Guardar reglas</button>
    </form>
  )
}

const TIPOS = [['actividades', 'Actividades', 'actividad'], ['ocupaciones', 'Ocupaciones', 'ocupación'], ['categorias', 'Categorías de libros', 'categoría']]

function Catalogos() {
  const [datos, setDatos] = useState(null)
  const [tipo, setTipo] = useState('actividades')
  const [nuevo, setNuevo] = useState('')
  const [msg, setMsg] = useState({})
  const cargar = () => api.get('/catalogos').then(setDatos).catch(() => {})
  useEffect(() => { cargar() }, [])

  async function agregar(e) {
    e.preventDefault()
    try { await api.post(`/catalogos/${tipo}`, { nombre: nuevo }); setNuevo(''); setMsg({}); cargar() } catch (err) { setMsg({ error: err.message }) }
  }
  async function quitar(item) {
    try {
      const r = await api.del(`/catalogos/${tipo}/${item.id}`)
      setMsg({ exito: r.desactivado ? `"${item.nombre}" ya se usó, así que se desactivó para conservar el historial.` : `"${item.nombre}" se eliminó.` })
      cargar()
    } catch (err) { setMsg({ error: err.message }) }
  }
  const [, , singular] = TIPOS.find((t) => t[0] === tipo)
  return (
    <section className="tarjeta">
      <h2>Catálogos</h2>
      <div className="pestanas" role="tablist">
        {TIPOS.map(([t, nombre]) => <button key={t} role="tab" aria-selected={tipo === t} className={tipo === t ? 'active' : ''} onClick={() => { setTipo(t); setMsg({}) }}>{nombre}</button>)}
      </div>
      <div className="chips">
        {datos?.[tipo].map((x) => (
          <span key={x.id} className={`etiq${x.activo ? '' : ' inactiva'}`}>
            {x.nombre}{!x.activo && ' (inactiva)'}
            {x.activo
              ? <button aria-label={`Quitar ${x.nombre}`} onClick={() => quitar(x)}>✕</button>
              : <button aria-label={`Reactivar ${x.nombre}`} title="Reactivar" onClick={() => api.post(`/catalogos/${tipo}`, { nombre: x.nombre }).then(cargar)}>↺</button>}
          </span>
        ))}
      </div>
      <form className="acciones" style={{ alignItems: 'flex-end', gap: 8 }} onSubmit={agregar}>
        <div className="campo" style={{ flex: 1, minWidth: 200 }}><label htmlFor="nuevo">Nueva {singular}</label><input id="nuevo" className="input" value={nuevo} onChange={(e) => setNuevo(e.target.value)} /></div>
        <button className="btn">Agregar</button>
      </form>
      <Mensaje tipo="exito">{msg.exito}</Mensaje><Mensaje>{msg.error}</Mensaje>
    </section>
  )
}

function Importar() {
  const [archivo, setArchivo] = useState(null) // { nombre, base64 }
  const [vista, setVista] = useState(null)
  const [msg, setMsg] = useState({})

  async function elegir(e) {
    const f = e.target.files[0]
    if (!f) return
    setMsg({}); setVista(null)
    const base64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(f) })
    setArchivo({ nombre: f.name, base64 })
    try { setVista(await api.post('/admin/importar', { archivo: base64, vistaPrevia: true })) } catch (err) { setMsg({ error: err.message }) }
  }
  async function importar() {
    try {
      const r = await api.post('/admin/importar', { archivo: archivo.base64 })
      setMsg({ exito: `Se importaron ${r.importadas} visitas${r.omitidas ? `; ${r.omitidas} filas se omitieron por falta de datos` : ''}.` })
      setVista(null); setArchivo(null)
    } catch (err) { setMsg({ error: err.message }) }
  }
  return (
    <section className="tarjeta">
      <h2>Importar visitas de Excel</h2>
      <div className="zona-archivo">
        <strong>{archivo ? archivo.nombre : 'Elige el archivo .xlsx con el registro anterior'}</strong>
        <label className="btn">Elegir archivo<input type="file" accept=".xlsx" className="oculto" onChange={elegir} /></label>
      </div>
      <p className="nota">La primera fila debe tener encabezados. Se reconocen: Fecha, Hora, Nombre, Edad, Género (o Sexo), Ocupación y Actividad. Fecha y Nombre son obligatorias.</p>
      {vista && (
        <>
          <p style={{ margin: 0 }}>Columnas encontradas: <strong>{vista.columnas.join(', ')}</strong>. Se importarán <strong>{vista.validas}</strong> de {vista.total} filas.</p>
          <div className="tabla-caja">
            <table>
              <thead><tr><th>Fecha</th><th>Nombre</th><th>Edad</th><th>Género</th><th>Actividad</th></tr></thead>
              <tbody>{vista.muestra.map((f) => <tr key={f.n}><td>{f.fecha}</td><td>{f.nombre}</td><td>{f.edad ?? '—'}</td><td>{f.genero}</td><td>{f.actividad || '—'}</td></tr>)}</tbody>
            </table>
          </div>
          {vista.errores.length > 0 && <Mensaje tipo="aviso">{vista.errores.join(' · ')}</Mensaje>}
          <button className="btn primario" style={{ alignSelf: 'flex-start' }} disabled={!vista.validas} onClick={importar}>Importar {vista.validas} visitas</button>
        </>
      )}
      <Mensaje tipo="exito">{msg.exito}</Mensaje><Mensaje>{msg.error}</Mensaje>
    </section>
  )
}

function Cuenta() {
  const [f, setF] = useState({ actual: '', nueva: '' })
  const [msg, setMsg] = useState({})
  async function cambiar(e) {
    e.preventDefault()
    try { await api.post('/auth/password', f); setF({ actual: '', nueva: '' }); setMsg({ exito: 'Contraseña cambiada.' }) } catch (err) { setMsg({ error: err.message }) }
  }
  return (
    <section className="tarjeta">
      <h2>Mi cuenta</h2>
      <form className="pila" onSubmit={cambiar}>
        <div className="campo"><label htmlFor="actual">Contraseña actual</label><input id="actual" type="password" autoComplete="current-password" className="input" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></div>
        <div className="campo"><label htmlFor="nueva">Nueva contraseña</label><input id="nueva" type="password" autoComplete="new-password" className="input" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} /><span className="nota">Mínimo 8 caracteres.</span></div>
        <Mensaje tipo="exito">{msg.exito}</Mensaje><Mensaje>{msg.error}</Mensaje>
        <button className="btn" style={{ alignSelf: 'flex-start' }}>Cambiar contraseña</button>
      </form>
      <div className="resultado" style={{ borderTop: '1px solid var(--linea)', paddingTop: 16 }}>
        <div className="info"><strong>Respaldo de la base de datos</strong><small>Descarga una copia completa; guárdala en una USB o en la nube.</small></div>
        <button className="btn" onClick={() => descargar('/admin/respaldo', `biblioapp-respaldo-${hoyISO()}.db`).catch((e) => setMsg({ error: e.message }))}>Descargar respaldo</button>
      </div>
    </section>
  )
}

export default function Administracion() {
  return (
    <>
      <div className="titulo encabezado"><div className="titulo"><h1>Administración</h1><p className="sub">Reglas, catálogos, cuenta e importación de datos</p></div></div>
      <div className="rejilla-graficas" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', alignItems: 'start' }}>
        <Reglas />
        <Catalogos />
        <Importar />
        <Cuenta />
      </div>
    </>
  )
}
