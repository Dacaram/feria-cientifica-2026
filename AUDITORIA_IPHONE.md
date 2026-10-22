# Auditoría iPhone/PWA — 22 de octubre de 2026

Actualización posterior: la versión v5 permite usar la web sin instalar y exige preparar todos los recursos antes de mostrar la feria. Su comportamiento y sus pruebas actuales están en [PREPARACION_WEB.md](PREPARACION_WEB.md). Los resultados siguientes documentan la auditoría original de v3 y su corrección v4.

Publicación examinada: https://dacaram.github.io/feria-cientifica-2026/iphone/

Base examinada: commit `e568a34ebc97d6c451a7a4e3fe4110dbd7f7cecc`, caché `iphone-2026-v3`.

## Resultado

Se revisaron la portada, las siete páginas de módulos, sus referencias HTML/CSS/JS, nombres y mayúsculas, manifiestos, navegación, activación y service worker. Se descargaron por HTTPS los 148 recursos del manifiesto más el manifiesto y el worker: **150 respuestas HTTP 200**, todas idénticas a los archivos del repositorio base. No se encontraron rutas rotas en esos recursos.

HTTP 200 no garantiza que una imagen sea válida. La decodificación completa identificó un PNG dañado. También se encontraron un defecto visual en la tarjeta de Aterrizaje y un manejo incorrecto de errores en Defensa. Estos hallazgos no permiten asegurar que expliquen todos los síntomas del iPhone reportado.

## Hallazgos y cambios

1. **PNG dañado:** `iphone/Visuales/almendrino.png`, 720.896 bytes en la base. Su cabecera PNG es legible, pero libpng falla con `libpng read error` y WebKit rechaza `HTMLImageElement.decode()`. No tiene referencias de presentación actuales; sí figura en `recursos-offline.json`. Se reemplazó con el planeta Almendrino válido de `Modulos/Defensa/assets/planet.png`. Las copias Android no se modificaron.
2. **Ilustración casi ausente en la tarjeta Aterrizaje:** `iphone/index.html`, enlace `.experience.landing`, y `iphone/menu.css`, `.landing .card-space`. El fondo vertical se recorta con `object-fit:cover` y `object-position:center 30%`; la capa oscura oculta el suelo. No había una nave separada. Se ajustó el encuadre al suelo y se agregó la nave existente `Modulos/Aterrizaje/assets/lander.webp`, sin crear ni sustituir arte del juego.
3. **Nave demasiado oscurecida en la tarjeta Defensa:** `.card-ship` estaba bajo el degradado, con `z-index:-2`. Se subió sobre el fondo y se mantuvo el texto por delante. Comparación visual comprobada en capturas WebKit de 390 × 844 píxeles CSS.
4. **Defensa permite jugar con imágenes fallidas:** `iphone/Modulos/Defensa/index.html`, promesa `load` y su resolución. `im.onerror=()=>resolve()` permitía marcar `ready=true` aunque faltaran sprites. Se cambió a rechazo y pantalla de recuperación, sin botón de inicio hasta recargar correctamente. Una petición abortada deliberadamente a `ship.png` confirma el mensaje y la ausencia del botón de jugar.
5. **Distribución de cambios a instalaciones existentes:** `iphone/feria-config.js` cambia únicamente `cacheVersion` a `iphone-2026-v4`; se regeneraron los tamaños de `recursos-offline.json`. El worker usa caché primero y separa contenido por versión; mantener v3 habría conservado archivos antiguos. Esto es una condición de actualización, no evidencia de que la caché haya causado el incidente del usuario.

## Cobertura de módulos

| Módulo | Imágenes propias decodificadas sin red | Pantalla comprobada |
| --- | ---: | --- |
| Defensa | 11 | Presentación y comienzo de partida; error de sprite simulado |
| Aterrizaje | 11 | Presentación y comienzo de descenso |
| Peso espacial | 14 | Tarjetas completas al desplazarse; imágenes sustituidas por canvas de rotación |
| Edad planetaria | 11 | Presentación, fecha, explicación orbital, vuelo y llegada |
| Adivina el planeta | 10 | Presentación, inicio y respuesta con planeta revelado |
| Maqueta | 5 | Portada y estaciones con sus ilustraciones |
| Túnel del tiempo | 0 | Página, datos de las 23 estaciones y acceso a narraciones |

Se decodificaron además 14 imágenes compartidas de `Visuales/` e `icons/`: **76 imágenes en total**. Túnel utiliza ilustración CSS del portal; no contiene 23 fotografías que deban descargarse.

## Validación de la corrección

- WebKit 26.5 de Playwright en Windows, viewport móvil 390 × 844, táctil. No es Safari ejecutado en un iPhone físico.
- Siete módulos recorridos sin errores JavaScript ni respuestas HTTP de error durante las pruebas de interfaz.
- Descarga real mediante el botón de la PWA: 148 recursos guardados, ninguno ausente de la caché completa.
- Tras cortar todas las respuestas del servidor local, las siete páginas abren y sus imágenes se decodifican desde el service worker. La emulación `setOffline` de WebKit produjo un error interno; se utilizó el corte del servidor para verificar el almacenamiento real.
- Los 27 MP3 responden desde caché a `Range: bytes=0-99` con HTTP 206 y exactamente 100 bytes. Esta prueba verifica acceso parcial requerido por medios; no equivale a escuchar las 27 narraciones completas.
- Se mantienen los 23 registros de estaciones y todos los archivos MP3. No se modificaron el hash de activación ni `activationVersion`, ni APK, releases o fuentes Android.
- Se verificaron coincidencia de mayúsculas, existencia de referencias estáticas y cobertura de recursos offline. Los únicos archivos locales no incluidos son marcadores `.gitkeep` y los dos archivos de control excluidos intencionadamente por el generador (manifiesto de recursos y worker).

## Límites y pasos mínimos

Evidencias legibles por máquina en `auditoria/publicacion-base.json` y `auditoria/webkit-offline.json`. La comprobación de referencias y tamaños se reproduce con `node auditoria/validar-recursos.cjs` (Node sin dependencias). La prueba de navegador se reproduce con `node auditoria/probar-offline.cjs`, con el paquete `playwright` y su navegador WebKit instalados. Usa perfiles temporales y un servidor local; no escribe activaciones en la publicación.

No se reprodujo una desaparición general de imágenes de juegos en WebKit. No se probó un iPhone físico, una instalación real desde Compartir, la cámara del iPhone, todas las versiones antiguas de Safari, presión de memoria o expulsión de almacenamiento de iOS. Se usó un registro de activación de prueba exclusivamente en perfiles locales de navegador; no se cambió ni divulgó el contenido del QR.

Después de publicar la corrección: abrir la app con Internet, cerrarla y abrirla nuevamente para que tome el worker actualizado; pulsar **Guardar juegos y audios** y esperar **Todo listo sin Internet**. Probar después sin conexión la portada y las siete misiones en el iPhone afectado. No es necesario borrar la activación ni generar un QR nuevo. Si persiste una imagen ausente, registrar misión, pantalla, versión de iOS y captura para reproducir el caso exacto.
