import EstadoBadge from './EstadoBadge.jsx';

export default function PaqueteList({ paquetes, seleccionado, onSeleccionar }) {
  if (paquetes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-muted">
        No hay paquetes que mostrar. Registra el primero con el formulario.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Código</th>
            <th className="px-3 py-2 font-medium">Remitente / Destinatario</th>
            <th className="px-3 py-2 font-medium">Ruta</th>
            <th className="px-3 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {paquetes.map((p) => (
            <tr
              key={p.id}
              onClick={() => onSeleccionar(p.codigo)}
              className={`cursor-pointer border-b border-line/60 last:border-0 hover:bg-paper
                ${seleccionado === p.codigo ? 'bg-paper' : ''}`}
            >
              <td className="px-3 py-2 font-semibold">
                <button type="button" className="text-left underline-offset-2 hover:underline
                  focus-visible:outline-2 focus-visible:outline-ink"
                        onClick={(e) => { e.stopPropagation(); onSeleccionar(p.codigo); }}>
                  {p.codigo}
                </button>
              </td>
              <td className="px-3 py-2">{p.remitente} → {p.destinatario}</td>
              <td className="px-3 py-2 text-muted">{p.origen} → {p.destino}</td>
              <td className="px-3 py-2"><EstadoBadge estado={p.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
