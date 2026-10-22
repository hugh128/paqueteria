// Un único proceso Express atiende a las dos sucursales. Los avisos no contienen
// datos: cada sesión vuelve a consultar la API con sus permisos habituales.
const conexiones = new Set();
const AVISO = 'data: {}\n\n';

export function abrirEventos(req, res) {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  let heartbeat;
  let vencimiento;
  function limpiar() {
    conexiones.delete(enviar);
    clearInterval(heartbeat);
    clearTimeout(vencimiento);
  }
  function enviar(texto) {
    try {
      if (!res.destroyed && !res.writableEnded && res.write(texto)) return;
    } catch { /* Una pestaña desconectada no debe afectar una operación de BD. */ }
    limpiar();
    res.destroy(); // No acumular mensajes en memoria para un cliente lento.
  }

  res.on('close', limpiar);
  res.on('error', limpiar);
  conexiones.add(enviar);
  heartbeat = setInterval(() => enviar(': keepalive\n\n'), 20_000);
  vencimiento = setTimeout(() => {
    limpiar();
    res.end(); // La reconexión volverá a validar la sesión mediante requireAuth.
  }, Math.max(0, req.auth.exp * 1000 - Date.now()));
  heartbeat.unref();
  vencimiento.unref();

  // También al reconectar: recuperar cambios ocurridos sin conexión, sin replay.
  enviar(AVISO);
}

// Llamar solo después de COMMIT. Nunca espera al navegador ni consulta la BD.
export function avisarCambioPaquetes() {
  for (const enviar of conexiones) enviar(AVISO);
}
