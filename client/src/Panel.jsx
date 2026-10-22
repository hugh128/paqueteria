import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api/client.js';
import Header from './components/Header.jsx';
import PaqueteForm from './components/PaqueteForm.jsx';
import PaqueteList from './components/PaqueteList.jsx';
import PaqueteDetalle from './components/PaqueteDetalle.jsx';
import { useEventos } from './hooks/useEventos.js';

// Pantalla principal de la sucursal en la que se inició sesión
export default function Panel({ sesion, onSalir }) {
  const sucursalId = sesion.sucursal.id;
  const [sucursales, setSucursales] = useState([]);
  const [paquetes, setPaquetes] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const { revision, estado: estadoEventos } = useEventos();
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    api.sucursales().then(setSucursales).catch((e) => setError(e.message));
  }, []);

  const cargarPaquetes = useCallback(() => setActualizacion((n) => n + 1), []);

  useEffect(() => {
    let activo = true;
    api.listarPaquetes()
      .then((lista) => { if (activo) { setPaquetes(lista); setError(''); } })
      .catch((e) => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [revision, actualizacion]);

  const destinoLlamada = sucursales.find((s) => s.id !== sucursalId);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return paquetes;
    return paquetes.filter((p) =>
      [p.codigo, p.remitente, p.destinatario].some((t) => t.toLowerCase().includes(q)));
  }, [paquetes, busqueda]);

  // Enter en el buscador: abre el paquete por código exacto (aunque sea de otra sucursal)
  function consultar(e) {
    e.preventDefault();
    if (busqueda.trim()) setSeleccionado(busqueda.trim());
  }

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <Header sesion={sesion} onSalir={onSalir} destinoLlamada={destinoLlamada} />

      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[22rem_1fr] md:p-6">
        <aside>
          <PaqueteForm
            sucursales={sucursales}
            sucursalId={sucursalId}
            onCreado={(p) => { cargarPaquetes(); setSeleccionado(p.codigo); }}
          />
        </aside>

        <section className="space-y-4">
          <p role="status" className="text-xs text-muted">
            {estadoEventos === 'conectado'
              ? 'Paquetes: actualización en vivo activa.'
              : estadoEventos === 'conectando'
                ? 'Paquetes: conectando actualización en vivo…'
                : 'Paquetes: conexión en vivo interrumpida. Reconectando…'}
          </p>
          {error && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              No se pudo conectar con el servidor: {error}
            </p>
          )}

          <form onSubmit={consultar} className="flex gap-2">
            <input
              className="campo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Filtrar por código o nombre; Enter abre un código exacto"
              aria-label="Buscar paquete"
            />
            <button type="submit" className="boton-primario">Consultar</button>
          </form>

          {seleccionado && (
            <PaqueteDetalle
              key={seleccionado}
              codigo={seleccionado}
              revision={revision}
              sucursalId={sucursalId}
              onCerrar={() => setSeleccionado(null)}
              onActualizado={cargarPaquetes}
            />
          )}

          <PaqueteList paquetes={visibles} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />
        </section>
      </main>
    </div>
  );
}
