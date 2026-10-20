import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

const scrypt = promisify(crypto.scrypt);

// Clave para firmar los tokens. Si no hay JWT_SECRET en el .env se usa una temporal:
// funciona, pero las sesiones se pierden cada vez que se reinicia el servicio.
let secretoTemporal = null;
function secreto() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!secretoTemporal) {
    secretoTemporal = crypto.randomBytes(32).toString('hex');
    console.warn('JWT_SECRET no está definido en el .env: se usa una clave temporal.');
  }
  return secretoTemporal;
}

// Formato guardado: scrypt$<sal>$<hash> (scrypt viene incluido en Node, sin dependencias)
export async function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(clave, sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarClave(clave, guardado) {
  const [alg, salHex, hashHex] = String(guardado).split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const hash = await scrypt(clave, Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(hash, esperado);
}

export function firmarToken(datos) {
  return jwt.sign(datos, secreto(), { expiresIn: '8h' });
}

// Middleware: exige "Authorization: Bearer <token>" y deja los datos en req.auth
export function requireAuth(req, res, next) {
  const cabecera = req.headers.authorization ?? '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  try {
    req.auth = jwt.verify(token, secreto());
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión venció. Inicia sesión de nuevo' });
  }
}
