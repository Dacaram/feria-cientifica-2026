# Acceso web y preparación de la feria

Versión: `iphone-2026-v6`.

La versión web funciona en el navegador de Android y de iPhone. Añadirla a la pantalla de inicio es opcional.

1. Al entrar, solo se muestra una pantalla ligera para activar el acceso con el QR original.
2. Después de activar, comienza automáticamente la descarga de los juegos, imágenes y audios. Se muestra «Preparando la feria…» con porcentaje grande y cantidad recibida en KB o MB, actualizados mientras llegan datos.
3. La portada y las siete misiones permanecen dentro de una plantilla inactiva hasta que los 150 recursos estén guardados y se hayan decodificado las imágenes de la portada.
4. Una descarga interrumpida se reintenta automáticamente. Si no se recupera, muestra «Reintentar preparación». Se guardan bloques de 256 KiB y se solicita el resto mediante HTTP Range; no se reinician los archivos completos. Un bloque en curso que no alcanzó a guardarse puede repetirse.
5. Los enlaces directos a módulos también requieren activación y recursos completos. El service worker y el guard de cada página comprueban ambos requisitos.
6. Al regresar al mismo navegador se comprueban los archivos guardados y se conserva la activación. Si falta un archivo, se prepara de nuevo sin pedir el QR mientras su registro siga presente.

No hace falta mantener la página abierta una vez terminada la preparación. Durante la descarga inicial conviene mantenerla abierta para que el navegador pueda completarla. Borrar los datos del sitio, usar otro navegador o eliminarse el almacenamiento puede requerir otra activación o descarga. No se promete conservación indefinida de datos ni se presenta este control de interfaz como autenticación de servidor: el contenido continúa alojado en GitHub Pages.

## Corrección para datos móviles

La descarga inicial sigue siendo de unos 75,6 MB. Con una velocidad efectiva de 1 Mbit/s, solo transferir esos datos requiere unos 10 minutos, más la sobrecarga. No se promete un tiempo fijo.

La versión anterior empezaba descargando tres audios de 2,3 a 4 MB en paralelo, cancelaba cada archivo después de 45 segundos totales y no actualizaba el porcentaje hasta terminar un archivo. El límite podía cancelar una transferencia sana pero lenta, volver a descargarla y dejar el indicador en cero. Se reprodujo esa cancelación con el código original y un reloj acelerado; no se tienen trazas del teléfono del usuario para atribuirle una causa única.

Ahora el límite de 45 segundos mide falta de respuesta, no duración total: recibir datos mantiene la descarga activa. Los archivos se comprueban por tamaño y SHA-256 antes de guardarlos como completos. Se reutilizan archivos de versiones anteriores solo después de comprobar su hash. También se renueva la caché de arranque y se actualizan las pantallas antiguas para evitar mezclar código de dos versiones. Los errores distinguen conexión, falta de espacio y recursos inválidos.

El generador actual es `node auditoria/generar-recursos.cjs`. Genera tamaños y SHA-256 de los bytes que se publican con Git. Para una actualización, incrementa `cacheVersion`, ejecuta el generador después de modificar recursos de `iphone/` y comprueba el manifiesto contra los archivos preparados para el commit antes de publicar.

## Validación

Prueba reproducible: `node auditoria/probar-preparacion.cjs`, con Playwright y WebKit instalados. El alias `node auditoria/probar-offline.cjs` ejecuta la misma prueba.

- Perfil temporal de navegador, sin modo instalado: no se muestran juegos ni se solicitan imágenes de la feria, módulos o audios antes del QR.
- Activación simulada exclusivamente en ese perfil de pruebas; no se usa ni cambia el contenido del QR.
- Interrupción de una imagen: juegos bloqueados y descarga reanudable.
- Las siete misiones se habilitan al completar la preparación.
- Cierre y reinicio del navegador con el mismo perfil y el servidor desconectado: activación y recursos conservados.
- 76 imágenes decodificadas y 27 MP3 con respuestas parciales HTTP 206 desde caché; 23 estaciones intactas.
- Eliminación deliberada de una imagen guardada: acceso bloqueado y restaurado tras descargarla, conservando el QR.
- Perfil con identificación de navegador Android: acceso web sin requisito de instalación; el QR sigue siendo obligatorio.
- Actualización de v4 a v5 con recursos ya guardados: registro original de activación intacto y nuevo acceso bloqueado hasta completar la preparación. Resultado en `auditoria/actualizacion-v5.json`.

Resultados de las ejecuciones en `auditoria/preparacion-web.json` (WebKit) y `auditoria/preparacion-web-chromium.json` (Chrome). Se utilizaron navegadores de escritorio con pantalla y agentes de usuario móviles, no un iPhone físico. Para repetir en Chrome, establece `FERIA_BROWSER=chromium` y `FERIA_CHROME` con la ruta al ejecutable antes de ejecutar la prueba.

Pruebas de descarga:

- `node auditoria/probar-descarga.cjs`: reproduce el límite anterior y comprueba transferencias lentas, recuperación parcial, servidores sin Range, datos corruptos y falta de espacio. Resultado en `auditoria/descarga-unitaria.json`.
- `node auditoria/probar-datos-moviles.cjs`, con Playwright y `FERIA_CHROME`: servidor local que corta un audio y entrega el resto lentamente durante más de 45 segundos. La ejecución completó la descarga tras reanudar desde el byte 524.288, con porcentaje antes de terminar. Es una simulación, no una prueba en una red celular física. Resultado en `auditoria/datos-moviles.json`.
- Actualización v5 → v6: conserva el QR y reutiliza imágenes y audios anteriores sin descargarlos otra vez; resultado en `auditoria/actualizacion-v6.json`.

APK Android, audios, estaciones y parámetros originales del QR no se modifican. La portada general de elección de teléfono conserva su diseño de una sola pantalla.
