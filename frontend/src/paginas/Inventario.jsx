import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Mensaje } from '../componentes'

export default function Inventario() {
  const [datos, setDatos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [filtros, setFiltros] = useState({ q: '', categoria_id: '', disponibilidad: '' })
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/catalogos').then((c) => setCategorias(c.categorias)).catch(() => {}) }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ ...filtros, pagina }).toString()
      api.get(`/libros?${qs}`).then(setDatos).catch((e) => setError(e.message))
    }, 200)
    return () => clearTimeout(t)
  }, [filtros, pagina])

  const filtrar = (campo) => (e) => { setPagina(1); setFiltros({ ...filtros, [campo]: e.target.value }) }
  const r = datos?.resumen
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1

  return (
    <>
      <div className="encabezado">
        <div className="titulo">
          <h1>Inventario</h1>
          {r && <p className="sub">{r.titulos} títulos · {r.ejemplares ?? 0} ejemplares</p>}
        </div>
        <Link className="btn primario" to="/inventario/nuevo">+ Nuevo libro</Link>
      </div>
      {r && (
        <div className="chips">
          <span className="estado ok" style={{ padding: '8px 14px' }}>{r.disponibles ?? 0} disponibles</span>
          <span className="estado aviso" style={{ padding: '8px 14px' }}>{r.prestados ?? 0} prestados</span>
          <span className="estado" style={{ padding: '8px 14px' }}>{r.danados ?? 0} dañados o extraviados</span>
        </div>
      )}
      <Mensaje>{error}</Mensaje>
      <section className="tarjeta">
        <div className="fila" style={{ alignItems: 'flex-end' }}>
          <div className="campo" style={{ flex: '3 1 260px' }}>
            <label htmlFor="q">Buscar</label>
            <input id="q" type="search" className="input" placeholder="Título, autor o ISBN" value={filtros.q} onChange={filtrar('q')} />
          </div>
          <div className="campo" style={{ flex: '1 1 180px' }}>
            <label htmlFor="cat">Categoría</label>
            <select id="cat" className="input" value={filtros.categoria_id} onChange={filtrar('categoria_id')}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="campo" style={{ flex: '1 1 180px' }}>
            <label htmlFor="disp">Disponibilidad</label>
            <select id="disp" className="input" value={filtros.disponibilidad} onChange={filtrar('disponibilidad')}>
              <option value="">Todos</option>
              <option value="con">Con ejemplares disponibles</option>
              <option value="sin">Sin ejemplares disponibles</option>
            </select>
          </div>
        </div>
        <div className="tabla-caja">
          <table style={{ minWidth: 720 }}>
            <thead><tr><th>Título</th><th>Autor</th><th>Categoría</th><th>Ubicación</th><th>Disponibles</th><th><span className="oculto">Acción</span></th></tr></thead>
            <tbody>
              {datos?.libros.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.titulo}</strong></td>
                  <td>{l.autor}</td>
                  <td>{l.categoria}</td>
                  <td style={{ color: 'var(--gris)' }}>{l.ubicacion}</td>
                  <td><strong style={{ color: l.disponibles ? 'var(--verde)' : 'var(--aviso)' }}>{l.disponibles ?? 0}</strong> de {l.total ?? 0}</td>
                  <td className="der"><Link to={`/inventario/${l.id}`} style={{ fontSize: 14 }}>Ver ficha</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos?.libros.length === 0 && <p className="nota" style={{ padding: 8 }}>No hay libros que coincidan.</p>}
        </div>
        {datos && (
          <div className="encabezado" style={{ alignItems: 'center', fontSize: 14, color: 'var(--gris)' }}>
            <span>Mostrando {datos.libros.length} de {datos.total} títulos · página {pagina} de {paginas}</span>
            <div className="acciones">
              <button className="btn chico" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <button className="btn chico" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
