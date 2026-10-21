import { Router } from 'express';
import { pool } from '../db.js';

// Todas las rutas exigen sesión (ver server.js): req.auth = { uid, sucursalId }
const router = Router();
const ESTADOS = ['En tránsito', 'Recibido', 'Entregado'];

// Ciclo de vida del paquete: una sola dirección, un paso a la vez.
//   En tránsito : la sucursal de ORIGEN lo registra y lo envía (así nace todo paquete)
//   Recibido    : la sucursal de DESTINO confirma que el paquete llegó a su sucursal
//   Entregado   : la sucursal de DESTINO lo entregó a la persona destinataria
// Después de "Entregado" ya no hay cambios. El origen solo registra el envío y observa.
const ESTADO_INICIAL = 'En tránsito';
const FLUJO = {
  'En tránsito': { siguiente: 'Recibido',  responsable: 'sucursal_destino', quien: 'la sucursal de destino' },
  'Recibido':    { siguiente: 'Entregado', responsable: 'sucursal_destino', quien: 'la sucursal de destino' },
};

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

// Enviar (registrar) un paquete: el origen siempre es la sucursal de la sesión y nace "En tránsito"
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
                             sucursal_origen, sucursal_destino, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [codigo, remitente, destinatario, descripcion ?? null,
       sucursal_origen, sucursal_destino, ESTADO_INICIAL]);
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

// Avanzar el estado. Reglas (ver FLUJO arriba):
//  - solo se puede pasar al estado siguiente (no se salta ni se retrocede)
//  - cada paso lo hace únicamente la sucursal responsable de ese paso (ver FLUJO)
router.patch('/:id/estado', async (req, res, next) => {
  const id = Number(req.params.id);
  const { estado } = req.body ?? {};
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE bloquea la fila: si dos personas hacen clic a la vez, la segunda espera
    // y ve el estado ya cambiado en vez de aplicar el cambio dos veces.
    const { rows } = await client.query('SELECT * FROM paquetes WHERE id = $1 FOR UPDATE', [id]);
    const p = rows[0];
    const sucursal = req.auth.sucursalId;

    const rechazar = async (codigo, error) => {
      await client.query('ROLLBACK');
      return res.status(codigo).json({ error });
    };

    if (!p || (p.sucursal_origen !== sucursal && p.sucursal_destino !== sucursal)) {
      return rechazar(404, 'Paquete no encontrado en esta sucursal');
    }
    const paso = FLUJO[p.estado];
    if (!paso) {
      return rechazar(409, 'El paquete ya fue entregado y su estado no se puede cambiar');
    }
    if (estado !== paso.siguiente) {
      return rechazar(409, `Desde "${p.estado}" el único paso permitido es "${paso.siguiente}"`);
    }
    if (p[paso.responsable] !== sucursal) {
      return rechazar(403, `Solo ${paso.quien} puede marcarlo como "${paso.siguiente}"`);
    }

    const act = await client.query(
      'UPDATE paquetes SET estado = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *',
      [estado, id]);
    await client.query(
      'INSERT INTO historial_estados (paquete_id, estado, usuario_id) VALUES ($1, $2, $3)',
      [id, estado, req.auth.uid]);
    await client.query('COMMIT');
    res.json(act.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export default router;
