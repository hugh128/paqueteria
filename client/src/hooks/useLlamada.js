import { useCallback, useEffect, useRef, useState } from 'react';
import { Web } from 'sip.js';
import { api } from '../api/client.js';

function mensajeError(e) {
  if (e?.name === 'NotAllowedError') return 'El navegador no tiene permiso para usar el micrófono.';
  if (e?.name === 'NotFoundError') return 'No se encontró ningún micrófono.';
  return 'No se pudo iniciar la llamada.';
}

/**
 * Teléfono web de una sucursal. Se registra en el Asterisk de esa sucursal
 * (WebRTC sobre WSS) y permite llamar, contestar, colgar y silenciar.
 * Estados: conectando | listo | llamando | timbrando | en-llamada | error
 */
export function useLlamada(sucursalId, audioRef) {
  const [estado, setEstado] = useState('conectando');
  const [mensaje, setMensaje] = useState('');
  const [silenciado, setSilenciado] = useState(false);
  const [intento, setIntento] = useState(0);

  const userRef = useRef(null);
  const configRef = useRef(null);
  const respondidaRef = useRef(false);

  useEffect(() => {
    if (!sucursalId) return;
    let cancelado = false;
    let user = null;

    async function iniciar() {
      setEstado('conectando');
      setMensaje('Conectando con la central telefónica…');
      setSilenciado(false);
      respondidaRef.current = false;

      let cfg;
      try {
        cfg = await api.voipConfig(sucursalId);
      } catch (e) {
        if (!cancelado) { setEstado('error'); setMensaje(e.message); }
        return;
      }
      if (cancelado) return;
      configRef.current = cfg;

      user = new Web.SimpleUser(cfg.ws, {
        aor: `sip:${cfg.usuario}@${cfg.dominio}`,
        media: { remote: { audio: audioRef.current } },
        reconnectionAttempts: 3,
        reconnectionDelay: 3,
        userAgentOptions: {
          authorizationUsername: cfg.usuario,
          authorizationPassword: cfg.clave,
          logLevel: 'warn',
          // Red local: sin servidores STUN, así no se espera por internet
          sessionDescriptionHandlerFactoryOptions: {
            iceGatheringTimeout: 1500,
            peerConnectionConfiguration: { iceServers: [] },
          },
        },
        delegate: {
          onRegistered: () => {
            if (cancelado) return;
            setEstado('listo');
            setMensaje(`Conectado como extensión ${cfg.usuario}`);
          },
          onServerDisconnect: () => {
            if (cancelado) return;
            setEstado('error');
            setMensaje('Se perdió la conexión con la central telefónica.');
          },
          onCallReceived: () => {
            if (cancelado) return;
            respondidaRef.current = false;
            setEstado('timbrando');
            setMensaje('');
          },
          onCallAnswered: () => {
            if (cancelado) return;
            respondidaRef.current = true;
            setEstado('en-llamada');
            setMensaje('En llamada');
          },
          onCallHangup: () => {
            if (cancelado) return;
            setEstado('listo');
            setSilenciado(false);
            setMensaje(
              respondidaRef.current
                ? 'Llamada finalizada'
                : 'Sin respuesta: no hay un teléfono disponible en esa sucursal.'
            );
            respondidaRef.current = false;
          },
        },
      });
      userRef.current = user;

      try {
        await user.connect();
      } catch {
        if (!cancelado) {
          setEstado('error');
          setMensaje('No se pudo conectar con la central. Revisa que Asterisk esté activo y que el certificado sea de confianza.');
        }
        return;
      }
      try {
        await user.register();
      } catch (e) {
        if (!cancelado) {
          setEstado('error');
          setMensaje(`No se pudo registrar la extensión: ${e.message ?? 'revisa la clave'}`);
        }
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      userRef.current = null;
      if (user) {
        user.unregister().catch(() => {}).finally(() => user.disconnect().catch(() => {}));
      }
    };
  }, [sucursalId, intento, audioRef]);

  const llamar = useCallback(async (extension) => {
    const user = userRef.current;
    const cfg = configRef.current;
    if (!user || !cfg || estado !== 'listo') return;
    respondidaRef.current = false;
    setEstado('llamando');
    setMensaje('Llamando…');
    try {
      await user.call(`sip:${extension}@${cfg.dominio}`);
    } catch (e) {
      setEstado('listo');
      setMensaje(mensajeError(e));
    }
  }, [estado]);

  const colgar = useCallback(() => userRef.current?.hangup().catch(() => {}), []);

  const contestar = useCallback(async () => {
    try {
      await userRef.current?.answer();
    } catch (e) {
      setEstado('listo');
      setMensaje(mensajeError(e));
    }
  }, []);

  const rechazar = useCallback(() => userRef.current?.decline().catch(() => {}), []);

  const alternarSilencio = useCallback(() => {
    const user = userRef.current;
    if (!user) return;
    if (user.isMuted()) { user.unmute(); setSilenciado(false); }
    else { user.mute(); setSilenciado(true); }
  }, []);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return { estado, mensaje, silenciado, llamar, colgar, contestar, rechazar, alternarSilencio, reintentar };
}
