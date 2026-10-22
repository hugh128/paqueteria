# Actualización de paquetes mediante SSE

Cada pestaña mantiene una conexión autenticada con Express para enterarse de
envíos y cambios de estado. Al recibir un aviso consulta de nuevo la lista y, si
hay un paquete abierto, su detalle e historial. Los filtros y los formularios se
conservan. El estado y los permisos siguen dependiendo de las rutas existentes.

## Contrato del canal

- `GET /api/eventos`, con `Authorization: Bearer <token>` de esa pestaña.
- Respuesta `text/event-stream; charset=utf-8`, sin caché ni buffering de proxy.
- Cada mensaje `data: {}\n\n` significa «vuelve a consultar los paquetes».
  Se envía a las sesiones conectadas sin incluir información del paquete; las
  consultas posteriores aplican los permisos normales de la API.
- Hay un aviso inicial en cada conexión, incluida cada reconexión. Así se
  recuperan los cambios que ocurrieron durante una desconexión.
- Se publica después del `COMMIT` del paquete y su historial, tanto en el envío
  como en el cambio de estado. Las operaciones rechazadas o revertidas no avisan.
- Cada 20 segundos se envía el comentario `: keepalive\n\n`. No provoca consultas
  de datos. El cliente reconecta si el canal termina, falla o pasa 45 segundos
  sin actividad, esperando 3 segundos entre intentos.
- El servidor cierra la conexión al vencer el token. Un `401` sigue el manejo
  habitual de sesión vencida; no se reintenta indefinidamente con ese token.
- Al salir del panel se cancela el stream y cualquier reconexión pendiente.

Se consume SSE con `fetch` porque `EventSource` nativo no permite añadir la
cabecera `Authorization`. El token sigue en `sessionStorage`, nunca en la URL.
No hay consultas periódicas de paquetes ni nuevas dependencias.

Referencias: [SSE en MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events),
[EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource),
[streams y cancelación con fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).

## Separación de la telefonía

SSE usa el servidor de aplicaciones en el puerto 3000. SIP.js mantiene su propia
conexión WSS con Asterisk en el 8089. Los avisos solo actualizan datos del panel:
no cambian las dependencias de `useLlamada`, no remontan `Header` ni
`BotonLlamar`, y no llaman a registrar, desconectar ni colgar. Cambiar de paquete
remonta únicamente su detalle.

Un fallo del canal muestra «Reconectando» junto a los paquetes. No cierra la
sesión por un fallo de red ni modifica el estado del teléfono. El vencimiento de
la sesión conserva el comportamiento habitual de cierre de sesión.

## Alcance

El canal funciona con el único proceso Express del servicio systemd actual. No
requiere cambios de esquema, puertos, certificados o configuración de Asterisk.
Los avisos cubren operaciones realizadas mediante esta API; cambios SQL directos
no generan avisos. Si se desplegaran varios procesos de aplicaciones haría falta
compartir las notificaciones entre ellos.

## Verificación

Desde la raíz: `npm test` y `npm run build`. Las pruebas usan el ejecutor de Node
y las dependencias existentes. La prueba de rutas utiliza HTTP real, autenticación
real y un sustituto de la conexión PostgreSQL; no modifica la BD de las VMs.

La verificación local de navegador se hizo con dos pestañas, datos aislados y un
sustituto de SIP.js: envío y recepción en vivo, actualización del historial abierto,
conservación de un formulario sin enviar y recuperación de un cambio ocurrido con
el canal cortado. El teléfono simulado mantuvo su llamada, con un registro y cero
bajas/desconexiones durante esas actualizaciones. Esto verifica el ciclo de vida
de los componentes, pero no sustituye una prueba de audio real con Asterisk.

Para validar en las VMs después del despliegue:

1. Abrir dos pestañas nuevas, con sesión en A y B. Comprobar «actualización en
   vivo activa» en ambas.
2. Establecer una llamada A → B y comprobar audio en ambos sentidos.
3. Con la llamada activa, enviar un paquete de A a B. Debe aparecer en B.
4. Abrir su detalle en ambas pestañas. Desde B marcarlo «Recibido» y después
   «Entregado». En A deben cambiar lista, progreso, aviso e historial sin recargar.
5. Escribir parte de otro envío y comprobar que las actualizaciones conservan el
   texto y el filtro. Confirmar que el audio y el botón de silenciar siguen funcionando.
6. Colgar desde cada extremo en llamadas separadas y probar rechazar otra llamada.
7. Cerrar sesión y comprobar que se cierra su petición `/api/eventos`.

El despliegue usa `deploy/deploy.ps1` como antes. Hacerlo sin una llamada en curso
y recargar las pestañas al terminar para cargar el nuevo frontend. El script reinicia
la aplicación, no Asterisk. Para volver a la versión previa basta desplegar el
código anterior; no hay migraciones de datos que revertir.
