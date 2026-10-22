import { useEffect, useState } from 'react';
import { api, ESTADOS, FLUJO } from '../api/client.js';
import EstadoBadge from './EstadoBadge.jsx';

const formatoFecha = (f) =>
  new Date(f).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

export default function PaqueteDetalle({ codigo, revision, sucursalId, onCerrar, onActualizado }) {
  const [paquete, setPaquete] = useState(null);
  const [error, setError] = useState('');
  const [errorConsulta, setErrorConsulta] = useState('');
  const [actualizacion, setActualizacion] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    api.obtenerPaquete(codigo)
      .then((p) => { if (activo) { setPaquete(p); setErrorConsulta(''); } })
      .catch((e) => { if (activo) setErrorConsulta(e.message); });
    return () => { activo = false; };
  }, [codigo, revision, actualizacion]);

  async function cambiarEstado(estado) {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      await api.cambiarEstado(paquete.id, estado);
      onActualizado();
    } catch (e) {
      setError(e.message);
    } finally {
      // También ante un conflicto: volver a consultar el estado real del servidor.
      setActualizacion((n) => n + 1);
      setGuardando(false);
    }
  }

  // Qué puede hacer esta sucursal con el paquete (el servidor lo vuelve a comprobar)
  const paso = paquete ? FLUJO[paquete.estado] : null;
  const esOrigen = paquete?.sucursal_origen === sucursalId;
  const esDestino = paquete?.sucursal_destino === sucursalId;
  const puedeAvanzar = Boolean(paso) && paquete[paso.responsable] === sucursalId;
  const indice = paquete ? ESTADOS.indexOf(paquete.estado) : 0;

  let aviso = '';
  if (paquete && !paso) {
    aviso = 'El paquete ya fue entregado. No hay más cambios.';
  } else if (paquete && !puedeAvanzar) {
    const quien = paso.responsable === 'sucursal_origen' ? paquete.origen : paquete.destino;
    aviso = esOrigen || esDestino
      ? `Esperando a que ${quien} lo marque como ${paso.siguiente.toLowerCase()}.`
      : 'Este paquete no sale de ni llega a tu sucursal: solo puedes consultarlo.';
  }

  return (
    <section className="rounded-lg border-2 border-ink bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">Paquete {codigo}</h2>
        <button type="button" onClick={onCerrar} className="boton-secundario">Cerrar</button>
      </div>

      {(error || errorConsulta) && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error || errorConsulta}</p>}
      {!paquete && !error && !errorConsulta && <p className="mt-2 text-sm text-muted">Cargando…</p>}

      {paquete && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">De: </dt><dd className="inline">{paquete.remitente}</dd></div>
            <div><dt className="inline text-muted">Para: </dt><dd className="inline">{paquete.destinatario}</dd></div>
            <div><dt className="inline text-muted">Ruta: </dt><dd className="inline">{paquete.origen} → {paquete.destino}</dd></div>
            {paquete.descripcion && (
              <div><dt className="inline text-muted">Detalle: </dt><dd className="inline">{paquete.descripcion}</dd></div>
            )}
            <div className="pt-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs font-semibold" aria-label="Progreso del paquete">
              {ESTADOS.map((e, i) => (
                <li key={e} aria-current={i === indice ? 'step' : undefined} className="flex items-center gap-1">
                  <span className={`rounded px-2 py-1 ${i <= indice ? 'bg-ink text-white' : 'bg-paper text-muted'}`}>
                    {i + 1}. {e}
                  </span>
                  {i < ESTADOS.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
                </li>
              ))}
            </ol>
            </div>
            {(esOrigen || esDestino) && (
              <div className="text-muted">
                Tu sucursal es el {esOrigen ? 'origen' : 'destino'} de este paquete.
              </div>
            )}
            <div className="pt-2">
              {puedeAvanzar ? (
                <button type="button" disabled={guardando} onClick={() => cambiarEstado(paso.siguiente)} className="boton-primario">
                  Marcar como {paso.siguiente.toLowerCase()}
                </button>
              ) : (
                <p className="rounded-md bg-paper p-2 text-sm text-muted">{aviso}</p>
              )}
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
