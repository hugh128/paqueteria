import { useRef } from 'react';
import { useLlamada } from '../hooks/useLlamada.js';
import { useTimbre } from '../hooks/useTimbre.js';

const EXTENSION_ECO = '600'; // eco local de Asterisk, para probar el micrófono

const BASE = 'rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50';
const AMARILLO = `${BASE} bg-tape text-ink hover:brightness-95`;
const ROJO = `${BASE} bg-red-600 text-white hover:bg-red-700`;
const CONTORNO = `${BASE} border border-white/40 text-white hover:bg-white/10`;
const ENLACE = 'text-xs text-white/70 underline underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-white';

export default function BotonLlamar({ sucursalId, destino }) {
  const audioRef = useRef(null);
  const {
    estado, mensaje, silenciado,
    llamar, colgar, contestar, rechazar, alternarSilencio, reintentar,
  } = useLlamada(sucursalId, audioRef);

  useTimbre(estado === 'timbrando');

  const nombre = destino?.nombre ?? 'la otra sucursal';

  return (
    <div className="flex max-w-xs flex-col items-start gap-2 sm:items-end">
      <audio ref={audioRef} autoPlay />

      {estado === 'timbrando' && (
        <div role="alert" className="rounded-md border-2 border-tape p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-tape motion-safe:animate-pulse" />
            Llamada entrante de {nombre}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={contestar} className={AMARILLO}>Contestar</button>
            <button type="button" onClick={rechazar} className={CONTORNO}>Rechazar</button>
          </div>
        </div>
      )}

      {(estado === 'llamando' || estado === 'en-llamada') && (
        <div className="flex gap-2">
          <button type="button" onClick={colgar} className={ROJO}>Colgar</button>
          {estado === 'en-llamada' && (
            <button type="button" onClick={alternarSilencio} aria-pressed={silenciado} className={CONTORNO}>
              {silenciado ? 'Activar micrófono' : 'Silenciar'}
            </button>
          )}
        </div>
      )}

      {['conectando', 'listo', 'error'].includes(estado) && (
        <button
          type="button"
          onClick={() => llamar(destino.extension_sip)}
          disabled={estado !== 'listo' || !destino}
          className={AMARILLO}
        >
          {estado === 'conectando' ? 'Conectando…' : `Llamar a ${nombre}`}
        </button>
      )}

      <p role="status" className="text-xs text-white/80">{mensaje}</p>

      {estado === 'listo' && (
        <button type="button" onClick={() => llamar(EXTENSION_ECO)} className={ENLACE}>
          Probar micrófono (eco)
        </button>
      )}
      {estado === 'error' && (
        <button type="button" onClick={reintentar} className={ENLACE}>Reintentar conexión</button>
      )}
    </div>
  );
}
