import BotonLlamar from './BotonLlamar.jsx';

export default function Header({ sucursales, sucursalId, onCambiarSucursal, destinoLlamada }) {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4 md:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Paquetería entre sucursales</h1>
          <label className="mt-1 flex items-center gap-2 text-sm text-white/80">
            Esta sucursal
            <select
              value={sucursalId ?? ''}
              onChange={(e) => onCambiarSucursal(Number(e.target.value))}
              className="rounded border border-white/30 bg-ink px-2 py-1 text-white
                         focus-visible:outline-2 focus-visible:outline-tape"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </label>
        </div>
        <BotonLlamar sucursalId={sucursalId} destino={destinoLlamada} />
      </div>
    </header>
  );
}
