import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Crea lo que falte al arrancar, así una base creada antes del login se actualiza sola.
// (Es lo mismo que está en database/schema.sql para instalaciones nuevas.)
export async function asegurarEsquema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      usuario VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      clave_hash TEXT NOT NULL,
      rol VARCHAR(20) NOT NULL DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
      sucursal_id INT REFERENCES sucursales(id),
      creado_en TIMESTAMP DEFAULT NOW(),
      CHECK (rol = 'admin' OR sucursal_id IS NOT NULL)
    )`);
  await pool.query(
    'ALTER TABLE historial_estados ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id)');
  // Todo paquete nace "En tránsito" (lo registra la sucursal que lo envía)
  await pool.query("ALTER TABLE paquetes ALTER COLUMN estado SET DEFAULT 'En tránsito'");
}
