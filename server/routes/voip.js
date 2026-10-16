import { Router } from 'express';

const router = Router();

// Credenciales del teléfono web de cada sucursal, definidas en el .env:
//   VOIP_<id>_WS, VOIP_<id>_USER, VOIP_<id>_PASS
// Nota: la clave llega al navegador (es lo normal en un softphone web simple).
// Para un sistema real se usarían credenciales temporales.
router.get('/:sucursalId', (req, res) => {
  const id = Number(req.params.sucursalId);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'sucursal inválida' });
  }
  const ws = process.env[`VOIP_${id}_WS`];
  const usuario = process.env[`VOIP_${id}_USER`];
  const clave = process.env[`VOIP_${id}_PASS`];
  if (!ws || !usuario || !clave) {
    return res.status(404).json({ error: `VoIP no configurado para la sucursal ${id}` });
  }
  res.json({ ws, usuario, clave, dominio: new URL(ws).hostname });
});

export default router;
