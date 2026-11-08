# 🎛️ Features

Características detalladas del proyecto y previsualizaciones.

## 📖 Contenidos

- **[FOOTER_PREVIEW.md](FOOTER_PREVIEW.md)** - Previsualización y guía del footer
- **[VIDEO_VISUALIZER.md](VIDEO_VISUALIZER.md)** - Generador de vídeo para YouTube y visualizador de audio Canvas

## 🎯 Características Principales

### 🎼 Visor de Acordes
- Alternador de posición de acordes (encima/en línea)
- Transposición tonal en tiempo real (+1/-1 semitono)
- Cálculo enarmónico inteligente
- Modo atril con auto-scroll regulable

### 🔍 Búsqueda
- Búsqueda instantánea multi-criterio
- Búsqueda por: título, versos, tonalidad, género, notas, año, etiquetas
- Atajos de teclado (`/` o `Ctrl+K`)

### 🎛️ Modos de Visualización
- **Tarjetas**: Vista visual con audio, extractos y etiquetas
- **Lista ampliada**: Filas detalladas con estrofas y notas
- **Lista comprimida**: Tabla densa de atril con BPM y columnas ordenables

### 🎧 Multimedia
- Reproductores integrados
- Enlaces a Spotify, YouTube, SoundCloud
- Soporte para maquetas de audio directo

### 📦 Git & Sincronización
- Commits con mensajes descriptivos
- Push automático/manual
- Contador de commits pendientes
- Registro de última sincronización

### 🏷️ Gestión de Archivos
- Renombrado de archivos `.md` desde la UI
- Migración automática en snapshots
- Commit/push inmediato del renombrado

### Detector de Audio y Armonia
- Analisis automatico de tempo (BPM)
- Deteccion de tonalidad y escala musical
- Deteccion de compas metrico
- Progresion de acordes segmentada en el tiempo
- Insercion automatica de acordes en las silabas exactas de la letra
- Persistencia del analisis acustico completo en el frontmatter Markdown de la cancion
- Insercion disponible tanto en el analisis inicial como en cualquier edicion posterior
- Funcion de deshacer (Undo) para revertir cambios en la letra
- Uso de IA (Gemini) o DSP nativo (Web Audio API)
- Seguro: sin credenciales en el codigo publico

### Seguridad
- Acceso de autor autenticado
- Personal Access Token (PAT) solo en navegador
- Verificacion directa contra API GitHub
- Tokens en sessionStorage o localStorage
- Repositorio 100% publico y seguro

## Documentacion Detallada

Para mas informacion sobre cada caracteristica:
- [LYRICS_SYNC_USER_GUIDE.md](../LYRICS_SYNC_USER_GUIDE.md) - Guia de usuario para insercion de acordes en silabas y sincronizacion
- [LYRICS_SYNC_TECHNICAL.md](../LYRICS_SYNC_TECHNICAL.md) - Arquitectura tecnica y persistencia SavedAudioAnalysis
- [../getting-started/](../getting-started/) - Guias de uso y atajos
- [../styling/](../styling/) - Personalizacion visual
- [../accessibility/](../accessibility/) - Accesibilidad
