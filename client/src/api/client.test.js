import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, alSesionExpirada } from './client.js';

function sesion(t) {
  const datos = new Map([['paqueteria.token', 'token-de-prueba']]);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (clave) => datos.get(clave) ?? null,
      removeItem: (clave) => datos.delete(clave),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else delete globalThis.sessionStorage;
  });
  return datos;
}

test('SSE conserva Bearer en la cabecera y devuelve el stream sin consumirlo', async (t) => {
  sesion(t);
  const abort = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    assert.equal(url, '/api/eventos');
    assert.equal(opciones.headers.Authorization, 'Bearer token-de-prueba');
    assert.equal(opciones.signal, abort.signal);
    return new Response('data: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const res = await api.eventos(abort.signal);
  assert.equal(res.bodyUsed, false);
  assert.equal(await res.text(), 'data: {}\n\n');
});

test('un fallo de red de SSE conserva la sesión y no ejecuta su cierre', async (t) => {
  const datos = sesion(t);
  let cierres = 0;
  alSesionExpirada(() => cierres++);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('sin red'); });
  await assert.rejects(api.eventos(new AbortController().signal), /sin red/);
  assert.equal(datos.get('paqueteria.token'), 'token-de-prueba');
  assert.equal(cierres, 0);
});

test('SSE usa el manejo habitual de sesión vencida al recibir 401', async (t) => {
  const datos = sesion(t);
  let cierres = 0;
  alSesionExpirada(() => cierres++);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Sesión vencida' }, { status: 401 }));
  await assert.rejects(api.eventos(new AbortController().signal), { status: 401 });
  assert.equal(datos.has('paqueteria.token'), false);
  assert.equal(cierres, 1);
});
