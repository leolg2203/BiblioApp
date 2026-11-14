import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fechaCorta } from '../api'
import { Mensaje } from '../componentes'

// CU-04 Gestionar visitantes: buscar y abrir para editar
export default function Visitantes() {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => api.get(`/visitantes?limite=50&q=${encodeURIComponent(q)}`).then(setLista).catch((e) => setError(e.message)), 200)
    return () => clearTimeout(t)
  }, [q])

  return (
    <>
      <div className="encabezado">
        <div className="titulo">
          <h1>Visitantes</h1>
          <p className="sub">Busca a una persona para ver o corregir sus datos</p>
        </div>
        <Link className="btn primario" to="/visitas/nueva">+ Nueva visita</Link>
      </div>
      <Mensaje>{error}</Mensaje>
      <section className="tarjeta">
        <div className="campo" style={{ maxWidth: 480 }}>
          <label htmlFor="q">Buscar por nombre o credencial</label>
          <input id="q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. María" />
        </div>
        <div className="tabla-caja">
          <table style={{ minWidth: 720 }}>
            <thead><tr><th>Nombre</th><th>Edad</th><th>Género</th><th>Ocupación</th><th>Última visita</th><th><span className="oculto">Acción</span></th></tr></thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.nombre}</strong>{v.es_frecuente ? <span className="estado ok" style={{ marginLeft: 8 }}>Frecuente</span> : null}</td>
                  <td>{v.edad ?? '—'}</td>
                  <td>{v.genero}</td>
                  <td>{v.ocupacion || '—'}</td>
                  <td style={{ color: 'var(--gris)' }}>{v.ultima_visita ? fechaCorta(v.ultima_visita) : '—'}</td>
                  <td className="der"><Link className="btn chico" to={`/visitantes/${v.id}`}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <p className="nota" style={{ padding: 8 }}>No se encontraron visitantes.</p>}
        </div>
        {lista.length === 50 && <p className="nota">Se muestran los primeros 50; escribe en el buscador para encontrar a alguien más.</p>}
      </section>
    </>
  )
}
