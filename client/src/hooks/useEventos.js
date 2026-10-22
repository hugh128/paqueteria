import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { seguirEventos } from '../api/eventos.js';

export function useEventos() {
  const [revision, setRevision] = useState(0);
  const [estado, setEstado] = useState('conectando');

  useEffect(() => {
    const abort = new AbortController();
    seguirEventos({
      signal: abort.signal,
      conectar: api.eventos,
      onCambio: () => setRevision((n) => n + 1),
      onEstado: setEstado,
    });
    return () => abort.abort();
  }, []);

  return { revision, estado };
}
