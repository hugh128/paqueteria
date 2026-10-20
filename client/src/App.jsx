import { useEffect, useState } from 'react';
import { api, alSesionExpirada, getToken } from './api/client.js';
import Login from './components/Login.jsx';
import Panel from './Panel.jsx';

// Decide qué pantalla mostrar: el login o el panel de la sucursal
export default function App() {
  const [sesion, setSesion] = useState(null); // { usuario, sucursal }
  const [verificando, setVerificando] = useState(Boolean(getToken()));
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    alSesionExpirada(() => {
      setSesion(null);
      setAviso('Tu sesión venció. Inicia sesión de nuevo.');
    });
    if (!getToken()) return;
    // Si recargas la página, se restaura la sesión de esta pestaña
    api.me()
      .then(setSesion)
      .catch(() => {})
      .finally(() => setVerificando(false));
  }, []);

  function salir() {
    api.logout();
    setAviso('');
    setSesion(null);
  }

  if (verificando) {
    return <div className="grid min-h-screen place-items-center bg-paper font-sans text-muted">Cargando…</div>;
  }
  if (!sesion) {
    return <Login aviso={aviso} onIngreso={(s) => { setAviso(''); setSesion(s); }} />;
  }
  return <Panel sesion={sesion} onSalir={salir} />;
}
