// Único punto de contacto con el backend. Todas las rutas empiezan con /api.
export const ESTADOS = ['Recibido', 'En tránsito', 'Entregado'];

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  sucursales: () => request('/sucursales'),
  voipConfig: (sucursalId) => request(`/voip/${sucursalId}`),
  listarPaquetes: (sucursalId) =>
    request(`/paquetes${sucursalId ? `?sucursal=${sucursalId}` : ''}`),
  obtenerPaquete: (codigo) => request(`/paquetes/${encodeURIComponent(codigo)}`),
  crearPaquete: (datos) =>
    request('/paquetes', { method: 'POST', body: JSON.stringify(datos) }),
  cambiarEstado: (id, estado) =>
    request(`/paquetes/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
};
