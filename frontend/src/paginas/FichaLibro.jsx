import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fechaCorta, hoyISO } from '../api'
import { EstadoEjemplar, Mensaje } from '../componentes'

const ESTADOS = ['Disponible', 'Dañado', 'Extraviado', 'Baja']

export default function FichaLibro() {
  const { id } = useParams()
  const [libro, setLibro] = useState(null)
  const [editando, setEditando] = useState(null) // { id, estado, notas }
  const [error, setError] = useState('')

  const cargar = () => api.get(`/libros/${id}`).then(setLibro).catch((e) => setError(e.message))
  useEffect(() => { cargar() }, [id])

  async function agregarEjemplar() {
    try { await api.post(`/libros/${id}/ejemplares`); cargar() } catch (e) { setError(e.message) }
  }

  async function guardarEstado() {
    try {
      await api.patch(`/ejemplares/${editando.id}`, { estado: editando.estado, notas: editando.notas })
      setEditando(null)
      cargar()
    } catch (e) { setError(e.message) }
  }

  if (!libro) return <Mensaje>{error}</Mensaje>
  const hoy = hoyISO()
  const disponibles = libro.ejemplares.filter((e) => e.estado === 'Disponible').length
  const total = libro.ejemplares.filter((e) => e.estado !== 'Baja').length

  return (
    <>
      <div className="encabezado">
        <div className="titulo">
          <Link to="/inventario" style={{ fontSize: 14, textDecoration: 'none' }}>← Inventario</Link>
          <h1>{libro.titulo}</h1>
          <p className="sub">{libro.autor} · {disponibles} de {total} ejemplares disponibles</p>
        </div>
        <div className="acciones">
          <Link className="btn" to={`/inventario/${id}/editar`}>Editar datos</Link>
          <button className="btn primario" onClick={agregarEjemplar}>+ Agregar ejemplar</button>
        </div>
      </div>
      <Mensaje>{error}</Mensaje>
      <div className="fila">
        <section className="tarjeta angosta">
          <h2>Datos del libro</h2>
          <dl className="datos">
            <dt>Título</dt><dd>{libro.titulo}</dd>
            <dt>Autor</dt><dd>{libro.autor || '—'}</dd>
            <dt>ISBN</dt><dd>{libro.isbn || '—'}</dd>
            <dt>Editorial</dt><dd>{libro.editorial || '—'}</dd>
            <dt>Año</dt><dd>{libro.anio || '—'}</dd>
            <dt>Categoría</dt><dd>{libro.categoria || '—'}</dd>
            <dt>Ubicación</dt><dd>{libro.ubicacion || '—'}</dd>
          </dl>
        </section>
        <div className="ancha pila">
          <section className="tarjeta">
            <h2>Ejemplares</h2>
            <div className="tabla-caja">
              <table>
                <thead><tr><th>Código</th><th>Estado</th><th>Detalle</th><th><span className="oculto">Acción</span></th></tr></thead>
                <tbody>
                  {libro.ejemplares.map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.codigo_inventario}</strong></td>
                      <td>
                        {editando?.id === e.id ? (
                          <select className="input" aria-label="Nuevo estado" value={editando.estado} onChange={(ev) => setEditando({ ...editando, estado: ev.target.value })}>
                            {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : <EstadoEjemplar estado={e.estado} vencido={e.fecha_limite && e.fecha_limite < hoy} />}
                      </td>
                      <td style={{ color: 'var(--gris)' }}>
                        {editando?.id === e.id
                          ? <input className="input" aria-label="Notas" placeholder="Notas" value={editando.notas || ''} onChange={(ev) => setEditando({ ...editando, notas: ev.target.value })} />
                          : e.visitante ? `${e.visitante} · límite ${fechaCorta(e.fecha_limite)}` : (e.notas || '—')}
                      </td>
                      <td className="der">
                        {e.estado === 'Prestado'
                          ? <Link to="/prestamos/devolucion" style={{ fontSize: 14 }}>Registrar devolución</Link>
                          : editando?.id === e.id
                            ? <span className="acciones" style={{ justifyContent: 'flex-end', gap: 8 }}><button className="btn chico" onClick={() => setEditando(null)}>Cancelar</button><button className="btn chico primario" onClick={guardarEstado}>Guardar</button></span>
                            : <button className="btn chico" onClick={() => setEditando({ id: e.id, estado: e.estado, notas: e.notas })}>Cambiar estado</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {libro.ejemplares.length === 0 && <p className="nota">Este libro no tiene ejemplares todavía.</p>}
            </div>
          </section>
          <section className="tarjeta">
            <h2>Últimos préstamos</h2>
            {libro.historial.length === 0 && <p className="nota">Sin préstamos registrados.</p>}
            {libro.historial.map((h, i) => (
              <div className="resultado" key={i}>
                <span>{h.visitante} · {h.codigo_inventario}</span>
                <span style={{ color: 'var(--gris)' }}>{fechaCorta(h.fecha_prestamo)} → {h.fecha_devolucion ? fechaCorta(h.fecha_devolucion) : 'pendiente'}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  )
}
