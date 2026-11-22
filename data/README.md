# Diccionario de Escalas - Formato de Datos

## 📄 scale-dictionary.json

Este archivo contiene todas las escalas de guitarra disponibles en la aplicación Cancionero.

### Estructura General

```json
{
  "scales": {
    "escala-id": {
      "name": "Nombre visible",
      "description": "Descripción musical",
      "intervals": [0, 3, 5, 7, 10],
      "positions": [ /* array de posiciones */ ],
      "difficulty": "easy|medium|hard",
      "keyNotes": "Descripción de notas"
    }
  },
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2024-01-01T00:00:00Z",
    "instrument": "guitar",
    "tuning": "standard",
    "strings": ["E", "A", "D", "G", "B", "E"],
    "description": "Diccionario de escalas para guitarra",
    "fretsAvailable": 24,
    "categories": ["Pentatónicas", "Mayores/Menores", "Blues", "Modos", "Especiales"]
  }
}
```

## 🎸 Significado de Campos

### Escala (Scale Entry)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre visible en la UI (ej: "Pentatónica Menor") |
| `description` | string | Descripción musical y contexto de uso |
| `intervals` | number[] | Array de intervalos en semitonos desde la raíz |
| `positions` | object[] | Array de posiciones diferentes en el diapasón |
| `difficulty` | enum | "easy", "medium", o "hard" - nivel de aprendizaje |
| `keyNotes` | string | Descripción textual de los grados (1a, 2a, 3a, etc.) |

### Posición (Scale Position)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Identificador de la posición (ej: "Posición 1 (Cabeza)") |
| `rootFret` | number | Número de traste donde está la raíz |
| `notes` | object[] | Array de notas (cuerda + traste) |
| `shape` | string | Patrón de forma (ej: "E form", "G form", etc.) |
| `startFret` | number | Traste inicial del patrón |
| `endFret` | number | Traste final del patrón |
| `description` | string | Descripción de la posición |

### Nota (Scale Note)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `string` | number | Número de cuerda: 0=1ª(E), 1=2ª(A), 2=3ª(D), 3=4ª(G), 4=5ª(B), 5=6ª(E) |
| `fret` | number \| null | Número de traste (null = cuerda al aire o no se toca) |
| `isRoot` | boolean | true = nota raíz/tónica, false = otra nota de la escala |

### Metadatos (Metadata)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `version` | string | Versión del diccionario (semver) |
| `lastUpdated` | string | ISO 8601 timestamp de última actualización |
| `instrument` | string | "guitar" (guitarra) |
| `tuning` | string | Tipo de afinación ("standard" = E-A-D-G-B-E) |
| `strings` | string[] | Notas de las cuerdas abiertas |
| `description` | string | Descripción general del diccionario |
| `fretsAvailable` | number | Número de trastes mostrados en el visualizador |
| `categories` | string[] | Categorías/grupos de escalas |

## 📊 Ejemplo Completo

```json
{
  "scales": {
    "pentatonic-minor": {
      "name": "Pentatónica Menor",
      "description": "Escala pentatónica menor - la más usada en blues y rock",
      "intervals": [0, 3, 5, 7, 10],
      "positions": [
        {
          "name": "Posición 1 (Cabeza)",
          "rootFret": 0,
          "notes": [
            { "string": 0, "fret": null, "isRoot": false },
            { "string": 1, "fret": 3, "isRoot": false },
            { "string": 2, "fret": 3, "isRoot": false },
            { "string": 3, "fret": 2, "isRoot": false },
            { "string": 4, "fret": 3, "isRoot": false },
            { "string": 5, "fret": 0, "isRoot": true }
          ],
          "shape": "E form",
          "startFret": 0,
          "endFret": 5,
          "description": "Patrón de cabeza - posición abierta"
        }
      ],
      "difficulty": "easy",
      "keyNotes": "Raíz, 3ª menor, 4ª justa, 5ª justa, 7ª menor"
    }
  },
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2024-01-01T00:00:00Z",
    "instrument": "guitar",
    "tuning": "standard",
    "strings": ["E", "A", "D", "G", "B", "E"],
    "description": "Diccionario de escalas para guitarra",
    "fretsAvailable": 24,
    "categories": ["Pentatónicas", "Mayores/Menores", "Blues", "Modos", "Especiales"]
  }
}
```

## 🔄 Cómo Agregar una Nueva Escala

1. **Generar ID único**: `kebab-case-name` (ej: `harmonic-minor`)

2. **Crear la entrada**:
```json
"harmonic-minor": {
  "name": "Escala Menor Armónica",
  "description": "Descripción clara...",
  "intervals": [0, 2, 3, 5, 7, 8, 11],
  "positions": [ /* ... */ ],
  "difficulty": "hard",
  "keyNotes": "Raíz, 2ª mayor, 3ª menor, 4ª justa, 5ª justa, 6ª menor, 7ª mayor"
}
```

3. **Agregar posiciones**: Para cada forma del diapasón
```json
{
  "name": "Posición 1 (E form)",
  "rootFret": 0,
  "notes": [
    { "string": 0, "fret": 0, "isRoot": false },
    { "string": 1, "fret": 0, "isRoot": false },
    // ... resto de cuerdas
  ],
  "shape": "E form",
  "startFret": 0,
  "endFret": 5,
  "description": "Patrón E form en cabeza"
}
```

4. **Validar JSON**: Asegúrate de que sea válido
```bash
python3 -c "import json; json.load(open('data/scale-dictionary.json'))"
```

## 🎯 Estándares

### IDs de Escalas
- Formato: `kebab-case`
- Ejemplos: `pentatonic-minor`, `harmonic-minor`, `ionian`, `dorian`

### Dificultad
- `easy` = Principiantes (pentatónicas, básicas)
- `medium` = Intermedios (escalas de 7 notas)
- `hard` = Avanzados (modos, armónicas)

### Intervalos
- En semitonos desde la raíz
- Rango: 0-11 (octava)
- Ejemplo: [0, 2, 3, 5, 7, 8, 10, 12] = Menor Natural

### Trastes
- `startFret`: Mínimo traste que ocupa el patrón
- `endFret`: Máximo traste del patrón
- Rango típico: 0-24 trastes

### Cuerdas
- 0 = 1ª cuerda (mi agudo / high E)
- 1 = 2ª cuerda (si / B)
- 2 = 3ª cuerda (sol / G)
- 3 = 4ª cuerda (re / D)
- 4 = 5ª cuerda (la / A)
- 5 = 6ª cuerda (mi grave / low E)

## 📈 Escalas Actuales

- **Pentatónicas**: 2 (menor, mayor)
- **Mayores/Menores**: 3 (mayor, menor natural, menor armónica)
- **Blues**: 1
- **Modos**: 5 (Dórico, Frigio, Lidio, Mixolidio, Locrio)
- **Cromática**: 1

**Total**: 12 escalas con 21 posiciones

## 🔗 Integración

El archivo se carga en:
```typescript
// src/services/scaleDictionaryService.ts
const response = await fetch('/data/scale-dictionary.json');
const scaleDictionary = await response.json();
```

## 🧪 Validación

Validar con:
```bash
# TypeScript compilation
npm run lint

# JSON validation
python3 -c "import json; json.load(open('data/scale-dictionary.json'))"
```

## 📝 Control de Versiones

Cambiar en `metadata.version`:
- Patch (0.0.X): Correcciones de errores
- Minor (0.X.0): Nuevas escalas o posiciones
- Major (X.0.0): Cambios en la estructura

**Formato**: SEMVER (ej: "1.0.0")

---

**Fecha de creación**: 2024-01-01  
**Versión actual**: 1.0.0  
**Instrumento**: Guitarra (Afinación Estándar)
