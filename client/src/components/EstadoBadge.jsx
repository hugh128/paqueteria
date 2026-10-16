const ESTILOS = {
  'Recibido': 'bg-[#e3e8e6] text-[#34454d]',
  'En tránsito': 'bg-[#fdefc2] text-[#6b4a00]',
  'Entregado': 'bg-[#d6f0df] text-[#17603a]',
};

export default function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ESTILOS[estado] ?? ''}`}>
      {estado}
    </span>
  );
}
