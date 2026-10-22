import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seguirEventos } from './eventos.js';

function respuesta(fragmentos) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const texto of fragmentos) controller.enqueue(new TextEncoder().encode(texto));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('procesa avisos fragmentados y agrupados, ignorando los heartbeats', async () => {
  const abort = new AbortController();
  let cambios = 0;
  const estados = [];
  await seguirEventos({
    signal: abort.signal,
    conectar: async () => respuesta([': keepalive\n\ndata: {', '}\r', '\n\r\ndata: {}\n\n']),
    onCambio: () => { if (++cambios === 2) abort.abort(); },
    onEstado: (estado) => estados.push(estado),
  });
  assert.equal(cambios, 2);
  assert.deepEqual(estados, ['conectando', 'conectado']);
});

test('reconecta tras un corte y procesa la sincronización inicial de la nueva conexión', async () => {
  const abort = new AbortController();
  let conexiones = 0;
  let cambios = 0;
  const estados = [];
  await seguirEventos({
    signal: abort.signal,
    reintentoMs: 1,
    conectar: async () => {
      conexiones++;
      if (conexiones === 1) throw new TypeError('sin red');
      return respuesta(['data: {}\n\n']);
    },
    onCambio: () => { cambios++; abort.abort(); },
    onEstado: (estado) => estados.push(estado),
  });
  assert.equal(conexiones, 2);
  assert.equal(cambios, 1);
  assert.deepEqual(estados, ['conectando', 'reconectando', 'conectado']);
});

test('una sesión rechazada no provoca un ciclo de reconexión', async () => {
  let conexiones = 0;
  await seguirEventos({
    signal: new AbortController().signal,
    conectar: async () => { conexiones++; throw Object.assign(new Error('sesión vencida'), { status: 401 }); },
    onCambio: () => assert.fail('No debe notificar'),
    onEstado: () => {},
  });
  assert.equal(conexiones, 1);
});

test('desmontar el panel cancela el stream y no vuelve a conectar', async () => {
  const abort = new AbortController();
  let cancelado = false;
  let conexiones = 0;
  await seguirEventos({
    signal: abort.signal,
    conectar: async () => {
      conexiones++;
      return new Response(new ReadableStream({ cancel() { cancelado = true; } }), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    },
    onCambio: () => assert.fail('No debe notificar'),
    onEstado: (estado) => { if (estado === 'conectado') abort.abort(); },
  });
  assert.equal(cancelado, true);
  assert.equal(conexiones, 1);
});

test('un servidor que devuelve HTML se muestra desconectado y se reintenta', async () => {
  const abort = new AbortController();
  const estados = [];
  await seguirEventos({
    signal: abort.signal,
    conectar: async () => new Response('<html></html>'),
    onCambio: () => assert.fail('No debe notificar'),
    onEstado: (estado) => {
      estados.push(estado);
      if (estado === 'reconectando') abort.abort();
    },
  });
  assert.deepEqual(estados, ['conectando', 'reconectando']);
});

test('si dejan de llegar heartbeats cancela el canal bloqueado y reconecta', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const abort = new AbortController();
  let cancelado = false;
  const estados = [];
  await seguirEventos({
    signal: abort.signal,
    conectar: async () => new Response(new ReadableStream({ cancel() { cancelado = true; } }), {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
    onCambio: () => assert.fail('No debe notificar'),
    onEstado: (estado) => {
      estados.push(estado);
      if (estado === 'conectado') t.mock.timers.tick(45_000);
      if (estado === 'reconectando') abort.abort();
    },
  });
  assert.equal(cancelado, true);
  assert.deepEqual(estados, ['conectando', 'conectado', 'reconectando']);
});
