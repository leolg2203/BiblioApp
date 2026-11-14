const jwt = require('jsonwebtoken');

// En producción define JWT_SECRET en el entorno. El valor por omisión solo sirve para desarrollo.
const SECRET = process.env.JWT_SECRET || 'biblioapp-dev-cambiar-en-produccion';

function firmar(usuario) {
  return jwt.sign({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, SECRET, { expiresIn: '12h' });
}

function requiereSesion(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'La sesión expiró. Vuelve a iniciar sesión.' });
  }
}

module.exports = { firmar, requiereSesion };
