# Nuevas Features de Escalas - Documentación

## Resumen

Se han implementado 4 características nuevas para mejorar significativamente la experiencia de aprendizaje de escalas en Cancionero:

1. ✅ **Selector de Nota Base**
2. ✅ **Sugerencias Automáticas de Escalas**
3. ✅ **Conexión con AudioAnalyzer**
4. ✅ **Quiz Interactivo**

---

## 1. Selector de Nota Base

### Ubicación
- Componente: `src/components/BaseNoteSelector.tsx`
- Integrado en: Tab "Explorador de Escalas" y Tab "Sugerencias Inteligentes"

### Funcionalidad
Permite seleccionar cualquier nota base (C, C#, D, D#, E, F, etc.) para:
- Visualizar cómo las escalas suenan en diferentes tonalidades
- Cambiar dinámicamente la visualización del diapasón
- Ver notación alternativa (sostenidos/bemoles)

### Uso
```typescript
import { BaseNoteSelector } from '../components/BaseNoteSelector';

<BaseNoteSelector
  selectedNote={baseNote}
  onNoteChange={setBaseNote}
  showSharps={true}
/>
```

---

## 2. Sugerencias Automáticas de Escalas

### Ubicación
- Servicio: `src/services/scaleSuggestionService.ts`
- Componente: `src/components/ScaleSuggestions.tsx`
- Tab: "Sugerencias Inteligentes"

### Funcionalidad

#### Sugerir por Tonalidad
```typescript
suggestScalesForKey('Am') // Escala Menor, Pentatónica Menor, etc.
suggestScalesForKey('C')  // Escala Mayor, Pentatónica Mayor, etc.
```

Retorna un array de sugerencias con:
- `scaleName`: Nombre de la escala
- `scaleId`: ID para seleccionar
- `confidence`: Confianza (0-1)
- `compatibility`: "perfect" | "good" | "fair"
- `reason`: Explicación

#### Sugerir por Progresión de Acordes
```typescript
suggestScalesForProgression(['C', 'F', 'G', 'Am'])
```

Analiza toda la progresión y devuelve escalas óptimas.

#### Sugerir por Acorde Individual
```typescript
suggestScalesForChord('Cmaj7')
```

---

## 3. Conexión con AudioAnalyzer

### Ubicación
- Hook: `src/hooks/useAudioScaleConnection.ts`
- Componente: `src/components/AudioToScale.tsx`

### Funcionalidad

El hook `useAudioScaleConnection` conecta automáticamente:
- Tonalidad detectada en el audio → Sugerencias de escala
- Acordes detectados → Sugerencias compatibles
- Ponderación inteligente: 60% basada en tonalidad, 40% en acordes

### Interfaz

```typescript
interface AudioToScaleData {
  key: string | null;              // Tonalidad detectada (ej: "Am")
  detectedChords: string[];         // Acordes encontrados
  suggestedScales: string[];        // Escalas recomendadas
  confidence: number;               // Confianza general
  baseNote: string | null;          // Nota base (ej: "A")
}
```

### Ejemplo de Uso

```typescript
const { audioScaleData, connectAudioToScales } = useAudioScaleConnection();

// Después de analizar audio
const result = await AudioAnalysisService.analyzeAudio(file);
await connectAudioToScales(result);

// Ahora audioScaleData contiene:
// - Tonalidad detectada
// - Acordes encontrados
// - Escalas sugeridas
// - Confianza de la predicción
```

---

## 4. Quiz Interactivo

### Ubicación
- Componente: `src/components/ScaleQuiz.tsx`
- Tab: "Quiz Interactivo"

### Tipos de Preguntas

1. **Identificar Escala**
   - Se muestra el patrón de intervalos
   - Opciones múltiples
   - Audio de la escala (sintetizado)

2. **Identificar Posición**
   - Se describe la posición en el diapasón
   - Pregunta por el nombre de la posición

3. **Identificar Intervalos**
   - Se pregunta cuántos intervalos tiene la escala

### Niveles de Dificultad
- 🟢 Fácil: Escalas básicas
- 🟡 Medio: Escalas comunes
- 🔴 Difícil: Escalas avanzadas

### Características
- Generación automática de 10 preguntas
- Puntuación en tiempo real
- Explicaciones después de cada respuesta
- Retroalimentación visual (correcto/incorrecto)
- Resumen con análisis de rendimiento

---

## Integración en la Página

### Tabs en ScaleDictionaryPage

#### Tab 1: 📚 Explorador de Escalas
- Selector de nota base
- Lista de escalas disponibles
- Visualización en diapasón
- Selector de posiciones

#### Tab 2: 💡 Sugerencias Inteligentes
- Selector de nota base avanzado
- Sugerencias de escalas por tonalidad
- Referencia rápida de progresiones comunes
  - Pop/Rock Clásico: C - F - G
  - Indie/Alternativo: Am - F - C - G
  - Folk/Acústico: Em - Am - D - G
  - Clásico Español: Dm - F - C - G

#### Tab 3: 🧠 Quiz Interactivo
- Selector de dificultad
- Preguntas aleatorias
- Puntuación y retroalimentación
- Resumen al finalizar

---

## Archivos Creados

```
src/components/
├── BaseNoteSelector.tsx          (57 líneas)
├── ScaleSuggestions.tsx          (163 líneas)
├── ScaleQuiz.tsx                 (450 líneas)
└── AudioToScale.tsx              (297 líneas)

src/services/
└── scaleSuggestionService.ts     (280 líneas)

src/hooks/
└── useAudioScaleConnection.ts    (110 líneas)

src/pages/
└── ScaleDictionaryPage.tsx       (actualizado)
```

---

## Ejemplos de Uso

### Usar en tu propia página

```typescript
import { BaseNoteSelector } from '../components/BaseNoteSelector';
import { ScaleSuggestions } from '../components/ScaleSuggestions';
import { AudioToScale } from '../components/AudioToScale';
import { ScaleQuiz } from '../components/ScaleQuiz';

// Selector de nota base
<BaseNoteSelector 
  selectedNote="C" 
  onNoteChange={handleNoteChange}
/>

// Sugerencias automáticas
<ScaleSuggestions
  sourceType="key"
  sourceValue="Am"
  onSelectScale={handleScaleSelect}
/>

// Análisis de audio con escalas
<AudioToScale
  onScaleSelected={(scaleId, baseNote) => {
    // Handle selection
  }}
/>

// Quiz interactivo
<ScaleQuiz
  onScaleSelect={(scaleId, position) => {
    // Navigate to scale
  }}
/>
```

---

## Características Técnicas

### Mapeo de Compatibilidad de Acordes-Escalas
El servicio utiliza un mapa completo de qué escalas funcionan mejor con cada tipo de acordes:

```typescript
{
  'major': { 'major': 0.95, 'majorPentatonic': 0.9, ... },
  'minor': { 'minor': 0.95, 'minorPentatonic': 0.9, ... },
  'dominant7': { 'mixolydian': 0.95, 'major': 0.8, ... },
  ...
}
```

### Ponderación Inteligente en AudioAnalyzer
Al conectar audio con escalas:
- 60% peso: Tonalidad detectada
- 40% peso: Acordes detectados
- Resultado: Las 5 mejores escalas con confianza calculada

### Audio Sintetizado en Quiz
El quiz puede reproducir audio de las escalas usando Web Audio API:
- Oscilador sine para notas puras
- Envolvente de ganancia (attack/decay)
- Duración configurable

---

## Testing

Ambas características se pueden probar inmediatamente:

1. **Ir a Escala Diccionario** → Tab "Explorador"
   - Cambiar nota base y ver el diapasón actualizar

2. **Ir a Escala Diccionario** → Tab "Sugerencias"
   - Seleccionar nota base
   - Ver sugerencias automáticas
   - Elegir una progresión de acordes

3. **Ir a Escala Diccionario** → Tab "Quiz"
   - Seleccionar dificultad
   - Responder preguntas
   - Ver puntuación y retroalimentación

4. **Usar AudioToScale** (en componentes que lo integren)
   - Subir archivo MP3/WAV
   - Ver tonalidad y acordes detectados
   - Recibir sugerencias de escalas automáticas

---

## Mejoras Futuras Posibles

1. **Grabación en Vivo**: Detectar tonalidad mientras grabas con micrófono
2. **Visualización de Intervalos**: Mostrar gráficamente los intervalos en la escala
3. **Modo Práctica**: Reproducir escalas y pedir que identifiques las notas
4. **Lecciones Progresivas**: Curso estructurado de escalas
5. **Exportación**: Generar PDF con patrones de escalas
6. **Sincronización**: Conectar con acordes y progresiones aprendidas

---

## Notas Importantes

- Todas las sugerencias son **recomendaciones**, no reglas
- El contexto musical es más importante que las estadísticas
- El sistema de ponderación puede ajustarse según necesidades
- El audio se sintetiza **localmente** en el navegador
- No se envía ningún dato a servidores para las sugerencias

---

Versión: 1.0
Fecha: 2024
Autor: Copilot SWE Agent
