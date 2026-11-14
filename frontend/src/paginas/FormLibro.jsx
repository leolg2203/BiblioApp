import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Mensaje } from '../componentes'

const VACIO = { titulo: '', autor: '', isbn: '', editorial: '', anio: '', categoria_id: '', ubicacion: '', ejemplares: 1 }

// Alta y edición de libros (CU-05)
export default function FormLibro() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(VACIO)
  const [categorias, setCategorias] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/catalogos').then((c) => setCategorias(c.categorias.filter((x) => x.activo))).catch(() => {})
    if (id) api.get(`/libros/${id}`).then((l) => setForm({ ...VACIO, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v ?? ''])) })).catch((e) => setError(e.message))
  }, [id])

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setError('')
    const cuerpo = { ...form, categoria_id: form.categoria_id ? Number(form.categoria_id) : null }
    try {
      if (id) { await api.put(`/libros/${id}`, cuerpo); navigate(`/inventario/${id}`) }
      else { const r = await api.post('/libros', cuerpo); navigate(`/inventario/${r.id}`) }
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <div className="titulo encabezado">
        <div className="titulo">
          <Link to={id ? `/inventario/${id}` : '/inventario'} style={{ fontSize: 14, textDecoration: 'none' }}>← {id ? 'Ficha del libro' : 'Inventario'}</Link>
          <h1>{id ? 'Editar libro' : 'Nuevo libro'}</h1>
        </div>
      </div>
      <form className="tarjeta" onSubmit={guardar} style={{ maxWidth: 760 }}>
        <div className="rejilla-2">
          <div className="campo completo"><label htmlFor="titulo">Título</label><input id="titulo" className="input" value={form.titulo} onChange={cambiar('titulo')} required /></div>
          <div className="campo completo"><label htmlFor="autor">Autor</label><input id="autor" className="input" value={form.autor} onChange={cambiar('autor')} /></div>
          <div className="campo"><label htmlFor="isbn">ISBN (opcional)</label><input id="isbn" className="input" value={form.isbn} onChange={cambiar('isbn')} /></div>
          <div className="campo"><label htmlFor="editorial">Editorial</label><input id="editorial" className="input" value={form.editorial} onChange={cambiar('editorial')} /></div>
          <div className="campo"><label htmlFor="anio">Año</label><input id="anio" type="number" className="input" value={form.anio} onChange={cambiar('anio')} /></div>
          <div className="campo">
            <label htmlFor="cat">Categoría</label>
            <select id="cat" className="input" value={form.categoria_id} onChange={cambiar('categoria_id')}>
              <option value="">Selecciona…</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="campo"><label htmlFor="ubic">Ubicación</label><input id="ubic" className="input" placeholder="Ej. Estante A-3" value={form.ubicacion} onChange={cambiar('ubicacion')} /></div>
          {!id && <div className="campo"><label htmlFor="ej">Número de ejemplares</label><input id="ej" type="number" min="0" max="50" className="input" value={form.ejemplares} onChange={cambiar('ejemplares')} /></div>}
        </div>
        {!id && <p className="nota">A cada ejemplar se le asigna un código de inventario (INV-0001, INV-0002…) para etiquetarlo.</p>}
        <Mensaje>{error}</Mensaje>
        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
          <Link className="btn" to={id ? `/inventario/${id}` : '/inventario'}>Cancelar</Link>
          <button className="btn primario">Guardar</button>
        </div>
      </form>
    </>
  )
}
