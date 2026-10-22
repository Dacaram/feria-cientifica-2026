# Acceso web y preparación de la feria

Versión: `iphone-2026-v5`.

La versión web funciona en el navegador de Android y de iPhone. Añadirla a la pantalla de inicio es opcional.

1. Al entrar, solo se muestra una pantalla ligera para activar el acceso con el QR original.
2. Después de activar, comienza automáticamente la descarga de los juegos, imágenes y audios. Se muestra «Preparando la feria…» con porcentaje.
3. La portada y las siete misiones permanecen dentro de una plantilla inactiva hasta que los 149 recursos estén guardados y se hayan decodificado las imágenes de la portada.
4. Una descarga interrumpida muestra «Reintentar preparación». Se conserva lo ya guardado.
5. Los enlaces directos a módulos también requieren activación y recursos completos. El service worker y el guard de cada página comprueban ambos requisitos.
6. Al regresar al mismo navegador se comprueban los archivos guardados y se conserva la activación. Si falta un archivo, se prepara de nuevo sin pedir el QR mientras su registro siga presente.

No hace falta mantener la página abierta una vez terminada la preparación. Durante la descarga inicial conviene mantenerla abierta para que el navegador pueda completarla. Borrar los datos del sitio, usar otro navegador o eliminarse el almacenamiento puede requerir otra activación o descarga. No se promete conservación indefinida de datos ni se presenta este control de interfaz como autenticación de servidor: el contenido continúa alojado en GitHub Pages.

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

APK Android, audios, estaciones y parámetros originales del QR no se modifican. La portada general de elección de teléfono conserva su diseño de una sola pantalla.
