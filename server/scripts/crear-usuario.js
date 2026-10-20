// Crea un usuario (o cambia su contraseña si ya existe).
//   node scripts/crear-usuario.js <usuario> "<nombre completo>" <admin|empleado> [sucursal_id]
// Ejemplos:
//   node scripts/crear-usuario.js admin "Administrador" admin
//   node scripts/crear-usuario.js ana "Ana (Sucursal A)" empleado 1
// La contraseña se pide por pantalla (no se ve al escribirla). Para automatizar: CLAVE=... node ...
import { hashClave } from '../auth.js';
import { pool, asegurarEsquema } from '../db.js';

const [usuarioArg, nombre, rol, sucursalArg] = process.argv.slice(2);

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

function pedirClave(pregunta) {
  return new Promise((resolve) => {
    process.stdout.write(pregunta);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let clave = '';
    const alEscribir = (texto) => {
      for (const c of texto) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', alEscribir);
          process.stdout.write('\n');
          return resolve(clave);
        }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f' || c === '\b') clave = clave.slice(0, -1);
        else clave += c;
      }
    };
    stdin.on('data', alEscribir);
  });
}

if (!usuarioArg || !nombre || !['admin', 'empleado'].includes(rol)) {
  salir('Uso: node scripts/crear-usuario.js <usuario> "<nombre completo>" <admin|empleado> [sucursal_id]');
}
const sucursalId = sucursalArg === undefined ? null : Number(sucursalArg);
if (rol === 'empleado' && !Number.isInteger(sucursalId)) {
  salir('Un empleado necesita el id de su sucursal (1 o 2).');
}

let clave = process.env.CLAVE;
if (!clave) {
  if (!process.stdin.isTTY) salir('No hay terminal interactiva: define la variable CLAVE.');
  clave = await pedirClave('Contraseña: ');
  const repetida = await pedirClave('Repite la contraseña: ');
  if (clave !== repetida) salir('Las contraseñas no coinciden.');
}
if (clave.length < 6) salir('La contraseña debe tener al menos 6 caracteres.');

try {
  await asegurarEsquema();
  await pool.query(
    `INSERT INTO usuarios (usuario, nombre, clave_hash, rol, sucursal_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario) DO UPDATE
       SET nombre = EXCLUDED.nombre, clave_hash = EXCLUDED.clave_hash,
           rol = EXCLUDED.rol, sucursal_id = EXCLUDED.sucursal_id`,
    [usuarioArg.trim().toLowerCase(), nombre, await hashClave(clave), rol, rol === 'admin' ? null : sucursalId]);
  console.log(`Usuario "${usuarioArg.toLowerCase()}" guardado (${rol}${rol === 'empleado' ? `, sucursal ${sucursalId}` : ''}).`);
} catch (e) {
  salir(`No se pudo guardar el usuario: ${e.message}`);
} finally {
  await pool.end();
}
