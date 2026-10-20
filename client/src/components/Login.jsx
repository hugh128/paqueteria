import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const ULTIMA = 'paqueteria.ultimaSucursal';

export default function Login({ onIngreso, aviso }) {
  const [sucursales, setSucursales] = useState([]);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [sucursalId, setSucursalId] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.sucursales()
      .then((lista) => {
        setSucursales(lista);
        const guardada = Number(sessionStorage.getItem(ULTIMA));
        setSucursalId(lista.some((s) => s.id === guardada) ? guardada : lista[0]?.id ?? null);
      })
      .catch(() => setError('No se pudo conectar con el servidor. Revisa que esté encendido.'));
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const sesion = await api.login(usuario.trim(), clave, sucursalId);
      sessionStorage.setItem(ULTIMA, String(sucursalId));
      onIngreso(sesion);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-paper font-sans text-ink md:grid-cols-[1.15fr_1fr]">
      {/* Panel de marca: la cinta de embalaje es el elemento principal */}
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-ink p-8 text-white md:p-12">
        <p className="text-lg font-bold tracking-tight">Paquetería entre sucursales</p>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Registra el paquete. Llama a la otra sucursal.
          </h1>
          <p className="mt-4 hidden text-base text-white/75 md:block">
            Controla lo que sale y llega a tu sucursal y habla con la otra sin salir de esta página.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 bottom-16 hidden w-[140%] -rotate-6 select-none
                     overflow-hidden whitespace-nowrap border-y-2 border-ink/70 bg-tape py-3
                     text-base font-bold text-ink shadow-lg md:block"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="mr-14 inline-block">Paquetería entre sucursales</span>
          ))}
        </div>
        <div className="hidden h-24 md:block" aria-hidden="true" />
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted">Elige la sucursal en la que vas a trabajar.</p>
          </div>

          {aviso && (
            <p role="status" className="rounded-md border border-line bg-white p-3 text-sm">{aviso}</p>
          )}

          <label className="block text-sm font-medium">
            Usuario
            <input
              className="campo mt-1"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </label>

          <div>
            <label htmlFor="clave" className="block text-sm font-medium">Contraseña</label>
            <div className="relative mt-1">
              <input
                id="clave"
                className="campo pr-20"
                type={verClave ? 'text' : 'password'}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                aria-pressed={verClave}
                className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-muted hover:text-ink
                           focus-visible:outline-2 focus-visible:outline-ink"
              >
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sucursal</legend>
            <div className="space-y-2">
              {sucursales.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5
                             text-sm has-checked:border-ink has-checked:ring-1 has-checked:ring-ink
                             has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
                >
                  <input
                    type="radio"
                    name="sucursal"
                    value={s.id}
                    checked={sucursalId === s.id}
                    onChange={() => setSucursalId(s.id)}
                    className="size-4 accent-ink"
                  />
                  <span className="font-medium">{s.nombre}</span>
                  <span className="ml-auto text-xs text-muted">Ext. {s.extension_sip}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

          <button type="submit" disabled={enviando || sucursalId === null} className="boton-primario w-full">
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="text-xs text-muted">Si no tienes usuario, pídeselo al administrador.</p>
        </form>
      </section>
    </div>
  );
}
