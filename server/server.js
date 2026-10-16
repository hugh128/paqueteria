import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import paquetes from './routes/paquetes.js';
import sucursales from './routes/sucursales.js';
import voip from './routes/voip.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    console.error('health:', e.message);
    res.status(500).json({ ok: false });
  }
});

app.use('/api/sucursales', sucursales);
app.use('/api/paquetes', paquetes);
app.use('/api/voip', voip);

// Frontend compilado (client/dist), servido por el mismo Express
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 3000;
const { HTTPS_KEY, HTTPS_CERT } = process.env;

if (HTTPS_KEY && HTTPS_CERT) {
  https
    .createServer({ key: fs.readFileSync(HTTPS_KEY), cert: fs.readFileSync(HTTPS_CERT) }, app)
    .listen(port, '0.0.0.0', () => console.log(`Servidor HTTPS en puerto ${port}`));
} else {
  app.listen(port, '0.0.0.0', () => console.log(`Servidor HTTP en puerto ${port}`));
}
