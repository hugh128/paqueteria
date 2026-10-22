import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { abrirEventos, avisarCambioPaquetes } from './eventos.js';

class Respuesta extends EventEmitter {
  chunks = [];
  headers = {};
  writableEnded = false;
  destroyed = false;
  set(headers) { this.headers = headers; }
  flushHeaders() {}
  write(chunk) { this.chunks.push(chunk); return true; }
  end() { this.writableEnded = true; this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); }
}

function conectar(t, segundos = 3600) {
  const res = new Respuesta();
  abrirEventos({ auth: { exp: Math.floor(Date.now() / 1000) + segundos } }, res);
  t.after(() => res.end());
  return res;
}

test('cada conexión recibe una sincronización inicial y los cambios posteriores', (t) => {
  const a = conectar(t);
  const b = conectar(t);
  assert.match(a.headers['Content-Type'], /text\/event-stream/);
  assert.equal(a.headers['Cache-Control'], 'no-cache, no-transform');
  assert.deepEqual(a.chunks, ['data: {}\n\n']);
  avisarCambioPaquetes();
  assert.deepEqual(a.chunks, ['data: {}\n\n', 'data: {}\n\n']);
  assert.deepEqual(b.chunks, a.chunks);
});

test('al cerrar una pestaña deja de recibir avisos', (t) => {
  const res = conectar(t);
  res.end();
  avisarCambioPaquetes();
  assert.equal(res.chunks.length, 1);
});

test('una conexión lenta o rota no impide notificar a las demás', (t) => {
  const lenta = conectar(t);
  const rota = conectar(t);
  const sana = conectar(t);
  lenta.write = () => false;
  rota.write = () => { throw new Error('socket cerrado'); };
  assert.doesNotThrow(avisarCambioPaquetes);
  assert.equal(lenta.destroyed, true);
  assert.equal(rota.destroyed, true);
  assert.equal(sana.chunks.length, 2);
});

test('el heartbeat mantiene la conexión sin provocar consultas de paquetes', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const res = conectar(t);
  t.mock.timers.tick(20_000);
  assert.equal(res.chunks.at(-1), ': keepalive\n\n');
});

test('la conexión se cierra cuando vence el token', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  const res = conectar(t, 1);
  t.mock.timers.tick(1000);
  assert.equal(res.writableEnded, true);
  avisarCambioPaquetes();
  assert.equal(res.chunks.length, 1);
});
