import { useState } from 'react';
import { api } from '../api/client.js';

const VACIO = { codigo: '', remitente: '', destinatario: '', descripcion: '', destino: '' };

export default function PaqueteForm({ sucursales, sucursalId, onCreado }) {
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const origen = sucursales.find((s) => s.id === sucursalId);
  const posiblesDestinos = sucursales.filter((s) => s.id !== sucursalId);

  // Con solo dos sucursales, el destino siempre es la otra: se elige solo
  const destinoElegido = datos.destino || (posiblesDestinos.length === 1 ? String(posiblesDestinos[0].id) : '');

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const creado = await api.crearPaquete({
        codigo: datos.codigo.trim(),
        remitente: datos.remitente.trim(),
        destinatario: datos.destinatario.trim(),
        descripcion: datos.descripcion.trim() || null,
        sucursal_origen: sucursalId,
        sucursal_destino: Number(destinoElegido),
      });
      setDatos(VACIO);
      onCreado(creado);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-lg border border-line bg-white p-4">
      <h2 className="text-lg font-bold">Enviar paquete</h2>
      <p className="text-sm text-muted">
        Sale de {origen?.nombre ?? '…'}. Quedará «En tránsito» hasta que la sucursal de destino lo reciba.
      </p>

      <label className="block text-sm font-medium">
        Código
        <input className="campo mt-1" required maxLength={30} value={datos.codigo}
               onChange={cambiar('codigo')} placeholder="PKG-001" />
      </label>
      <label className="block text-sm font-medium">
        Remitente (quien envía)
        <input className="campo mt-1" required maxLength={100} value={datos.remitente}
               onChange={cambiar('remitente')} />
      </label>
      <label className="block text-sm font-medium">
        Destinatario (quien recibe)
        <input className="campo mt-1" required maxLength={100} value={datos.destinatario}
               onChange={cambiar('destinatario')} />
      </label>
      <label className="block text-sm font-medium">
        Sucursal de destino
        <select className="campo mt-1" required value={destinoElegido} onChange={cambiar('destino')}>
          <option value="" disabled>Elige una sucursal</option>
          {posiblesDestinos.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Descripción (opcional)
        <textarea className="campo mt-1" rows={2} value={datos.descripcion}
                  onChange={cambiar('descripcion')} />
      </label>

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      <button type="submit" disabled={enviando} className="boton-primario w-full">
        {enviando ? 'Enviando…' : 'Enviar paquete'}
      </button>
    </form>
  );
}
