# 🎸 Uso Rápido del Diccionario de Acordes

## Inicio Rápido (5 minutos)

### 1. Ver todas las posiciones de un acorde
```tsx
import { EnhancedChordDiagramCard } from '../components/EnhancedChordDiagramCard';

export function MiComponente() {
  return (
    <EnhancedChordDiagramCard
      chord="Am"
      instrument="guitar"
    />
  );
}
```

Verás:
- Diagrama del acorde
- Selector de posiciones (Posición I, II, III)
- Cambio automático del diagrama al seleccionar

### 2. Cargar lista de acordes disponibles
```tsx
import { getAllChords } from '../services/chordDictionaryService';

const chords = getAllChords();
// ['C', 'Am', 'G', 'D', 'E', 'A', 'F', 'Dm', 'Em', 'Gm', 'B', 'Bm']
```

### 3. Obtener datos de una posición
```tsx
import { getChordPosition } from '../services/chordDictionaryService';

const position = getChordPosition('C', 0); // Primera posición de C
// {
//   name: "Posición I (Abierta)",
//   frets: [0, 3, 2, 0, 1, 0],
//   baseFret: 1,
//   barre: null,
//   difficulty: "easy",
//   description: "Posición abierta clásica"
// }
```

---

## Ejemplos Comunes

### Mostrar selector de acordes
```tsx
import { useState } from 'react';
import { EnhancedChordDiagramCard } from '../components/EnhancedChordDiagramCard';

const QUICK_CHORDS = ['C', 'Am', 'G', 'D'];

export function QuickChordSelector() {
  const [selectedChord, setSelectedChord] = useState('C');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {QUICK_CHORDS.map(chord => (
          <button
            key={chord}
            onClick={() => setSelectedChord(chord)}
            className={`px-4 py-2 rounded font-bold ${
              selectedChord === chord
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {chord}
          </button>
        ))}
      </div>

      <EnhancedChordDiagramCard
        chord={selectedChord}
        instrument="guitar"
        showMultiplePositions={true}
      />
    </div>
  );
}
```

### Mostrar solo una posición específica
```tsx
import { getChordPosition } from '../services/chordDictionaryService';

export function SpecificChordPosition() {
  const position = getChordPosition('Am', 1); // Posición II

  if (!position) return <div>No encontrada</div>;

  return (
    <div>
      <h3 className="font-bold">{position.name}</h3>
      <p className="text-gray-600">{position.description}</p>
      <p>Dificultad: {position.difficulty}</p>
      <p>Trastes: {position.frets.join(', ')}</p>
    </div>
  );
}
```

### Listar todas las posiciones de un acorde
```tsx
import { getChordPositions, getDifficultyLabel } from '../services/chordDictionaryService';

export function AllChordPositions({ chord }: { chord: string }) {
  const positions = getChordPositions(chord);

  if (positions.length === 0) {
    return <div>No hay posiciones para {chord}</div>;
  }

  return (
    <ul className="space-y-2">
      {positions.map((pos, idx) => (
        <li key={idx} className="border p-3 rounded">
          <h4 className="font-bold">{pos.name}</h4>
          <p className="text-sm text-gray-600">{pos.description}</p>
          <p className="text-sm">
            Dificultad: <span className="font-bold">{getDifficultyLabel(pos.difficulty)}</span>
          </p>
          <p className="text-xs font-mono text-gray-500">
            {pos.frets.map((f, i) => f === -1 ? 'X' : f === 0 ? 'O' : f).join(' ')}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

---

## API Referencia Rápida

### Funciones del Servicio

| Función | Descripción | Retorna |
|---------|-------------|---------|
| `loadChordDictionary()` | Carga el diccionario | Promise<ChordDictionary> |
| `getChordPositions(chord)` | Todas las posiciones | ChordPosition[] |
| `getChordPosition(chord, idx)` | Posición específica | ChordPosition \| null |
| `hasMultiplePositions(chord)` | ¿Hay múltiples? | boolean |
| `getAllChords()` | Lista de acordes | string[] |
| `getDifficultyColor(diff)` | Clase CSS de color | string |
| `getDifficultyLabel(diff)` | Texto en español | string |

### Hook useChordPositions

```tsx
const {
  positions,           // ChordPosition[]
  selectedPosition,    // number (índice)
  setSelectedPosition, // (index: number) => void
  isLoading,          // boolean
  error,              // string | null
  hasMultiplePositions // boolean
} = useChordPositions({ chord: 'C' });
```

### Componentes

```tsx
// Componente mejorado (incluye selector)
<EnhancedChordDiagramCard
  chord="C"
  instrument="guitar"
  tuning="standard"
  showMultiplePositions={true}
  showPositionInfo={false}
  compact={false}
/>

// Selector de posiciones
<ChordPositionSelector
  positions={positions}
  selectedPosition={selectedPosition}
  onSelectPosition={setSelectedPosition}
  compact={false}
/>

// Información detallada de posición
<ChordPositionInfo
  position={position}
  compact={false}
/>
```

---

## Colores de Dificultad

```tsx
import { getDifficultyColor } from '../services/chordDictionaryService';

<span className={getDifficultyColor('easy')}>Fácil</span>
// → 'text-green-500'

<span className={getDifficultyColor('medium')}>Medio</span>
// → 'text-yellow-500'

<span className={getDifficultyColor('hard')}>Difícil</span>
// → 'text-red-500'
```

---

## Integrar en SongDetailPage

Ejemplo de cómo usar en la página de detalles de canción:

```tsx
import { EnhancedChordDiagramCard } from '../components/EnhancedChordDiagramCard';

export function SongDetailPage() {
  // ... código existente ...

  return (
    <div>
      {/* Cambiar esto */}
      {/* <ChordDiagramCard ... /> */}

      {/* Por esto */}
      <EnhancedChordDiagramCard
        chord={chord}
        instrument={instrument}
        tuning={tuning}
        showMultiplePositions={true}
        compact={false}
      />
    </div>
  );
}
```

---

## Troubleshooting

**P: No veo el selector de posiciones**
R: Asegúrate de que:
1. El acorde está en `chord-dictionary.json`
2. `showMultiplePositions={true}` está establecido
3. `instrument="guitar"` (solo soporta guitarra)

**P: "El diccionario no carga"**
R: Verifica:
1. `/public/data/chord-dictionary.json` existe
2. Revisar console del navegador (F12 → Console)
3. Revisar Network tab para ver si se carga el archivo

**P: ¿Cómo agregó más acordes?**
R: 
1. Edita `data/chord-dictionary.json`
2. Agrega un nuevo acorde con sus posiciones
3. Ejecuta `npm run build` para copiar a public/

**P: ¿Funciona offline?**
R: Sí, el diccionario se carga una sola vez y se cachea en memoria.

---

## Demo Page

Para ver una demostración interactiva:

1. Importar la página:
```tsx
import ChordDictionaryDemoPage from '../pages/ChordDictionaryDemoPage';
```

2. Agregar a rutas (si existe un router)
3. Visitar `/chord-dictionary-demo`

---

## ¿Necesitas ayuda?

Consultar documentación completa en: **`docs/CHORD_DICTIONARY_GUIDE.md`**

---

**Última actualización**: 22 Noviembre 2026  
**Versión**: 1.0.0
