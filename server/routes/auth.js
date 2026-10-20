import { Router } from 'express';
import { pool } from '../db.js';
import { firmarToken, hashClave, requireAuth, verificarClave } from '../auth.js';

const router = Router();

const datosUsuario = (u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });

// Inicio de sesión: usuario + contraseña + sucursal en la que se va a trabajar
router.post('/login', async (req, res, next) => {
  try {
    const { usuario, clave, sucursalId } = req.body ?? {};
    if (typeof usuario !== 'string' || typeof clave !== 'string' || !Number.isInteger(sucursalId)) {
      return res.status(400).json({ error: 'Completa usuario, contraseña y sucursal' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1', [usuario.trim().toLowerCase()]);
    const u = rows[0];

    // Si el usuario no existe se hace igual un hash, para que no se note la diferencia de tiempo
    const valida = u ? await verificarClave(clave, u.clave_hash) : (await hashClave(clave), false);
    if (!valida) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    // Un administrador entra a cualquier sucursal; un empleado solo a la suya
    if (u.rol !== 'admin' && u.sucursal_id !== sucursalId) {
      return res.status(403).json({ error: 'Tu usuario no tiene acceso a esa sucursal' });
    }
    const suc = await pool.query('SELECT * FROM sucursales WHERE id = $1', [sucursalId]);
    if (suc.rows.length === 0) return res.status(400).json({ error: 'Sucursal inexistente' });

    const token = firmarToken({ uid: u.id, sucursalId });
    res.json({ token, usuario: datosUsuario(u), sucursal: suc.rows[0] });
  } catch (e) { next(e); }
});

// Datos de la sesión actual (sirve para restaurarla al recargar la página)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const u = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.auth.uid]);
    const s = await pool.query('SELECT * FROM sucursales WHERE id = $1', [req.auth.sucursalId]);
    if (u.rows.length === 0 || s.rows.length === 0) {
      return res.status(401).json({ error: 'Tu sesión ya no es válida' });
    }
    res.json({ usuario: datosUsuario(u.rows[0]), sucursal: s.rows[0] });
  } catch (e) { next(e); }
});

export default router;
