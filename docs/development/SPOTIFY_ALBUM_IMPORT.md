# Importar Discos de Spotify

## Descripción General

La funcionalidad de **Importar Disco de Spotify** permite a los autores agregar múltiples canciones de un disco de Spotify directamente a la base de datos de Cancionero. Esta característica es ideal para:

- Incorporar nuevos álbumes completos al catálogo
- Evitar duplicar canciones existentes
- Mantener metadatos consistentes por disco
- Facilitar workflows de composición y producción

## Características

### 1. **Interfaz Modal Intuitiva**
- Accesible desde el botón "Importar Disco" en el modo autor
- Interfaz de dos etapas: URL de Spotify → Revisión de canciones

### 2. **Entrada Manual de Datos**
- Campo para URL de Spotify (para referencia)
- Nombre del disco
- Artista/Autor
- Año de lanzamiento
- Lista de canciones (una por línea)

### 3. **Detección Automática de Duplicados**
- Compara títulos con canciones existentes
- Utiliza slugify para normalizaciones consistentes
- Evita agregar canciones que ya existen en el sistema
- Muestra avisos visuales de canciones existentes

### 4. **Selección Flexible**
- Permite seleccionar/deseleccionar canciones individuales
- Muestra contador de canciones seleccionadas
- Desactiva opciones de canciones ya existentes

### 5. **Sincronización con GitHub**
- Guarda canciones en localStorage automáticamente
- Intenta sincronizar con GitHub si hay token disponible
- Genera commits descriptivos por canción

## Uso

### Para Autores

1. **Acceder a la función:**
   - Inicia sesión en modo autor
   - Busca el botón "Importar Disco" en la barra superior (junto a "Detector de Audio")

2. **Proporcionar información del disco:**
   ```
   URL: https://open.spotify.com/album/2OxjqlugoDnXgt3EbAdmRk
   Nombre: Cartas sin sello
   Artista: Tony Bolaño
   Año: 2024
   ```

3. **Pegar lista de canciones:**
   - Copia los títulos de Spotify
   - Pégalos en el campo "Canciones (una por línea)"

4. **Revisar y seleccionar:**
   - El sistema muestra las 15 canciones del disco
   - Deselecciona automáticamente canciones existentes
   - Elige cuáles importar

5. **Importar:**
   - Haz clic en "Importar N canciones"
   - Se guardarán como borradores (draft)
   - Se sincronizarán con GitHub si está autenticado

## Estructura de Datos

### Archivo de Canción Importada

```markdown
---
id: "me-quedo"
title: "Me quedo"
status: "draft"
year: 2024
genre: "Canción de Autor"
key: ""
tempo: 
timeSignature: ""
tuning: ""
duration: ""
spotifyUrl: "https://open.spotify.com/album/2OxjqlugoDnXgt3EbAdmRk"
notes: "Del disco 'Cartas sin sello' de Tony Bolaño"
tags: ["cartas-sin-sello", "acústico"]
createdAt: "2024-11-01T00:00:00.000Z"
updatedAt: "2024-11-01T00:00:00.000Z"
---

## Estrofa 1


## Estribillo
```

**Campos automáticos:**
- `id`: Generado por slugify del título
- `status`: Siempre "draft" para permitir edición
- `year`: Del disco
- `genre`: "Canción de Autor"
- `spotifyUrl`: URL del disco para referencia
- `notes`: Metadatos del disco
- `tags`: Incluye el slug del disco y "acústico"

## Componente React

### `SpotifyAlbumImportModal.tsx`

**Props:**
```typescript
interface SpotifyAlbumImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (songs: Song[]) => void;
  existingSongs: Song[];
}
```

**Funcionalidades:**
- Validación de URL de Spotify
- Parseo de lista de canciones
- Deduplicación automática
- Guardado en localStorage vía `StorageService.upsertSong()`
- Sincronización con GitHub vía `GitHubSyncService.pushSongFile()`

### Integración en App.tsx

```typescript
const [isSpotifyImportOpen, setIsSpotifyImportOpen] = useState<boolean>(false);

const handleOpenSpotifyImport = () => {
  if (!isAuthor) {
    setIsAuthModalOpen(true);
    return;
  }
  setIsSpotifyImportOpen(true);
};

const handleImportSongs = (importedSongs: Song[]) => {
  setSongs([...songs, ...importedSongs]);
  checkGitStatus();
};
```

## Flujo de Datos

```
Usuario → Modal → Parseo → Deduplicación → localStorage
                                              ↓
                                          GitHub
```

1. **Usuario proporciona:**
   - URL de Spotify (opcional)
   - Nombre del disco
   - Artista
   - Año
   - Lista de canciones

2. **Modal procesa:**
   - Slugifica títulos
   - Compara con `existingSongs`
   - Crea objetos `Song`

3. **Almacenamiento:**
   - `StorageService.upsertSong()` → localStorage
   - `GitHubSyncService.pushSongFile()` → GitHub (si autenticado)

## Casos de Uso

### Caso 1: Importar Álbum Completo
```
Spotify: https://open.spotify.com/album/2OxjqlugoDnXgt3EbAdmRk
Disco: Cartas sin sello
Artista: Tony Bolaño
Año: 2024
Canciones: 15 nuevas (sin duplicados)
```
**Resultado:** 15 canciones en estado draft, listas para ser editadas

### Caso 2: Importar Parcialmente
```
Disco: "Cartas sin sello" (17 canciones)
Canciones existentes: 2 (Algo quiere salir, Emilio y Dolores)
Canciones a importar: 15 seleccionadas
```
**Resultado:** Las 15 nuevas se agregan, las 2 existentes se saltan

## Mejoras Futuras

1. **Integración con Spotify API:**
   - Obtener automáticamente metadatos (duración, cover)
   - Descargar información de canciones
   - Sincronizar con playlists

2. **Bulk Operations:**
   - Importar múltiples discos en secuencia
   - Plantilla de metadatos por disco

3. **Enriquecimiento de Datos:**
   - Detectar tonalidad automáticamente
   - Sugerir género basado en Spotify
   - Incluir URLs de plataformas (YouTube, SoundCloud)

4. **Historial de Importaciones:**
   - Registrar qué discos se importaron
   - Facilitar actualizaciones/reversiónmisma

## Solución de Problemas

### Problema: "No se detectan las canciones"
**Solución:** Pega cada canción en una línea separada, sin numeraciones ni caracteres especiales.

### Problema: "Dice que la canción ya existe pero no la veo"
**Solución:** Las canciones existentes se comparan por título normalizado. Verifica que el nombre coincida exactamente.

### Problema: "No se guarda en GitHub"
**Solución:** Asegúrate de haber iniciado sesión con un token válido. Si tienes dudas, usa solo localStorage inicialmente.

## Referencias

- **Componente:** `/src/components/SpotifyAlbumImportModal.tsx`
- **Integración:** `/src/App.tsx` (líneas del modal)
- **Header:** `/src/components/Header.tsx` (botón de importación)
- **Servicios:** 
  - `StorageService.upsertSong()`
  - `GitHubSyncService.pushSongFile()`
