# Paquetería entre sucursales

Sistema de control de paquetería entre dos sucursales, con un botón **"Llamar"** que
establece una llamada de voz desde el navegador hacia la otra sucursal (similar a Meet o Teams).

Proyecto del curso de Arquitectura de Computadoras: servidor de base de datos, servidor de
aplicaciones y VoIP.

| Componente | Tecnología |
| --- | --- |
| Sistema operativo (2 VMs) | Ubuntu Server 26.04.1 LTS |
| Base de datos | PostgreSQL 18 |
| Servidor de aplicaciones | Node.js 22 + Express 5 |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| VoIP | Asterisk 22 (PJSIP) |
| Llamada desde el navegador | SIP.js (WebRTC sobre WSS) |

## Arquitectura

```bash
          Windows (anfitrión)  192.168.56.1
     ┌───────────────────────────────────────┐
     │  Navegador A (ext. 102)               │
     │  Navegador B (ext. 202)               │
     │  MicroSIP    (ext. 101)               │
     └───────┬───────────────────┬───────────┘
             │ HTTPS :3000       │ WSS :8089
             │ WSS :8089         │
   ┌─────────▼───────────┐   ┌───▼──────────────┐
   │ VM1 · sucursal-a    │   │ VM2 · sucursal-b │
   │ 192.168.56.10       │   │ 192.168.56.11    │
   │ PostgreSQL          │   │                  │
   │ Express + React     │   │ Asterisk         │
   │ Asterisk            │◄─►│                  │
   └─────────────────────┘   └──────────────────┘
        Trunk SIP (UDP 5060) + audio RTP
```

- **VM1 (Sucursal A, central):** base de datos, servidor de aplicaciones y Asterisk.
- **VM2 (Sucursal B):** Asterisk de la segunda sucursal.
- Las VMs usan dos adaptadores: **NAT** (internet) y **Solo anfitrión** (red fija `192.168.56.0/24`).

### Números de teléfono

| Extensión | Descripción |
| --- | --- |
| `100` | Número general de la Sucursal A (suena en el 101 y en el 102) |
| `101` | Softphone (MicroSIP) de la Sucursal A |
| `102` | Teléfono web (navegador) de la Sucursal A |
| `200` | Número general de la Sucursal B (suena en el 201 y en el 202) |
| `201` | Softphone de la Sucursal B |
| `202` | Teléfono web (navegador) de la Sucursal B |
| `600` | Prueba de eco local |
| `299` | Prueba de eco a través del trunk (se marca desde la Sucursal A) |

---

## Opción 1: probarlo con las máquinas virtuales (recomendado)

Es la forma más rápida: las VMs ya tienen todo instalado y configurado.

### Requisitos

- PC con procesador x86-64 (Windows, Linux o Mac con Intel/AMD). **No funciona en Macs con chip Apple Silicon (M1 o superior).**
- [VirtualBox 7](https://www.virtualbox.org/) o superior.
- Unos 8 GB de RAM (las dos VMs usan 5 GB) y unos 25 GB de disco libre.
- Virtualización activada en la BIOS (Intel VT-x o AMD SVM).
- Chrome o Edge. El micrófono solo funciona con HTTPS, por eso se usa un certificado propio (paso 6).

### Pasos

> Usuarios de las VMs: `admin-a` (VM1) y `admin-b` (VM2). Las contraseñas te las pasa el autor por mensaje, no están en este repositorio.

**1. Descarga** los dos archivos `.ova`.

**2. Revisa la red Host-Only de VirtualBox.** Ve a *Archivo > Herramientas > Administrador de red*, pestaña *Redes solo anfitrión*. Debe existir una con IPv4 `192.168.56.1` y máscara `255.255.255.0`. Si no existe, créala con esos valores. En PowerShell, `ipconfig` debe mostrar un adaptador con `192.168.56.1`.

**3. Importa las VMs.** *Archivo > Importar servicio virtualizado*, elige el `.ova`, marca **"Reinicializar la dirección MAC de todas las tarjetas de red"** e importa. Repite con el otro archivo.

**4. Revisa los adaptadores** de cada VM en *Configuración > Red*:

- Adaptador 1: **NAT**
- Adaptador 2: **Adaptador solo anfitrión** (elige la red del paso 2)

**5. Inicia las dos VMs** e inicia sesión. Verifica:

```bash
ip -br a                                            # VM1: 192.168.56.10  ·  VM2: 192.168.56.11
ping -c 3 192.168.56.11                             # desde la VM1
systemctl is-active postgresql paqueteria asterisk  # en la VM1: tres veces "active"
systemctl is-active asterisk                        # en la VM2
```

**6. Confía en el certificado (Windows).** Abre PowerShell **como administrador**:

```powershell
scp admin-a@192.168.56.10:certs/server.crt .
certutil -addstore -f Root server.crt
```

Cierra y vuelve a abrir el navegador. Cuando termines de probar, puedes quitarlo con
`certutil -delstore Root paqueteria-local`. Es un certificado de laboratorio y su clave viaja en las VMs, así que no lo dejes instalado de forma permanente.

> En Linux o Mac, importa `server.crt` en el navegador o acepta la advertencia visitando
> `https://192.168.56.10:3000`, `https://192.168.56.10:8089/httpstatus` y `https://192.168.56.11:8089/httpstatus`.

**7. Abre la aplicación:** <https://192.168.56.10:3000>. Debe tener candado.

**8. Inicia sesión** con uno de los usuarios (ver la sección *Usuarios y sesión*, más abajo) y elige la sucursal.

### Qué probar

1. **Acceso:** entra como administrador a la Sucursal A. Prueba también entrar con un empleado a la sucursal que no es la suya: el sistema lo rechaza.
2. **Paquetes:** registra uno (por ejemplo `PKG-001`, de A hacia B), ábrelo, cámbiale el estado y mira el historial, que muestra quién hizo cada cambio.
3. **Teléfono web:** debajo del botón amarillo debe decir *"Conectado como extensión 102"*. Pulsa *"Probar micrófono (eco)"* y acepta el permiso del micrófono: debes escucharte.
4. **Llamada entre sucursales:** abre otra **pestaña nueva** con la misma dirección (escribe la URL; no uses "Duplicar pestaña") e inicia sesión en la **Sucursal B**. Cada pestaña tiene su propia sesión. Desde A pulsa *"Llamar a Sucursal B"*; en la ventana B aparece la llamada entrante: *"Contestar"*.
5. **Con softphone (opcional):** instala [MicroSIP](https://www.microsip.org/), crea una cuenta con servidor `192.168.56.10`, usuario `101` y la contraseña que te pase el autor. Marca `200` o recibe llamadas del `100`.

Usa **audífonos**: ambas ventanas están en tu mismo equipo y, sin ellos, el audio se acopla.

### Usuarios y sesión

Para entrar hay que iniciar sesión con usuario, contraseña y la **sucursal** en la que se va a trabajar. La sesión dura 8 horas y es **por pestaña**: puedes tener una pestaña en la Sucursal A y otra en la B al mismo tiempo, y al cerrar la pestaña se cierra la sesión.

| Rol | A qué sucursales puede entrar |
| --- | --- |
| `admin` | A cualquiera de las dos |
| `empleado` | Solo a la suya |

Los usuarios los crea el administrador del sistema desde la VM1 (la contraseña se pide por pantalla y no se ve al escribirla; si el usuario ya existe, se cambia su contraseña):

```bash
cd ~/paqueteria/server
node scripts/crear-usuario.js admin "Administrador" admin
node scripts/crear-usuario.js ana "Ana (Sucursal A)" empleado 1
node scripts/crear-usuario.js luis "Luis (Sucursal B)" empleado 2
```

Las contraseñas te las pasa el autor por mensaje; no están en este repositorio.

### Actualizar VMs que ya importaste (para tener el login)

Si importaste las VMs antes de que existiera el login, actualízalas así. En Windows, desde la raíz del repositorio:

```powershell
git pull
powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
```

Luego, en la VM1:

```bash
cd ~/paqueteria/server
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env    # clave para firmar las sesiones
sudo systemctl restart paqueteria
node scripts/crear-usuario.js admin "Administrador" admin   # y los demás usuarios de arriba
```

La tabla de usuarios se crea sola al reiniciar el servicio; no hay que ejecutar SQL a mano.

---

## Opción 2: desarrollo en Windows

Edita el código en VS Code y despliega a la VM1. Necesitas Node 22 LTS, VS Code y el cliente OpenSSH (`ssh` y `scp`, incluidos en Windows 10 y 11).

```powershell
git clone
cd paqueteria
```

### Frontend (lo más común)

Usa el backend que corre en la VM1:

```powershell
cd client
npm install
copy .env.example .env      # ajusta VITE_API_PROXY si cambia la IP
npm run dev                 # http://localhost:5173
```

> Con `npm run dev` la página corre en `http://localhost`, que el navegador trata como contexto seguro. El micrófono funciona, pero el teléfono web necesita llegar al backend por HTTPS: `VITE_API_PROXY=https://192.168.56.10:3000`.

### Backend en Windows (opcional)

PostgreSQL solo escucha en la VM, así que se accede con un túnel SSH (deja la ventana abierta):

```powershell
ssh -N -L 5433:localhost:5432 admin-a@192.168.56.10
```

```powershell
cd server
npm install
copy .env.example .env      # DB_HOST=localhost, DB_PORT=5433, y la clave de la base de datos
npm run dev                 # http://localhost:3000
```

Para que el frontend use ese backend: `VITE_API_PROXY=http://localhost:3000` en `client/.env`.

### Desplegar a la VM1

Desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
```

Compila el frontend, sube `server/`, `client/dist` y `deploy/` a la VM1, instala dependencias y reinicia el servicio. El `.env` de la VM **nunca se sobrescribe**. Pide la contraseña de la VM varias veces. Para ver los registros: `journalctl -u paqueteria -f`.

---

## Opción 3: instalación desde cero en Ubuntu Server

Resumen de lo que hay en la VM1. Los comandos asumen el usuario `admin-a`.

### Base de datos

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'EOF'
CREATE USER paqueteria_user WITH PASSWORD 'CAMBIA_ESTA_CLAVE';
CREATE DATABASE paqueteria OWNER paqueteria_user;
EOF
PGPASSWORD='CAMBIA_ESTA_CLAVE' psql -h localhost -U paqueteria_user -d paqueteria -f database/schema.sql
```

No abras el puerto 5432: solo la aplicación (en la misma máquina) necesita la base de datos.

### Aplicación

```bash
sudo apt install -y nodejs npm            # Node 22 en Ubuntu 26.04
cd ~/paqueteria/server && npm ci --omit=dev
cp .env.example .env && nano .env         # clave de la base de datos y datos de VoIP
```

**Certificado HTTPS** (autofirmado, válido para las dos VMs):

```bash
mkdir -p ~/certs && cd ~/certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout server.key -out server.crt -subj "/CN=paqueteria-local" \
  -addext "subjectAltName=IP:192.168.56.10,IP:192.168.56.11"
chmod 600 server.key
```

En el `.env` del servidor agrega:

```bash
HTTPS_KEY=/home/admin-a/certs/server.key
HTTPS_CERT=/home/admin-a/certs/server.crt
```

### Servicio y firewall

```bash
sudo cp ~/paqueteria/deploy/paqueteria.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now paqueteria
sudo ufw allow 22/tcp && sudo ufw allow 3000/tcp
sudo ufw allow 5060/udp && sudo ufw allow 8089/tcp && sudo ufw allow 10000:20000/udp
sudo ufw enable
```

### Usuarios (el servicio ya creó la tabla al arrancar)

```bash
cd ~/paqueteria/server
node scripts/crear-usuario.js admin "Administrador" admin
```

**VoIP:** `sudo apt install -y asterisk` instala Asterisk 22. **La configuración de Asterisk
(`/etc/asterisk/pjsip.conf`, `extensions.conf`, `http.conf` y `rtp.conf`) no está incluida en este
repositorio:** vive dentro de las VMs. Para reproducirla desde cero, usa las VMs como referencia.

---

## Estructura del proyecto

```bash
paqueteria/
├── client/                      Frontend (React + Vite + Tailwind)
│   └── src/
│       ├── api/client.js        Todas las llamadas al backend
│       ├── hooks/               useLlamada.js (teléfono web con SIP.js), useTimbre.js
│       ├── components/          Login, Header, BotonLlamar, PaqueteForm, PaqueteList, PaqueteDetalle
│       ├── Panel.jsx            Pantalla principal de la sucursal
│       └── App.jsx              Decide entre el login y el panel
├── server/                      Backend (Express)
│   ├── server.js                Arranque, /api/health, sirve client/dist, HTTP o HTTPS
│   ├── auth.js                  Contraseñas (scrypt), tokens de sesión y middleware requireAuth
│   ├── db.js                    Conexión a PostgreSQL y creación de la tabla de usuarios
│   ├── routes/                  auth.js, paquetes.js, sucursales.js, voip.js
│   └── scripts/crear-usuario.js Crea usuarios o cambia su contraseña
├── database/schema.sql          Tablas y datos iniciales
├── deploy/
│   ├── deploy.ps1               Compila y sube a la VM1 desde Windows
│   └── paqueteria.service       Servicio systemd
├── docs/plan_de_accion.md
└── package.json                 Scripts: install:all, dev:client, dev:server, build
```

Para agregar una función: ruta nueva en `server/routes/`, función en `client/src/api/client.js` y componente en `client/src/components/`.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor y la base de datos (público) |
| GET | `/api/sucursales` | Lista de sucursales (público) |
| POST | `/api/auth/login` | Inicia sesión: `{ usuario, clave, sucursalId }`; devuelve el token (público) |
| GET | `/api/auth/me` | Datos de la sesión actual |
| GET | `/api/paquetes` | Paquetes que salen de la sucursal de la sesión o llegan a ella |
| GET | `/api/paquetes/:codigo` | Paquete con su historial (cualquier sucursal puede rastrearlo) |
| POST | `/api/paquetes` | Registra un paquete; el origen es siempre la sucursal de la sesión |
| PATCH | `/api/paquetes/:id/estado` | Cambia el estado; solo la sucursal de origen o de destino |
| GET | `/api/voip` | Configuración del teléfono web de la sucursal de la sesión |

Todas las rutas, salvo las marcadas como públicas, exigen la cabecera `Authorization: Bearer <token>`.

```bash
curl -k https://localhost:3000/api/health
curl -k https://localhost:3000/api/sucursales

# Con sesión (guarda el token y úsalo en las demás rutas)
curl -k -X POST https://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"usuario":"admin","clave":"TU_CLAVE","sucursalId":1}'
curl -k https://localhost:3000/api/paquetes -H "Authorization: Bearer EL_TOKEN"
```

## Puertos

| Puerto | Uso |
| --- | --- |
| 22/tcp | SSH |
| 3000/tcp | Aplicación y API (HTTPS) |
| 5060/udp | SIP (softphone y trunk) |
| 8089/tcp | WebSocket seguro de Asterisk (WebRTC) |
| 10000-20000/udp | Audio (RTP) |
| 5432/tcp | PostgreSQL, solo local (no se abre) |

## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `/api/health` responde `{"ok":false}` | El `.env` de la VM no tiene la contraseña correcta de la base de datos. Corrígelo y ejecuta `sudo systemctl restart paqueteria`. |
| El navegador dice "No seguro" | No confías en el certificado (paso 6), o la VM2 tiene un certificado distinto al de la VM1. Compara la huella: `sudo openssl x509 -in /etc/asterisk/keys/asterisk.crt -noout -fingerprint -sha256`. |
| La app no se ve desde Windows | Revisa que el Adaptador 2 sea *Solo anfitrión* y que `ping 192.168.56.10` responda. |
| "No se pudo conectar con la central telefónica" | Abre `https://192.168.56.10:8089/httpstatus` (y `.11` para la B) y revisa el candado. Si falla: `sudo systemctl restart asterisk`. |
| "No se pudo registrar la extensión" | La clave del `.env` (`VOIP_*_PASS`) no coincide con la de `pjsip.conf`. |
| Se oye el eco pero no hay audio entre sucursales | Revisa el trunk: `sudo asterisk -rx "pjsip show contacts"` debe mostrar `Avail`. |
| No suena el timbre | El navegador bloquea el sonido si no hubo un clic en la página. El aviso visual y el título de la pestaña sí funcionan. |
| "Usuario o contraseña incorrectos" | El usuario no existe o la contraseña es otra. Créalo o cambia su contraseña con `node scripts/crear-usuario.js` (ver *Usuarios y sesión*). |
| "Tu usuario no tiene acceso a esa sucursal" | Es un usuario `empleado` y eligió la sucursal que no es la suya. Usa la suya o un usuario `admin`. |
| "Tu sesión venció" | Pasaron 8 horas, o el servicio se reinició sin `JWT_SECRET` en el `.env` (usa una clave temporal). Agrégala y vuelve a iniciar sesión. |
| El login da "Error interno" | Mira `journalctl -u paqueteria -n 30 --no-pager`; suele ser la conexión a la base de datos. |
| Las IP de las VMs no son `192.168.56.x` | Tu red Host-Only usa otro rango. Ajusta `/etc/netplan/60-hostonly.yaml` y las IP del `.env` y de Asterisk. |

Para ver lo que ocurre en Asterisk en vivo: `sudo asterisk -rvvv`, y dentro `pjsip set logger on`.

## Seguridad: límites de este proyecto

Es un entorno de laboratorio. Para uso real habría que mejorar:

- El certificado es autofirmado; en producción se usaría una autoridad reconocida con un dominio.
- La clave del teléfono web llega al navegador; lo ideal son credenciales temporales por usuario.
- El trunk entre las dos centrales no va cifrado (faltaría SIP sobre TLS y SRTP).
- El inicio de sesión no limita los intentos fallidos (no hay bloqueo temporal) ni tiene recuperación de contraseña.
- La sesión se guarda en el navegador (`sessionStorage`) como un token de 8 horas; no hay forma de cerrarla desde el servidor.
- Sin un servidor TURN/STUN, WebRTC solo funciona dentro de la red local.

Las contraseñas de los usuarios se guardan con hash (scrypt), nunca en texto plano.

**No subas al repositorio** el `.env` ni claves o certificados (`.gitignore` ya excluye `.env`, `node_modules` y `client/dist`).
