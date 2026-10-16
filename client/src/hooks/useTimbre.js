import { useEffect } from 'react';

// Mientras hay una llamada entrante: suena un tono y parpadea el título de la pestaña.
export function useTimbre(activo) {
  useEffect(() => {
    if (!activo) return;

    const tituloOriginal = document.title;
    const aviso = '📞 Llamada entrante';
    let alterna = false;
    document.title = aviso;
    const parpadeo = setInterval(() => {
      alterna = !alterna;
      document.title = alterna ? tituloOriginal : aviso;
    }, 1000);

    let ctx;
    let tono;
    try {
      ctx = new AudioContext();
      ctx.resume?.();
      const tocar = () => {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.8);
        gain.connect(ctx.destination);
        [440, 480].forEach((hz) => {
          const osc = ctx.createOscillator();
          osc.frequency.value = hz;
          osc.connect(gain);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        });
      };
      tocar();
      tono = setInterval(tocar, 3000);
    } catch {
      // El navegador puede bloquear el audio si la página no ha recibido ningún clic
    }

    return () => {
      clearInterval(parpadeo);
      clearInterval(tono);
      document.title = tituloOriginal;
      ctx?.close().catch(() => {});
    };
  }, [activo]);
}
