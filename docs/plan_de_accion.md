# Plan de acción: Servidor de BD + Servidor de Aplicaciones + VoIP

**Curso:** Arquitectura de Computadoras
**Proyecto:** Implementación de Servidor de Base de Datos, Servidor de Aplicaciones y VoIP para el control de paquetería
**Plazo:** 3 semanas (21 días)
**Estimación de esfuerzo:** 40 a 60 horas totales (unas 2 a 3 horas diarias)

---

## 1. Objetivo

Construir un sistema de control de paquetería entre dos sucursales, compuesto por:

1. Un **servidor de base de datos** (PostgreSQL).
2. Un **servidor de aplicaciones** (Node.js + Express sirviendo una app React).
3. Un servicio **VoIP** (Asterisk) con un botón **"Llamar"** en la app que establece una llamada de voz hacia la otra sucursal, similar a Meet o Teams.

## 2. Decisiones técnicas

| Componente | Elección | Motivo |
| --- | --- | --- |
| Sistema operativo | **Ubuntu Server 26.04.1 LTS**, 2 VMs | Asterisk se instala con `apt`, sin compilar |
| Base de datos | **PostgreSQL** | Ya la conocemos |
| Backend | **Node.js 22 LTS + Express** | Simple y rápido de desarrollar |
| Frontend | **React + Vite + Tailwind CSS** | Ya trabajamos con React |
| VoIP | **Asterisk (PJSIP)** | Recomendado por el catedrático |
| Llamada desde la web | **SIP.js (WebRTC)** | Voz desde el navegador, sin instalar nada |
| Virtualización | VirtualBox | Ya instalado |
| Red | Adaptador 1 NAT (internet) + Adaptador 2 Host-Only (IPs fijas 192.168.56.x) | Las VMs se ven entre sí y la red no cambia según la WiFi |

**Decisión de diseño importante:** se compila el frontend con `npm run build` y **Express sirve los archivos estáticos y la API desde un solo servidor**. Así se evita CORS y el HTTPS (obligatorio para WebRTC) se configura una sola vez.

## 3. Arquitectura

```bash
          Sucursal A (Central)                      Sucursal B
   ┌──────────────────────────────┐        ┌──────────────────────┐
   │ VM1  Ubuntu Server           │        │ VM2  Ubuntu Server   │
   │  - PostgreSQL                │        │  - Asterisk          │
   │  - Node/Express + React      │◄──────►│  - Extensiones 2xx   │
   │  - Asterisk (ext. 1xx)       │  Trunk │                      │
   └──────────────────────────────┘  PJSIP └──────────────────────┘
              ▲                                       ▲
        Navegador (WebRTC)                      Navegador (WebRTC)
```

- **Extensiones:** 1xx para Sucursal A (ej. 101), 2xx para Sucursal B (ej. 201).
- Las dos instancias de Asterisk se conectan con un **trunk PJSIP**.
- La app se sirve desde VM1. Según la sucursal del usuario, la app registra el navegador contra el Asterisk correspondiente.
- **Plan B si el trunk se complica:** usar un solo Asterisk en VM1 con las extensiones 101 y 201. Se sigue demostrando la llamada entre "sucursales", con menos configuración.

**Recursos y direcciones:**

| VM | Hostname | RAM | CPU | Disco | IP Host-Only |
| --- | --- | --- | --- | --- | --- |
| VM1 (Central) | `sucursal-a` | 3 GB | 2 | 25 GB | `192.168.56.10` |
| VM2 (Sucursal B) | `sucursal-b` | 2 GB | 1-2 | 25 GB | `192.168.56.11` |

La IP del host Windows en la red Host-Only suele ser `192.168.56.1`. Las IPs `.10` y `.11` quedan fuera del rango DHCP de VirtualBox (que empieza en `.100`).

## 4. Alcance de la aplicación

### Funciones mínimas

1. Registrar paquete (código, remitente, destinatario, sucursal origen y destino).
2. Actualizar estado (Recibido, En tránsito, Entregado).
3. Consultar paquete por código.
4. Listado de paquetes filtrado por sucursal.
5. Botón **"Llamar a sucursal"** (VoIP).

### Modelo de datos (borrador)

```sql
CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  extension_sip VARCHAR(10) NOT NULL
);

CREATE TABLE paquetes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE NOT NULL,
  remitente VARCHAR(100) NOT NULL,
  destinatario VARCHAR(100) NOT NULL,
  descripcion TEXT,
  sucursal_origen INT REFERENCES sucursales(id),
  sucursal_destino INT REFERENCES sucursales(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'Recibido',
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historial_estados (
  id SERIAL PRIMARY KEY,
  paquete_id INT REFERENCES paquetes(id),
  estado VARCHAR(20) NOT NULL,
  fecha TIMESTAMP DEFAULT NOW()
);
```

### API REST (borrador)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/paquetes` | Listar (filtro `?sucursal=`) |
| GET | `/api/paquetes/:codigo` | Consultar por código |
| POST | `/api/paquetes` | Registrar paquete |
| PATCH | `/api/paquetes/:id/estado` | Actualizar estado |
| GET | `/api/sucursales` | Listar sucursales y extensiones |

## 5. Distribución de tareas

| Persona | Responsabilidades |
| --- | --- |
| **A** | PostgreSQL, API Express, frontend React |
| **B** | VMs y red, Asterisk, trunk, certificados, SIP.js |
| **Ambos** | Componente `BotonLlamar`, pruebas, documentación, demostración |

## 6. Guía técnica rápida (Ubuntu Server)

### Red

- **Adaptador 1: NAT** (`enp0s3`, DHCP): da internet para `apt` y `npm`.
- **Adaptador 2: Solo anfitrión / Host-Only** (`enp0s8`, IP fija): comunica las VMs entre sí y con Windows.
- Archivo `/etc/netplan/60-hostonly.yaml` (aparte del de cloud-init, para que no se sobrescriba):

```yaml
network:
  version: 2
  ethernets:
    enp0s8:
      dhcp4: false
      addresses: [192.168.56.10/24]   # .11 en VM2
```

```bash
sudo chmod 600 /etc/netplan/60-hostonly.yaml
sudo netplan apply
ip -br a    # verificar
```

- Limitación: con Host-Only no se puede probar con un celular en la WiFi. Usar un softphone en Windows.

### Preparación de las VMs (base y clonación)

**En la VM1 (antes de clonar):**

```bash
sudo apt update && sudo apt upgrade -y && sudo reboot
# Después del reinicio: revisar el tamaño del volumen raíz
lsblk && df -h /
sudo vgs
# Si el VG tiene espacio libre, ampliar el volumen raíz:
sudo lvextend -r -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv
```

Luego apagar la VM, confirmar en VirtualBox que el Adaptador 2 está activo (Host-Only) y tomar el snapshot `base-limpia`.

**Clonar:** clic derecho en la VM > Clonar > nombre `sucursal-b` > *Clonación completa* > política de MAC: **Generar nuevas direcciones MAC para todos los adaptadores**.

**En la VM2 (primer arranque, con la VM1 apagada):**

```bash
sudo hostnamectl set-hostname sucursal-b
sudo sed -i 's/sucursal-a/sucursal-b/g' /etc/hosts
sudo rm -f /etc/machine-id /var/lib/dbus/machine-id
sudo systemd-machine-id-setup
sudo rm -f /etc/ssh/ssh_host_*
sudo dpkg-reconfigure openssh-server
# Crear /etc/netplan/60-hostonly.yaml con 192.168.56.11/24
sudo reboot
```

**Verificación:**

```bash
ping -c 3 192.168.56.11     # desde VM1
ping -c 3 192.168.56.10     # desde VM2
# Desde Windows (PowerShell): ssh admin-a@192.168.56.10
```

### Instalación de servicios

```bash
# Asterisk
sudo apt install -y asterisk
asterisk -V

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# Node.js 22 (viene en los repos de Ubuntu 26.04)
# Verificar con: node -v && npm -v
```

### Firewall (ufw)

```bash
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 5060/udp        # SIP
sudo ufw allow 10000:20000/udp # RTP (audio)
sudo ufw allow 8089/tcp        # WSS de Asterisk (WebRTC)
sudo ufw allow 3000/tcp        # App (o 443 si usan HTTPS)
sudo ufw enable
```

### Certificado autofirmado

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout server.key -out server.crt \
  -subj "/CN=IP_DE_LA_VM" -addext "subjectAltName=IP:IP_DE_LA_VM"
```

- Usarlo en Asterisk (`http.conf`, `tlsenable`, puerto 8089) y en Express (HTTPS).
- **Truco clave:** antes de probar, abrir en el navegador `https://IP:8089/ws` y **aceptar el certificado**. Si no, el WebSocket falla en silencio.

### Notas de WebRTC en Asterisk

- Endpoints PJSIP con `webrtc=yes` (activa ICE, DTLS-SRTP, rtcp-mux, etc.).
- Habilitar el transporte `wss` en `pjsip.conf`.
- Si hay problemas de audio entre VMs: revisar `ice_support`, la configuración de `rtp.conf` y que el rango RTP esté abierto.
- Para depurar: `sudo asterisk -rvvv` y `pjsip set logger on`.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| WebRTC o certificados bloquean el avance | Fase 1 con softphone ya funcionando como respaldo |
| Audio unidireccional o sin audio | Revisar rango RTP, ICE y red de la VM (NAT Network o Bridged) |
| Micrófono no disponible en el navegador | Probar en el navegador del host (Windows) y exigir HTTPS |
| Trunk entre Asterisk muy complejo | Plan B: un solo Asterisk con dos extensiones |
| Una VM se corrompe o se rompe la configuración | Snapshots antes de cada cambio grande |
| Retrasos acumulados | Hitos definidos y margen de 2 días al final |

## 8. Buenas prácticas del equipo

- Usar **Git** (GitHub) para el código, con commits frecuentes.
- **Snapshots** de las VMs antes de cada cambio grande.
- **Documentar mientras avanzan** (comandos y capturas), no al final.
- Guardar copias de los archivos de configuración (`pjsip.conf`, `extensions.conf`, `http.conf`, `rtp.conf`) en el repositorio.
