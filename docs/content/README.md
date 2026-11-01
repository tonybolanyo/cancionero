# 🎙️ Content

Gestión de contenido, metadatos y estructura de canciones.

## 📖 Recursos

Esta sección documenta cómo gestionar y organizar el contenido de canciones.

## 📁 Estructura de Contenido

```
songs/
├── cancion-1.md
├── cancion-2.md
└── ... (más canciones)

metadata.json       # Metadatos del cancionero
metadatos.json      # Equivalente en español
catalog.json        # Catálogo de canciones
```

## 🎵 Formato de Canción Markdown

Cada archivo `songs/*.md` debe seguir la estructura:

```markdown
---
title: "Título de la Canción"
artist: "Tu Nombre"
key: "Do"           # Tonalidad
tempo: 90           # BPM
meter: "4/4"        # Compás
genre: "Indie"      # Género
tags: ["tag1", "tag2"]
published: true
---

## Verso 1
Dm     G
Letra aquí
Em
Más letra

## Coro
Am
Estribillo
```

## 📊 Metadatos Globales

### metadata.json / metadatos.json
```json
{
  "title": "Cancionero de Versos Perdidos",
  "description": "Colección de canciones propias",
  "author": "Tu Nombre",
  "year": 2024,
  "license": "Creative Commons"
}
```

### catalog.json
Índice generado automáticamente de todas las canciones.

## 🔧 Gestión desde la UI

### Crear Nueva Canción
1. Click en "Nueva Canción"
2. Completa el formulario
3. Añade letra con acordes
4. Opcionalmente sube audio para análisis automático

### Editar Canción
1. Abre la canción
2. Click en "Editar"
3. Modifica los campos
4. Guarda

### Renombrar Archivo
1. Desde el visor: opción "Renombrar archivo"
2. Desde la tarjeta: menú contextual
3. Desde la tabla: opción de edición

### Sincronización Git
1. Los cambios se guardan localmente
2. Click en "Sincronizar" para commit/push
3. Se registran automáticamente en Git

## 🔍 Búsqueda Avanzada

Se puede buscar por:
- **Título** - Nombre exacto o parcial
- **Versos** - Contenido de letras
- **Tonalidad** - Do, Re, Mi, etc.
- **Género** - Rock, Pop, Jazz, etc.
- **Notas del autor** - Campos adicionales
- **Año** - Año de composición
- **Etiquetas** - Tags personalizados

## 📞 Véase también

- [../getting-started/QUICKSTART.md](../getting-started/QUICKSTART.md) - Primeros pasos
- [../development/](../development/) - Configuración técnica
