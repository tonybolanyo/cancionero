# 🎵 Importar Discos de Spotify - Guía de Usuario

## ¿Qué es la función "Importar Disco"?

Es una herramienta que te permite **agregar todas las canciones de un disco de Spotify directamente a tu catálogo de Cancionero**. Perfecto para cuando quieres incorporar un álbum completo sin tener que crear cada canción manualmente.

## ¿Cómo accedo?

1. **Inicia sesión como autor** (botón "Acceso Autor" → GitHub)
2. Verás un botón nuevo en la barra superior: **"Importar Disco"**
3. Haz clic para abrir el modal de importación

## Paso a Paso: Importar un Disco

### Paso 1: Información del Disco
Completa estos campos:
- **Nombre del Disco** (ej: "Cartas sin sello")
- **Artista** (ej: "Tony Bolaño")
- **Año** (ej: 2024)
- **URL de Spotify** (opcional, para referencia)

### Paso 2: Lista de Canciones
Pega o escribe las canciones del disco, **una por línea**:
```
Me quedo
Cinco años y un faro
Boleros y verdades
Cartas sin sello
...
```

> **💡 Tip:** En Spotify, ve a los detalles del disco, copia los títulos de todas las canciones y pégalos aquí.

### Paso 3: Revisar
El sistema te mostrará:
- ✅ Las canciones nuevas (listas para importar)
- ⚠️ Las canciones que ya existen (no se duplicarán)
- Total de canciones a importar

### Paso 4: Importar
- Selecciona las canciones que quieres agregar
- Haz clic en **"Importar"**
- ¡Listo! Las canciones aparecerán como borradores

## ¿Qué pasa con las canciones importadas?

### Estado
Todas se crean como **"Borradores"** (draft status). Esto te permite:
- Editar detalles: tonalidad, tempo, acordes, letras
- Añadir información adicional
- Publicar cuando esté listo

### Metadatos Automáticos
Cada canción incluye:
- 📝 Título
- 📅 Año del disco
- 🎸 Género: "Canción de Autor"
- 🏷️ Tags: nombre del disco + "acústico"
- 🔗 URL de Spotify del disco

### Sincronización
Si has iniciado sesión con GitHub:
- Se guardan localmente automáticamente
- Se sincronizan al repositorio de GitHub
- Cada canción genera un commit descriptivo

## Ejemplo Real: "Cartas sin sello"

```
Disco: Cartas sin sello
Artista: Tony Bolaño
Año: 2024
Canciones: 17

⚠️ Canciones que ya existen:
  - Algo quiere salir
  - Emilio y Dolores (versión original)

✅ Canciones a importar:
  1. Me quedo
  2. Cinco años y un faro
  3. Boleros y verdades
  4. Cartas sin sello
  5. Canción para los cuerdos
  6. El andén de los invisibles
  7. Emilio y Dolores - Versión acústica
  8. Érase una vez
  9. Barco que no sabe flotar
  10. Blancanieves de oficina
  11. Agua que no se puede evitar
  12. Secreto al oído
  13. Frágil y valiente
  14. La cortesía del filo
  15. Danza de marionetas
```

## Preguntas Frecuentes

### ¿Puedo importar canciones que ya existen?
No, el sistema las detecta automáticamente. Verás un aviso indicando cuáles ya están en el catálogo.

### ¿Qué hago si cometo un error al importar?
Las canciones se guardan como borradores, así que puedes:
- Editarlas directamente
- Eliminarias si fue un error

### ¿Se guardan en GitHub automáticamente?
Sí, si has iniciado sesión. Si no quieres que se sincronicen, simplemente no inicies sesión.

### ¿Puedo importar desde cualquier disco de Spotify?
Claro, siempre que sea un disco público. El sistema es agnóstico del artista.

### ¿Cómo copio la lista de canciones de Spotify?
1. Abre el disco en Spotify
2. Selecciona todos los títulos de las canciones
3. Copia (Ctrl+C o Cmd+C)
4. Pega en el campo "Canciones" del modal

## Consejos Pro

✨ **Después de importar:**
1. Ve a la sección "Borradores" para ver las nuevas canciones
2. Haz clic en cada una para:
   - Agregar acordes
   - Editar la tonalidad
   - Escribir la letra completa
   - Añadir notas de composición
3. Cuando esté lista, cambia el status a "Publicada"

✨ **Organización:**
- Los tags del disco te ayudan a agrupar canciones
- Usa el filtro de tags para encontrar canciones del mismo disco
- Considera crear un borrador "Colección" con todos los discos importados

✨ **Workflow sugerido:**
1. Importa el disco completo
2. Edita cada canción (acordes, letras, metadatos)
3. Publica las que consideres listas
4. Mantén los borradores como notas de trabajo

## Soporte

Si tienes problemas:
1. Verifica que el disco sea público en Spotify
2. Asegúrate de que cada canción esté en una línea separada
3. Si algo no funciona, contacta al equipo de desarrollo

---

**¡A disfrutar organizando tu música en Cancionero! 🎵**
