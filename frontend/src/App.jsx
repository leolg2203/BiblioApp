import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { leerSesion } from './api'
import { Layout } from './componentes'
import Login from './paginas/Login'
import Panel from './paginas/Panel'
import NuevaVisita from './paginas/NuevaVisita'
import Inventario from './paginas/Inventario'
import FichaLibro from './paginas/FichaLibro'
import FormLibro from './paginas/FormLibro'
import Prestamos from './paginas/Prestamos'
import Reporte from './paginas/Reporte'
import Administracion from './paginas/Administracion'

function Protegida({ children }) {
  return leerSesion()?.token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protegida><Layout /></Protegida>}>
          <Route index element={<Panel />} />
          <Route path="visitas/nueva" element={<NuevaVisita />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="inventario/nuevo" element={<FormLibro />} />
          <Route path="inventario/:id" element={<FichaLibro />} />
          <Route path="inventario/:id/editar" element={<FormLibro />} />
          <Route path="prestamos" element={<Prestamos />} />
          <Route path="prestamos/:seccion" element={<Prestamos />} />
          <Route path="reportes" element={<Reporte />} />
          <Route path="administracion" element={<Administracion />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
