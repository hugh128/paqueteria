-- Esquema de la base de datos "paqueteria" (PostgreSQL)
CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  extension_sip VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE paquetes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE NOT NULL,
  remitente VARCHAR(100) NOT NULL,
  destinatario VARCHAR(100) NOT NULL,
  descripcion TEXT,
  sucursal_origen INT NOT NULL REFERENCES sucursales(id),
  sucursal_destino INT NOT NULL REFERENCES sucursales(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'Recibido'
    CHECK (estado IN ('Recibido','En tránsito','Entregado')),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historial_estados (
  id SERIAL PRIMARY KEY,
  paquete_id INT NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_paquetes_origen ON paquetes(sucursal_origen);
CREATE INDEX idx_paquetes_destino ON paquetes(sucursal_destino);

INSERT INTO sucursales (nombre, extension_sip) VALUES
  ('Sucursal A (Central)', '100'),
  ('Sucursal B', '200');
