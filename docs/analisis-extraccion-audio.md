# Extracción de información de audio desde un archivo MP3

## 1. ¿Qué significa “extraer información” de un archivo de audio?

Cuando un archivo MP3 se abre para análisis, no se está leyendo solo un conjunto de bytes: se está convirtiendo la señal comprimida a una representación analizable en tiempo real. En este proyecto, el flujo típico es:

1. El usuario sube un archivo `.mp3` o `.wav`.
2. El navegador lee el archivo como `File`.
3. Se valida el tipo y la extensión.
4. El contenido se convierte a una representación legible por el navegador.
5. Se aplica análisis de señal y, cuando está disponible, una capa de IA.

La idea es transformar la música en datos numéricos para detectar rasgos musicales, temporales y armónicos.

---

## 2. Cómo funciona la extracción en este proyecto

### 2.1 Carga y validación

El servicio principal se encuentra en `src/services/audioAnalysisService.ts`.

Primero se comprueba que el archivo sea un audio válido (`audio/mp3`, `audio/mpeg`, `audio/wav`, etc.) o que su nombre termine en `.mp3` o `.wav`.

Esto evita que el flujo continue con archivos no soportados y permite preparar el análisis con un conjunto de tipos admitidos.

### 2.2 Conversión a base64 y envío a IA

Cuando la infraestructura de IA está disponible, el archivo se convierte a base64 y se envía al endpoint `/api/analyze-audio`.

Ese proceso hace posible que el backend proporcione una inferencia musical más “semántica”, por ejemplo:

- tempo estimado
- tonalidad
- escala
- progresión de acordes
- sugerencias de letra y estructura

En otras palabras, la IA intenta interpretar el audio como una pieza musical, no solo como una onda.

### 2.3 Caída segura a análisis local con Web Audio API

Si la IA no responde o no está disponible, el sistema ejecuta un análisis local en el navegador usando la API Web Audio.

El archivo se decodifica con `decodeAudioData()`, que convierte el contenido MP3/WAV a un `AudioBuffer`. A partir de ahí ya se puede trabajar con muestras de audio en forma de números reales.

Esto es crucial porque la extracción no se hace sobre el formato comprimido original, sino sobre una versión PCM analizable.

---

## 3. Qué tipo de información se obtiene del audio

### 3.1 Duración del archivo

Se calcula a partir de la duración del `AudioBuffer`.

Esto permite saber cuánto dura la canción, y además ayuda a segmentar el análisis por secciones.

### 3.2 Tempo o BPM

La detección de tempo se basa en la envolvente de energía del audio y en una autocorrelación del patrón de pulsos.

Es decir, el sistema:

- toma una versión reducida de la señal,
- calcula la energía por tramos cortos,
- identifica momentos de ataque o “onsets”,
- compara periodicidades para estimar el BPM.

En el código esto se hace con una lógica de `detectBPM()`.

Resultado típico:

- 96 BPM
- 120 BPM
- etc.

Esto es útil para saber si la canción tiene un movimiento más lento, medio o rápido.

### 3.3 Tonalidad y escala

El análisis de armadura usa un enfoque de `chroma` o “pitch class profile”.

Se toma un fragmento del audio representativo, se mapea la energía a las 12 notas del círculo cromático y se compara esa distribución con perfiles de tonalidad mayor y menor.

Esto permite aproximar:

- tonalidad: `Am`, `C`, `G`, `F#`, etc.
- escala: `Menor` o `Mayor`

Es un cálculo de tendencia armónica, no una identificación “perfecta” en todos los casos.

### 3.4 Progresión de acordes

Una vez detectada la tonalidad, el sistema genera acordes diatónicos plausibles para la clave.

Por ejemplo, si la tonalidad es `Am`, el análisis puede sugerir progresiones como:

- Am - F - C - G
- Am - Dm - E7 - F

Lo que se guarda en el resultado es en realidad una aproximación musical útil para composición o revisión creativa.

### 3.5 Timestamps de acordes y estructura musical

El proyecto también crea una línea de tiempo de acordes con marcas de tiempo y secciones como:

- Intro
- Estrofa
- Estribillo

Esto permite que la aplicación muestre una estructura básica de la canción sin una transcripción detallada de cada nota.

### 3.6 Notas musicales y sugerencias de letra/acordes

La salida incluye cadenas de texto con observaciones interpretativas, por ejemplo:

- “Análisis de audio procesado por DSP local…”
- “Tonalidad detectada Am (Menor)”
- “Pulso rítmico estimado en 98 BPM”

También se genera una sugerencia de progreso armónico para las letras.

---

## 4. Qué información se obtiene realmente a nivel técnico

A nivel de procesamiento digital de señales, la extracción se puede resumir así:

- muestras de audio decodificadas
- energía por ventana temporal
- picos de ataque y onsets
- frecuencia dominante por segmento
- distribución por clases de tono
- correlación con perfiles de tonalidad
- estimación del tempo
- valoración de las notas más importantes del material musical

En términos prácticos, esa información sirve para construir algo cercano a una “ficha musical” del archivo.

---

## 5. Qué otra información se podría extraer

La extracción de audio no se limita a BPM, tonalidad y acordes. Hay mucha más información útil que podría añadirse.

### 5.1 Metadatos del archivo

Se pueden extraer datos como:

- nombre del archivo
- tamaño
- bitrate
- frecuencia de muestreo
- número de canales
- duración real exacta
- codec

Esto es útil para diagnosticar calidad y compatibilidad.

### 5.2 Forma de onda y espectrograma

También podrían extraerse:

- waveform view (forma de onda)
- spectrogram (espectrograma)
- distribución de energía por frecuencia
- energía por banda (bajo, medio, agudo)

Esto permite visualizar cómo “se ve” la música en frecuencia y no solo en tiempo.

### 5.3 Descriptores espectrales

Se pueden calcular métricas como:

- centroid spectral
- rolloff
- flatness
- bandwidth
- zero-crossing rate
- RMS energy

Estas medidas ayudan a distinguir tipos de sonido, ruido, timbre y textura.

### 5.4 Detección de intensidad y dinámica

Se puede medir:

- volumen promedio
- picos de intensidad
- cambios de energía
- dinámica de la canción
- momentos de silencio o respiro

Esto es útil para analizar la interpretación y la estructura de la pieza.

### 5.5 Segmentación por secciones

Se podrían detectar:

- intro
- verso
- pre-coro
- coro
- puente
- salida

Esto se hace normalmente con cambios de energía, ritmo y contenido armónico.

### 5.6 Transcripción de voz y letras

A un nivel más avanzado, se podría intentar:

- transcribir la voz humana
- detectar sílabas y palabras
- identificar letras aproximadas
- generar subtítulos o karaoke

Esto requiere modelos de reconocimiento automático de voz o ASR.

### 5.7 Separación de fuentes

También podría extraerse información sobre:

- voz principal
- batería
- bajo
- guitarra
- sintetizador/teclado
- ruido de fondo

Esto se logra con separación de fuentes o modelos de música inteligente.

### 5.8 Análisis emocional o de estilo

Se pueden extraer señales de:

- energía emocional
- intensidad emocional
- sensación de tensión o relajación
- género musical
- estilo evocado por el timbre y la estructura

Esto es útil para recomendar música, etiquetar pistas o analizar composición.

### 5.9 Identificación de instrumentos

Con representaciones de frecuencia y timbre, es posible detectar instrumentos aproximados, como:

- guitarra acústica
- piano
- batería
- bajo eléctrico
- sintetizador
- voz femenina o masculina

### 5.10 Embeddings musicales y búsqueda semántica

Un sistema más avanzado podría generar un vector de representación del audio para:

- buscar canciones parecidas
- comparar arreglos
- encontrar temas con características análogas
- clasificar por estilo o composición

---

## 6. Limites de la aproximación actual

La estrategia actual es muy útil para análisis rápido en navegador, pero tiene límites:

- no siempre detecta perfectamente la tonalidad en mezclas complejas
- la progresión de acordes es una hipótesis, no una transcripción exacta
- la señal se analiza como una mezcla global, no como fuentes separadas
- la detección de tempo puede fallar con ritmos irregulares o cambios de compás
- la IA puede aportar mejor contexto, pero depende de disponibilidad del backend

En otras palabras, la técnica actual es una estimación musical útil para composición y organización, no una validación definitiva de cada nota o acorde.

---

## 7. Resumen práctico

En este proyecto, la extracción de información de un MP3 se hace de la siguiente manera:

- el archivo se valida,
- se decodifica con Web Audio,
- se analizan señales como energía, ritmo y tono,
- se infiere tempo, tonalidad, escala y acordes,
- y se devuelve una estructura musical útil para la composición.

Además, el mismo enfoque podría ampliarse con muchas otras señales: espectrograma, metadatos, separación instrumental, transcripción, análisis emocional y más.

Eso convierte el audio en una fuente de datos útil no solo para escuchar, sino también para describir, clasificar y entender una canción.

---

## 8. Conclusión

La extracción de información de audio desde un archivo MP3 no es solo “leer un mp3”. En realidad, es un proceso de conversión de audio comprimido a señales analizables, y después de ese paso se pueden inferir atributos musicales relevantes para la creatividad y el análisis.

En este proyecto, la combinación entre IA y DSP permite obtener una primera capa de comprensión musical de forma bastante práctica, mientras que el abanico de posibilidades futuras es mucho más amplio si se desea profundizar en análisis más complejos.

---

## 9. Transcripción de letra (modo incremental)

El flujo de letra sincronizada incorpora tres caminos compatibles con la arquitectura actual:

1. **Carga manual de LRC** (modo principal recomendado en PWA estática): máxima estabilidad y control editorial.
2. **Transcripción local en navegador** con Whisper vía Web Worker (`?worker`) y aceleración WebGPU cuando esté disponible.
3. **Transcripción por backend opcional**, solo bajo consentimiento explícito del usuario antes de enviar audio fuera del dispositivo.

Límites reales en voz cantada:

- la precisión cae con reverberación, coros, doblajes vocales o mezcla instrumental densa;
- las marcas temporales son aproximadas y deben revisarse manualmente;
- sin WebGPU la experiencia local puede degradarse de forma importante (latencia y consumo de memoria).
