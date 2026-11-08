# Generador de Video para YouTube y Visualizador

Guia tecnica y funcional sobre el generador de video y visualizador musical de Cancionero de versos perdidos.

## Resumen del Sistema

El generador de video permite transformar cualquier cancion del cancionero en una pieza audiovisual lista para publicar en YouTube o archivar en Google Drive. Combina renderizado en Canvas 2D en tiempo real con grabacion de audio y video mediante la API estandar `MediaRecorder`.

## Arquitectura de Captura y Grabacion

### 1. Captura de Video desde Canvas
- El visualizador dibuja a resolucion nativa en un elemento `<canvas>` (1080p, 720p o 360p).
- La captura se realiza con `canvas.captureStream(30)` garantizando una tasa constante de 30 fotogramas por segundo.
- Soporta cuatro temas visuales: Ambar calido, Minimalista noche, Papiro clasico e Imagen personalizada.
- Dispone de cuatro efectos de visualizacion espectral: Barras de espectro (FFT), Ondas de audio en tiempo real, Espectrograma radial y Disco de vinilo rotatorio con aguja.

### 2. Cadena de Audio Web Audio API
- **AudioContext**: Administra el procesamiento y enrutamiento de sonido. Se asegura su estado activo (`running`) antes de inicializar la grabacion.
- **MediaStreamDestinationNode**: Genera la pista de audio (`MediaStreamTrack`) que se combina con las pistas de video del Canvas en un `MediaStream` unificado.
- **Keep-Alive Source**: Conecta una fuente de nivel constante (`createConstantSource` o buffer de ceros) al nodo de grabacion. Esto evita que el multiplexor WebM/MP4 de Chromium quede bloqueado por falta de paquetes de audio, resolviendo el problema de archivos exportados con 0 MB.
- **MonitorGainNode**: Control de volumen de altavoces independiente. Permite silenciar la previsualizacion en el navegador sin silenciar la pista de audio que se esta grabando en el video final.

### 3. Modos de Audio Soportados

1. **Pistas de audio reales**:
   - Archivos subidos directamente por el usuario (`custom`).
   - Maquetas y grabaciones alojadas en Google Drive (`drive`).
   - Enlaces de audio web (`url`).
   - La etiqueta `<audio>` incluye `crossOrigin="anonymous"` y `playsInline`, garantizando la correcta lectura de muestras sin bloqueos de seguridad.

2. **Generador acustico procedimental (modo sintetico)**:
   - Cuando la cancion no dispone de un archivo de audio grabado, el sistema sintetiza un acompanamiento acustico basado en la tonalidad (`song.key`), tempo (`song.tempo`) y acordes diatonicos.
   - Utiliza osciladores con envolvente exponencial y filtro paso bajo que emulan un punteo acustico.
   - El analizador espectral recibe senal real, haciendo que las barras y particulas del visualizador reaccionen de manera ritmica al tempo de la cancion.

### 4. Seguimiento de Progreso y Detencion Automatica
- El estado de grabacion se supervisa mediante referencias sincronizadas (`isRecordingRef`, `durationRef`, `currentTimeRef`) para evitar cierres obsoletos en temporizadores de React.
- El porcentaje de progreso (`recordingProgress`) se actualiza continuamente del 0% al 100% tanto en modo de audio real como en modo sintetico.
- Al alcanzar la duracion de la cancion (`duration`), el sistema invoca automaticamente `stopRecording()`.
- La llamada a `requestData()` antes de `mediaRecorder.stop()` asegura que todos los fragmentos pendientes en memoria se emitan antes de ensamblar el `Blob` final.

### 5. Exportacion y Formatos
- Selecciona el mejor formato compatible con el navegador:
  - `video/webm;codecs=vp9,opus`
  - `video/webm;codecs=vp8,opus`
  - `video/webm;codecs=h264,opus`
  - `video/webm`
  - `video/mp4`
- Calculo y visualizacion precisa del peso del archivo generado en KB o MB mediante la utilidad `formatFileSize`.
- Descarga directa con nombres normalizados sin caracteres diacriticos (por ejemplo, `cancion-para-los-cuerdos-visualizador-1080p.webm`).
- Subida directa a Google Drive con un clic mediante `GoogleDriveService`.
