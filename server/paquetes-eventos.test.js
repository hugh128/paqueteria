import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import express from 'express';
import { test } from 'node:test';
import { pool } from './db.js';
import { firmarToken, requireAuth } from './auth.js';
import { abrirEventos } from './eventos.js';
import paquetes from './routes/paquetes.js';

test('API: autentica SSE y solo avisa después de confirmar el paquete y el historial', async (t) => {
  const app = express();
  app.use(express.json());
  app.get('/api/eventos', requireAuth, abrirEventos);
  app.use('/api/paquetes', requireAuth, paquetes);
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const tokenA = firmarToken({ uid: 1, sucursalId: 1 });
  const tokenB = firmarToken({ uid: 2, sucursalId: 2 });
  const headers = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  const chunks = [];
  const res = new EventEmitter();
  Object.assign(res, {
    set() {}, flushHeaders() {}, destroy() {},
    write(texto) { chunks.push(texto); return true; },
  });
  abrirEventos({ auth: { exp: Date.now() / 1000 + 3600 } }, res);
  t.after(() => res.emit('close'));

  await t.test('rechaza acceso sin token y no acepta tokens en la URL', async () => {
    assert.equal((await fetch(`${url}/eventos`)).status, 401);
    assert.equal((await fetch(`${url}/eventos?token=${tokenA}`)).status, 401);
  });

  await t.test('con token entrega el tipo SSE y la sincronización inicial por HTTP', async () => {
    const abort = new AbortController();
    const respuesta = await fetch(`${url}/eventos`, { headers: headers(tokenB), signal: abort.signal });
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('Content-Type'), /text\/event-stream/);
    const reader = respuesta.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {}\n\n');
    abort.abort();
    await reader.cancel().catch(() => {});
  });

  let estado = 'En tránsito';
  let fallaHistorial = false;
  const consultas = [];
  t.mock.method(pool, 'connect', async () => ({
    async query(sql, valores) {
      consultas.push(sql);
      if (sql === 'COMMIT') assert.equal(chunks.length, 1, 'Todavía no debe publicar');
      if (sql.includes('INSERT INTO historial_estados') && fallaHistorial) throw new Error('historial fallido');
      if (sql.includes('INSERT INTO paquetes')) return { rows: [{ id: 1, estado, codigo: valores[0] }] };
      if (sql.includes('SELECT * FROM paquetes')) {
        return { rows: [{ id: 1, estado, sucursal_origen: 1, sucursal_destino: 2 }] };
      }
      if (sql.includes('UPDATE paquetes')) estado = valores[0];
      return { rows: [{ id: 1, estado }] };
    },
    release() {},
  }));

  await t.test('al crear notifica después de COMMIT', async () => {
    const respuesta = await fetch(`${url}/paquetes`, {
      method: 'POST', headers: headers(tokenA),
      body: JSON.stringify({ codigo: 'SSE-TEST', remitente: 'A', destinatario: 'B', sucursal_destino: 2 }),
    });
    assert.equal(respuesta.status, 201);
    assert.equal(chunks.length, 2);
    assert.ok(consultas.some((sql) => sql.includes('INSERT INTO historial_estados')));
    assert.equal(consultas.at(-1), 'COMMIT');
  });

  const cambiar = (token, nuevoEstado) => fetch(`${url}/paquetes/1/estado`, {
    method: 'PATCH', headers: headers(token), body: JSON.stringify({ estado: nuevoEstado }),
  });

  await t.test('el origen no puede recibir ni el destino saltar estados; no generan avisos', async () => {
    chunks.length = 1;
    assert.equal((await cambiar(tokenA, 'Recibido')).status, 403);
    assert.equal((await cambiar(tokenB, 'Entregado')).status, 409);
    assert.equal(chunks.length, 1);
    assert.equal(consultas.at(-1), 'ROLLBACK');
  });

  await t.test('el destino recibe y entrega; cada cambio confirmado avisa una vez', async () => {
    assert.equal((await cambiar(tokenB, 'Recibido')).status, 200);
    assert.equal(chunks.length, 2);
    chunks.length = 1;
    assert.equal((await cambiar(tokenB, 'Entregado')).status, 200);
    assert.equal(chunks.length, 2);
    assert.equal((await cambiar(tokenB, 'Recibido')).status, 409);
    assert.equal(chunks.length, 2);
  });

  await t.test('si falla el historial se revierte la operación y no se publica', async () => {
    estado = 'En tránsito';
    fallaHistorial = true;
    chunks.length = 1;
    assert.equal((await cambiar(tokenB, 'Recibido')).status, 500);
    assert.equal(consultas.at(-1), 'ROLLBACK');
    assert.equal(chunks.length, 1);
  });
});
