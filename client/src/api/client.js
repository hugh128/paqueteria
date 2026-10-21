// Único punto de contacto con el backend. Todas las rutas empiezan con /api.
// La sesión (token) se guarda en sessionStorage: es por pestaña, así que puedes tener
// una pestaña en la Sucursal A y otra en la B al mismo tiempo.
export const ESTADOS = ['En tránsito', 'Recibido', 'Entregado'];

// Ciclo del paquete (el servidor es quien lo hace cumplir; esto solo decide qué mostrar):
//   nace "En tránsito" (lo envía el origen) -> el DESTINO lo marca "Recibido" -> el DESTINO lo marca "Entregado"
export const FLUJO = {
  'En tránsito': { siguiente: 'Recibido', responsable: 'sucursal_destino' },
  'Recibido': { siguiente: 'Entregado', responsable: 'sucursal_destino' },
};

const CLAVE_TOKEN = 'paqueteria.token';
export const getToken = () => sessionStorage.getItem(CLAVE_TOKEN);
const setToken = (token) => sessionStorage.setItem(CLAVE_TOKEN, token);
const clearToken = () => sessionStorage.removeItem(CLAVE_TOKEN);

// App.jsx registra aquí qué hacer cuando el servidor dice que la sesión ya no es válida
let alExpirar = () => {};
export const alSesionExpirada = (fn) => { alExpirar = fn; };

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && path !== '/auth/login') {
    clearToken();
    alExpirar();
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  // Sesión
  async login(usuario, clave, sucursalId) {
    const { token, ...sesion } = await request('/auth/login', {
      method: 'POST', body: JSON.stringify({ usuario, clave, sucursalId }),
    });
    setToken(token);
    return sesion; // { usuario, sucursal }
  },
  me: () => request('/auth/me'),
  logout: clearToken,

  // Datos
  sucursales: () => request('/sucursales'),
  voipConfig: () => request('/voip'),
  listarPaquetes: () => request('/paquetes'),
  obtenerPaquete: (codigo) => request(`/paquetes/${encodeURIComponent(codigo)}`),
  crearPaquete: (datos) =>
    request('/paquetes', { method: 'POST', body: JSON.stringify(datos) }),
  cambiarEstado: (id, estado) =>
    request(`/paquetes/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
};
