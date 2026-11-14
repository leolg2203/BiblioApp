import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, guardarSesion } from '../api'
import { IconoLibro, Mensaje } from '../componentes'

export default function Login() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      guardarSesion(await api.post('/auth/login', { usuario, password }))
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login">
      <main>
        <div className="marca">
          <div className="icono"><IconoLibro tam={34} /></div>
          <h1>BiblioApp</h1>
          <p className="sub">Biblioteca comunitaria</p>
        </div>
        <form className="tarjeta" onSubmit={entrar} style={{ padding: 32 }}>
          <h2>Iniciar sesión</h2>
          <div className="campo">
            <label htmlFor="usuario">Usuario</label>
            <input id="usuario" className="input" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn primario grande" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
          <Mensaje>{error}</Mensaje>
        </form>
      </main>
    </div>
  )
}
