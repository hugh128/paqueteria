import { useEffect, useState } from 'react';
import { api, ESTADOS } from '../api/client.js';
import EstadoBadge from './EstadoBadge.jsx';

const formatoFecha = (f) =>
  new Date(f).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

export default function PaqueteDetalle({ codigo, onCerrar, onActualizado }) {
  const [paquete, setPaquete] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    setPaquete(null);
    setError('');
    api.obtenerPaquete(codigo)
      .then((p) => activo && setPaquete(p))
      .catch((e) => activo && setError(e.message));
    return () => { activo = false; };
  }, [codigo]);

  async function cambiarEstado(estado) {
    try {
      await api.cambiarEstado(paquete.id, estado);
      setPaquete(await api.obtenerPaquete(codigo));
      onActualizado();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="rounded-lg border-2 border-ink bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">Paquete {codigo}</h2>
        <button type="button" onClick={onCerrar} className="boton-secundario">Cerrar</button>
      </div>

      {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      {!paquete && !error && <p className="mt-2 text-sm text-muted">Cargando…</p>}

      {paquete && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">De: </dt><dd className="inline">{paquete.remitente}</dd></div>
            <div><dt className="inline text-muted">Para: </dt><dd className="inline">{paquete.destinatario}</dd></div>
            <div><dt className="inline text-muted">Ruta: </dt><dd className="inline">{paquete.origen} → {paquete.destino}</dd></div>
            {paquete.descripcion && (
              <div><dt className="inline text-muted">Detalle: </dt><dd className="inline">{paquete.descripcion}</dd></div>
            )}
            <div className="pt-2"><EstadoBadge estado={paquete.estado} /></div>
            <div className="flex flex-wrap gap-2 pt-2">
              {ESTADOS.map((e) => (
                <button key={e} type="button" disabled={e === paquete.estado}
                        onClick={() => cambiarEstado(e)} className="boton-secundario">
                  Marcar como {e.toLowerCase()}
                </button>
              ))}
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Historial</h3>
            <ol className="space-y-2 border-l-2 border-line pl-3 text-sm">
              {paquete.historial.map((h, i) => (
                <li key={i}>
                  <EstadoBadge estado={h.estado} />
                  <span className="ml-2 text-muted">
                    {formatoFecha(h.fecha)}{h.usuario ? `, por ${h.usuario}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
