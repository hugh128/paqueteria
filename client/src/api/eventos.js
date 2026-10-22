// Consumidor del canal SSE de esta app. Fetch permite conservar Authorization:
// Bearer por pestaña; EventSource nativo no admite esa cabecera.
export async function seguirEventos({ signal, conectar, onCambio, onEstado, reintentoMs = 3000 }) {
  onEstado('conectando');
  while (!signal.aborted) {
    const intento = new AbortController();
    const cancelar = () => intento.abort();
    signal.addEventListener('abort', cancelar, { once: true });
    let reader;
    let timeout;
    const vigilar = () => {
      clearTimeout(timeout);
      timeout = setTimeout(cancelar, 45_000);
    };
    const cancelarLectura = () => { reader?.cancel().catch(() => {}); };
    intento.signal.addEventListener('abort', cancelarLectura, { once: true });
    try {
      vigilar();
      const res = await conectar(intento.signal);
      if (!res.headers.get('Content-Type')?.startsWith('text/event-stream') || !res.body) {
        await res.body?.cancel();
        throw new Error('Respuesta SSE inválida');
      }
      reader = res.body.getReader();
      if (signal.aborted || intento.signal.aborted) break;
      onEstado('conectado');
      const decoder = new TextDecoder();
      let pendiente = '';
      while (!signal.aborted && !intento.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        vigilar();
        pendiente += decoder.decode(value, { stream: true });
        let separador;
        while (!signal.aborted && (separador = /\r?\n\r?\n/.exec(pendiente))) {
          const mensaje = pendiente.slice(0, separador.index);
          pendiente = pendiente.slice(separador.index + separador[0].length);
          if (mensaje.split(/\r?\n/).some((linea) => linea.startsWith('data:'))) onCambio();
        }
        if (pendiente.length > 65_536) throw new Error('Mensaje SSE demasiado grande');
      }
    } catch (e) {
      if (signal.aborted || e.status === 401) return;
      // Un corte del canal de paquetes solo cambia su indicador, nunca el teléfono.
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancelar);
      intento.signal.removeEventListener('abort', cancelarLectura);
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
      intento.abort();
    }
    if (signal.aborted) return;
    onEstado('reconectando');
    await new Promise((resolve) => {
      const terminar = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', terminar);
        resolve();
      };
      const timer = setTimeout(terminar, reintentoMs);
      signal.addEventListener('abort', terminar, { once: true });
      if (signal.aborted) terminar();
    });
  }
}
