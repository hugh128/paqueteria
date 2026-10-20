import { Router } from 'express';
import { pool } from '../db.js';

// Todas las rutas exigen sesión (ver server.js): req.auth = { uid, sucursalId }
const router = Router();
const ESTADOS = ['Recibido', 'En tránsito', 'Entregado'];

const SELECT_BASE = `
  SELECT p.*, so.nombre AS origen, sd.nombre AS destino
  FROM paquetes p
  JOIN sucursales so ON so.id = p.sucursal_origen
  JOIN sucursales sd ON sd.id = p.sucursal_destino`;

// Listar: los paquetes que salen de la sucursal de la sesión o llegan a ella
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE}
       WHERE p.sucursal_origen = $1 OR p.sucursal_destino = $1
       ORDER BY p.creado_en DESC`, [req.auth.sucursalId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Consultar por código (cualquier sucursal puede rastrear un paquete), con historial
router.get('/:codigo', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} WHERE p.codigo = $1`, [req.params.codigo]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    const hist = await pool.query(
      `SELECT h.estado, h.fecha, u.nombre AS usuario
       FROM historial_estados h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.paquete_id = $1
       ORDER BY h.fecha, h.id`, [rows[0].id]);
    res.json({ ...rows[0], historial: hist.rows });
  } catch (e) { next(e); }
});

// Registrar paquete: el origen siempre es la sucursal de la sesión
router.post('/', async (req, res, next) => {
  const { codigo, remitente, destinatario, descripcion, sucursal_destino } = req.body ?? {};
  const sucursal_origen = req.auth.sucursalId;
  if (!codigo || !remitente || !destinatario || !Number.isInteger(sucursal_destino)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (sucursal_origen === sucursal_destino) {
    return res.status(400).json({ error: 'Origen y destino deben ser distintos' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO paquetes (codigo, remitente, destinatario, descripcion,
                             sucursal_origen, sucursal_destino)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [codigo, remitente, destinatario, descripcion ?? null,
       sucursal_origen, sucursal_destino]);
    await client.query(
      'INSERT INTO historial_estados (paquete_id, estado, usuario_id) VALUES ($1, $2, $3)',
      [rows[0].id, rows[0].estado, req.auth.uid]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'El código ya existe' });
    if (e.code === '23503') return res.status(400).json({ error: 'Sucursal inexistente' });
    next(e);
  } finally {
    client.release();
  }
});

// Actualizar estado: solo la sucursal de origen o la de destino del paquete
router.patch('/:id/estado', async (req, res, next) => {
  const id = Number(req.params.id);
  const { estado } = req.body ?? {};
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE paquetes SET estado = $1, actualizado_en = NOW()
       WHERE id = $2 AND (sucursal_origen = $3 OR sucursal_destino = $3)
       RETURNING *`, [estado, id, req.auth.sucursalId]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Paquete no encontrado en esta sucursal' });
    }
    await client.query(
      'INSERT INTO historial_estados (paquete_id, estado, usuario_id) VALUES ($1, $2, $3)',
      [id, estado, req.auth.uid]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export default router;
