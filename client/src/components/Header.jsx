import BotonLlamar from './BotonLlamar.jsx';

export default function Header({ sesion, onSalir, destinoLlamada }) {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 p-4 md:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Paquetería entre sucursales</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <span className="rounded bg-white/15 px-2 py-0.5 font-semibold text-white">
              {sesion.sucursal.nombre}
            </span>
            <span>{sesion.usuario.nombre}</span>
            <button
              type="button"
              onClick={onSalir}
              className="underline underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              Cerrar sesión
            </button>
          </p>
        </div>
        <BotonLlamar sucursalId={sesion.sucursal.id} destino={destinoLlamada} />
      </div>
    </header>
  );
}
