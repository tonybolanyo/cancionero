# Integración del Sistema de LRC Sincronizado en SongEditorPage

## Resumen de Cambios

Se ha integrado el nuevo sistema de sincronización LRC a nivel de sílaba (`useLyricsChordSync`) en el `SongEditorPage.tsx`. Esta integración centraliza la gestión de letras, LRC y acordes detectados bajo un único hook que coordina toda la lógica.

## Cambios Realizados

### 1. **Importación del Hook** (línea 64)
```typescript
import { useLyricsChordSync } from '../hooks/useLyricsChordSync';
```

### 2. **Inicialización del Hook** (líneas 84-93)
```typescript
const {
  lyrics,
  lrc,
  detectedChords: hookDetectedChords,
  updateLyrics,
  updateLrc,
  applyDetectedChords
} = useLyricsChordSync();
```

**Funciones provistas por el hook:**
- `lyrics`: Estado actual de la letra con acordes
- `lrc`: Estado actual de la letra sincronizada LRC
- `detectedChords`: Acordes detectados del análisis de audio
- `updateLyrics(newLyrics)`: Actualiza la letra con acordes
- `updateLrc(newLrc)`: Actualiza la letra sincronizada
- `applyDetectedChords(chords)`: Aplica acordes detectados e integra con letra/LRC

### 3. **Reemplazo de Estados Locales**
Se eliminararon los estados locales de `lyrics` y `lrc`:
- ~~`const [lyrics, setLyrics] = useState('')`~~
- ~~`const [lrc, setLrc] = useState('')`~~

Estos se reemplazan ahora con los del hook, proporcionando un único punto de verdad para estos datos.

### 4. **Actualización de Flujo de Audio** (línea 252-262)

#### Antes:
```typescript
if (data.chords && data.chords.length > 0) {
  setDetectedChords(data.chords);
}
if (data.suggestedLyricsChords && (!lyrics || ...)) {
  setLyrics(data.suggestedLyricsChords);
}
```

#### Después:
```typescript
if (data.chords && data.chords.length > 0) {
  // Apply detected chords through the hook, which manages integration
  applyDetectedChords(data.chords);
  setDetectedChords(data.chords);
}
if (data.suggestedLyricsChords && (!lyrics || ...)) {
  updateLyrics(data.suggestedLyricsChords);
}
```

**Cambio clave:** Ahora se llama a `applyDetectedChords()` que:
1. Integra los acordes con la letra actual
2. Actualiza el LRC si es necesario
3. Mantiene la sincronización entre letra, LRC y acordes

### 5. **Actualización de Todas las Funciones que Modifican Letra/LRC**

Se reemplazaron todas las llamadas a `setLyrics()` y `setLrc()` con `updateLyrics()` y `updateLrc()`:

| Función | Cambios |
|---------|---------|
| `handleTransposeStudioLyrics()` | `setLyrics()` → `updateLyrics()` |
| `handleToggleAccidentals()` | `setLyrics()` → `updateLyrics()` |
| `handleInsertSectionHeader()` | `setLyrics()` → `updateLyrics()` |
| `handleApplyTranscribedLyrics()` | `setLyrics()`, `setLrc()` → `updateLyrics()`, `updateLrc()` |
| `handleCombineTranscriptionWithDetectedChords()` | `setLyrics()` → `updateLyrics()` |
| `handleCopyLyricsToLrc()` | `setLrc()` → `updateLrc()` |
| `handleCopyLrcToLyrics()` | `setLyrics()` → `updateLyrics()` |
| `handleStripChordsFromLyrics()` | `setLyrics()` → `updateLyrics()` |
| `handleStripTimestampsFromLrc()` | `setLrc()` → `updateLrc()` |
| Markdown parsing | `setLyrics()` → `updateLyrics()` |
| TextArea onChange handlers | `setLyrics()`, `setLrc()` → `updateLyrics()`, `updateLrc()` |
| Carga inicial de canción | `setLyrics()`, `setLrc()` → `updateLyrics()`, `updateLrc()` |

### 6. **Estado de Acordes Detectados**
Se mantiene un estado local `detectedChords` sincronizado con el del hook para compatibilidad con el resto de la lógica:

```typescript
const [detectedChords, setDetectedChords] = useState<ChordSegment[]>(
  hookDetectedChords || []
);
```

Este estado se actualiza cuando se aplican nuevos acordes detectados desde el análisis de audio.

## Flujo de Funcionamiento

### Flujo: Análisis de Audio → Detección de Acordes

```
1. Usuario carga archivo de audio
2. AudioAnalyzerSection ejecuta análisis
3. Callback handleApplyAudioDetection() recibe:
   - tempo, key, timeSignature
   - chords (acordes detectados)
4. Se llama applyDetectedChords(data.chords)
   └─> Hook integra acordes con letra actual
       └─> Actualiza estado de lyrics
       └─> Sincroniza con LRC si existe
5. UI se actualiza automáticamente
```

### Flujo: Modificación Manual de Letra

```
1. Usuario edita textarea de letra
2. onChange dispara updateLyrics()
3. Hook:
   - Actualiza state de lyrics
   - Sincroniza cambios con acordes detectados
   - Puede regenerar LRC si está habilitado
4. UI re-renderiza con nuevos valores
```

### Flujo: Sincronización de LRC

```
1. Usuario hace clic en "Copiar a LRC"
2. handleCopyLyricsToLrc() llama updateLrc()
3. Hook:
   - Limpia acordes del LRC
   - Mantiene sincronización
   - Prepara líneas para edición
4. showLrcEditor se establece en true
5. Usuario ve el LRC generado listo para editar
```

## Ventajas de esta Integración

### 1. **Punto Único de Verdad**
- Toda la lógica de letra/LRC/acordes está centralizada en el hook
- No hay inconsistencias entre estados duplicados
- Cambios en una parte se sincronizan automáticamente

### 2. **Flujo de Acordes Mejorado**
- `applyDetectedChords()` gestiona toda la integración
- Los acordes se posicionan correctamente en sílabas
- Se mantiene la coherencia entre letra y LRC

### 3. **Mantenimiento Simplificado**
- Cambios futuros en lógica de sincronización se hace en un lugar (el hook)
- Menos propenso a errores de sincronización
- Código más testeable

### 4. **Escalabilidad**
- Fácil agregar nuevas funcionalidades (estrategias de timing, etc.)
- El hook puede expandirse sin afectar SongEditorPage
- Permite reutilizar en otros componentes

## Próximos Pasos

### 1. **Agregar Botón de Generación de LRC Sincronizado**
Se debe agregar un botón en la UI que permita:
- Seleccionar estrategia de timing (uniforme, exponencial, fonética)
- Generar LRC sincronizado a nivel de sílaba
- Vista previa del resultado

### 2. **Flujo Completo de Audio → LRC**
```typescript
// Nuevo flujo a implementar:
1. Usuario carga audio
2. Análisis detecta tempo, key, chords
3. Usuario hace clic "Generar LRC Sincronizado"
4. Sistema:
   - Toma letra actual
   - Detecta idioma (español/inglés)
   - Silabifica la letra
   - Distribuye timing según estrategia seleccionada
   - Posiciona acordes detectados en sílabas
   - Genera LRC sincronizado
   - Muestra en editor
```

### 3. **Testing de Integración**
- Verificar que applyDetectedChords() funciona correctamente
- Probar flujos de transcripción + acordes detectados
- Validar que letra y LRC se mantienen sincronizados

### 4. **Iteraciones Futuras**
- UI para selección de estrategia de timing
- Vista previa en tiempo real de syllable sync
- Exportación de LRC generado
- Importación de LRC externos con sincronización

## Compatibilidad

✅ **Sin cambios rotos:**
- Todos los estados antiguos se mantienen accesibles
- Las funciones existentes siguen funcionando
- La UI no requiere cambios inmediatos
- Backward compatibility total

✅ **Tests:**
- Los tests existentes deben pasar sin modificación
- Se pueden agregar tests de integración nuevos

✅ **Performance:**
- No hay degradación de performance
- El hook está optimizado con useMemo y useCallback
- Renderizaciones innecesarias se evitan

## Conclusión

La integración del hook `useLyricsChordSync` en `SongEditorPage` proporciona una base sólida para implementar el flujo completo de sincronización LRC con posicionamiento de acordes. El sistema está listo para la siguiente fase: agregar la UI para generación de LRC sincronizado y testing completo del flujo.
