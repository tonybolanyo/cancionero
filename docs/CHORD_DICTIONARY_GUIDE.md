# Sistema de Diccionario de Acordes - Guía de Implementación

## 📋 Descripción General

Se ha implementado un **Sistema de Diccionario de Acordes** que permite:

1. ✅ Mostrar **múltiples posiciones** para cada acorde
2. ✅ Permitir que el usuario **seleccione qué posición usar**
3. ✅ Almacenar posiciones en un **archivo JSON** como base de datos
4. ✅ Mostrar información de **dificultad** y **descripción** de cada posición
5. ✅ Soportar **acordes extendidos de jazz** (6ª, 9ª, 13ª, alterados, etc.)
6. ✅ Incluir **voicings realistas** para guitarra en múltiples inversiones

## 🏗️ Estructura de Archivos

### Diccionario de Acordes
```
/data/chord-dictionary.json
/public/data/chord-dictionary.json (copia durante el build)
```

El diccionario contiene todas las posiciones de acordes en formato JSON:

```json
{
  "chords": {
    "C": {
      "positions": [
        {
          "name": "Posición I (Abierta)",
          "frets": [0, 3, 2, 0, 1, 0],
          "baseFret": 1,
          "barre": null,
          "difficulty": "easy",
          "description": "Posición abierta clásica"
        },
        {
          "name": "Posición II (Traste 3)",
          "frets": [3, 3, 2, 0, 1, 0],
          "baseFret": 1,
          "barre": null,
          "difficulty": "easy",
          "description": "Variación con cejilla parcial"
        },
        // ... más posiciones
      ]
    }
    // ... más acordes
  },
  "metadata": { /* ... */ }
}
```

### Servicios
- **`src/services/chordDictionaryService.ts`** - Carga y gestiona el diccionario
- Funciones principales:
  - `loadChordDictionary()` - Carga el diccionario desde JSON
  - `getChordPositions(chordName)` - Obtiene todas las posiciones de un acorde
  - `getChordPosition(chordName, positionIndex)` - Obtiene una posición específica
  - `hasMultiplePositions(chordName)` - Verifica si hay múltiples posiciones

### Hooks
- **`src/hooks/useChordPositions.ts`** - Hook para manejar las posiciones
  - Maneja la carga del diccionario
  - Gestiona la posición seleccionada
  - Proporciona estado de carga y errores

### Componentes
- **`src/components/ChordPositionSelector.tsx`** - Componente selector de posiciones
  - Muestra botones para cada posición
  - Muestra información de dificultad
  - Selector visual interactivo

- **`src/components/EnhancedChordDiagramCard.tsx`** - Componente mejorado de diagrama
  - Integra el soporte para múltiples posiciones
  - Fallback al componente original si no hay datos
  - Renderiza diagramas con la posición seleccionada

## 🚀 Cómo Usar

### 1. En un Componente React

```tsx
import { EnhancedChordDiagramCard } from '../components/EnhancedChordDiagramCard';

export function MiComponente() {
  return (
    <EnhancedChordDiagramCard
      chord="Am"
      instrument="guitar"
      showMultiplePositions={true}
      showPositionInfo={true}
    />
  );
}
```

### 2. Con el Hook Directamente

```tsx
import { useChordPositions } from '../hooks/useChordPositions';
import { ChordPositionSelector } from '../components/ChordPositionSelector';

export function MiComponente() {
  const { positions, selectedPosition, setSelectedPosition } = useChordPositions({ 
    chord: 'C' 
  });

  if (positions.length === 0) {
    return <div>No hay posiciones disponibles</div>;
  }

  return (
    <>
      <ChordPositionSelector
        positions={positions}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
      />
      
      {/* Usar la posición seleccionada */}
      <div>
        Frets: {positions[selectedPosition].frets.join(', ')}
      </div>
    </>
  );
}
```

### 3. Servicio Directo

```tsx
import { loadChordDictionary, getChordPositions } from '../services/chordDictionaryService';

async function buscarAcorde() {
  await loadChordDictionary();
  const positions = getChordPositions('G');
  console.log(positions);
}
```

## 📊 Estructura de Posición

```typescript
interface ChordPosition {
  name: string;              // Nombre de la posición (ej: "Posición I (Abierta)")
  frets: number[];          // Array de trastes por cuerda (-1=mudo, 0=abierto, >0=traste)
  baseFret: number;         // Traste base mostrado en el diagrama
  barre: number | null;     // Número de traste de cejilla (si aplica)
  difficulty: 'easy' | 'medium' | 'hard';  // Nivel de dificultad
  description: string;      // Descripción de la posición
}
```

## 🔧 Agregar Nuevos Acordes

Para agregar nuevos acordes al diccionario:

1. Editar `data/chord-dictionary.json`
2. Agregar una nueva entrada en la sección `chords`:

```json
{
  "Mi": {
    "positions": [
      {
        "name": "Posición I (Abierta)",
        "frets": [0, 2, 2, 1, 0, 0],
        "baseFret": 1,
        "barre": null,
        "difficulty": "easy",
        "description": "Posición abierta clásica"
      },
      // ... más posiciones
    ]
  }
}
```

3. Ejecutar `npm run build` para copiar el archivo a `public/`

## 🎯 Características

### Selector Visual de Posiciones
- Botones para cada posición con nombre y dificultad
- Resaltado de posición seleccionada
- Tooltips con descripciones

### Información de Dificultad
- **Fácil (Easy)**: Verde - Acordes abiertos, fáciles de tocar
- **Medio (Medium)**: Amarillo - Requieren cejilla o más coordinación
- **Difícil (Hard)**: Rojo - Cejillas complejas o posiciones altas

### Información de Posición
- Traste base del diagrama
- Span de trastes (rango)
- Indicador de cejilla
- Presencia de cuerdas abiertas o silenciadas

## 🏃 Integración en el Build

El script `copy-chord-dictionary.mjs` se ejecuta automáticamente en el build:

```bash
npm run build
```

Proceso:
1. `generate-version` - Genera versión
2. `generate-catalog` - Genera catálogo de canciones
3. **`copy-chord-dictionary`** ← Copia diccionario a `public/data/`
4. `vite build` - Compilación de Vite
5. `generate-robots` - Genera SEO
6. `generate-sitemap` - Genera sitemap

## 🎼 Acordes Extendidos de Jazz

Desde la v2.0.0, el diccionario incluye **180 nuevos acordes extendidos**, perfectos para jazz, fusion y géneros contemporáneos:

### Categorías Incluidas

#### 1. Acordes de 6ª (Sixths)
```
C6, Cm6, C6/9, Cm6/9 (y todas las notas)
```
- Sonoridad brillante y abierta
- Común en soul y jazz
- Dificultad: Easy-Medium

#### 2. Acordes de 13ª (Thirteenths)
```
C13, Cmaj13, Cm13 (y todas las notas)
```
- Máxima extensión armónica
- Muy usado en jazz moderno
- Dificultad: Hard

#### 3. Acordes Alterados (Alt Chords)
```
C7alt, C7#11, C9#11, Cmaj7#11 (y todas las notas)
```
- Crean tensión máxima
- Excelentes para resoluciones
- Lidia y modos alterados
- Dificultad: Hard

#### 4. Acordes Suspendidos Extendidos
```
C7sus4, C9sus4 (y todas las notas)
```
- Flotantes y modernos
- Perfectos para R&B y neo-soul
- Dificultad: Hard

#### 5. Half-Diminuidos (m7b5)
```
Cm7b5 (y todas las notas)
```
- Fundamental en jazz (ii en ii-V-I)
- Semidisminuido
- Dificultad: Medium-Hard

**Documentación completa**: Ver [JAZZ_EXTENDED_CHORDS.md](./JAZZ_EXTENDED_CHORDS.md)

**Ejemplos de uso**: Ver [JAZZ_EXTENDED_EXAMPLES.md](./JAZZ_EXTENDED_EXAMPLES.md)

### Búsqueda de Acordes Extendidos

Puedes buscar acordes por:
- **Nombre exacto**: "Cmaj13", "Am7b5"
- **Extensión**: "9#11", "maj13", "7alt"
- **Patrón**: "maj" (encuentra todos los major)

Todos los acordes tienen:
- ✅ Múltiples posiciones en trastes diferentes
- ✅ Información de dificultad (Easy/Medium/Hard)
- ✅ Descripciones de cada posición
- ✅ Voicings realistas para guitarra

### Estadísticas

| Métrica | Valor |
|---------|-------|
| **Total de acordes** | 468 |
| **Acordes extendidos nuevos** | 180 |
| **Tipos de extensión** | 15 |
| **Notas soportadas** | 12 |
| **Voicings por acorde** | 2-5 |

## 📱 Responsividad

Los componentes son completamente responsivos:

- **Escritorio**: Diagramas completos con información detallada
- **Tablet**: Diagramas medianos, selector compacto
- **Móvil**: Diagramas compactos, selector con scroll horizontal

Usar prop `compact={true}` para versiones pequeñas:

```tsx
<EnhancedChordDiagramCard
  chord="C"
  instrument="guitar"
  compact={true}
/>
```

## 🔄 Fallback

Si el diccionario no está disponible o carga falla:
- Se devuelve un diccionario vacío
- El componente muestra un diagrama del sistema actual
- No hay interrupción en la UX

## 📈 Próximas Mejoras Sugeridas

1. **Triadas**: Agregar posiciones de triadas (3 cuerdas)
2. **Diferentes afinaciones**: Soportar Drop D, DADGAD, etc.
3. **Editor visual**: Interfaz para agregar posiciones visualmente
4. **Base de datos**: Migrar a SQLite o Firebase
5. **Favoritos**: Guardar posiciones preferidas del usuario
6. **Videos**: Ligar videos tutoriales a cada posición
7. **Slash chords**: Acordes con bajos específicos (C/G, etc.)
8. **Polychords**: Acordes politónicos y complejos

## 🐛 Troubleshooting

### "No hay posiciones disponibles"
- Verificar que el acorde esté en `chord-dictionary.json`
- Revisar que el archivo se copió a `public/data/`
- Revisar console del navegador para errores de carga

### El diccionario no carga
- Verificar que `/public/data/chord-dictionary.json` existe
- Revisar en Developer Tools → Network → chord-dictionary.json
- Revisar console para errores

### Diagrama no se renderiza correctamente
- Verificar que los trastes están en rango válido (0-24)
- Revisar que el array de trastes tiene 6 elementos
- Validar que `baseFret` es >= 1

## 📚 Referencia Rápida

```typescript
// Cargar diccionario
await loadChordDictionary();

// Obtener posiciones
const positions = getChordPositions('C');

// Obtener una posición específica
const pos = getChordPosition('C', 0);

// Verificar si hay múltiples
const hasMultiple = hasMultiplePositions('Am');

// Obtener todos los acordes
const allChords = getAllChords();

// Colores de dificultad
const color = getDifficultyColor('medium'); // 'text-yellow-500'

// Buscar acordes extendidos
const jazzChords = getAllChords().filter(chord => 
  chord.includes('maj13') || chord.includes('7alt') || chord.includes('m7b5')
);
```

---

**Versión**: 2.0.0 (con acordes extendidos)  
**Última actualización**: 2026-11-22  
**Instrumento**: Guitarra (extensible a otros)
**Géneros soportados**: Jazz, Fusion, R&B, Neo-soul, Progressive
