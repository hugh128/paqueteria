import { Router } from 'express';

const router = Router();

// Credenciales del teléfono web de la sucursal en la que inició sesión el usuario.
// Salen del .env: VOIP_<id>_WS, VOIP_<id>_USER, VOIP_<id>_PASS
router.get('/', (req, res) => {
  const id = req.auth.sucursalId;
  const ws = process.env[`VOIP_${id}_WS`];
  const usuario = process.env[`VOIP_${id}_USER`];
  const clave = process.env[`VOIP_${id}_PASS`];
  if (!ws || !usuario || !clave) {
    return res.status(404).json({ error: `VoIP no configurado para la sucursal ${id}` });
  }
  res.json({ ws, usuario, clave, dominio: new URL(ws).hostname });
});

export default router;
