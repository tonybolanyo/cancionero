# 🛠️ Guía de Mantenimiento - Diccionario de Acordes

## Descripción General

El diccionario de acordes es un recurso que se genera automáticamente mediante un script basado en teoría musical estándar. Esta guía explica cómo mantener, actualizar y expandir el diccionario.

---

## 📂 Estructura de Archivos

```
cancionero/
├── data/
│   └── chord-dictionary.json          # Diccionario maestro
├── public/
│   └── data/
│       └── chord-dictionary.json      # Copia para producción
├── scripts/
│   └── expand-chord-dictionary.mjs    # Script de generación
├── docs/
│   └── CHORD_DICTIONARY_EXPANDED.md   # Documentación técnica
├── CHORD_DICTIONARY_EXPANSION_SUMMARY.md
├── CHORD_DICTIONARY_QUICK_REFERENCE.md
└── CHORD_DICTIONARY_MAINTENANCE.md    # Este archivo
```

---

## 🔄 Regenerar el Diccionario

### Método Recomendado (Automático)
```bash
npm run build
```
Esto ejecuta automáticamente:
1. `expand-chord-dictionary.mjs` - Genera `data/chord-dictionary.json`
2. Copia el archivo a `public/data/chord-dictionary.json`

### Método Manual
```bash
# Generar solo el diccionario
node scripts/expand-chord-dictionary.mjs

# Copiar a producción
cp data/chord-dictionary.json public/data/chord-dictionary.json
```

---

## ✏️ Modificar las Fórmulas de Acordes

Si deseas agregar nuevos tipos de acordes, edita el objeto `CHORD_FORMULAS` en:
**`scripts/expand-chord-dictionary.mjs`** (líneas ~50-100)

### Formato de Fórmula

```javascript
const CHORD_FORMULAS = {
  'major': { 
    intervals: [0, 4, 7],           // Semitonos desde la raíz
    name: 'Mayor',                  // Nombre legible
    category: 'triads'              // Categoría
  },
  'custom': { 
    intervals: [0, 4, 7, 11, 2],    // 1-3-5-7-9
    name: 'Custom',
    category: 'extended'
  }
};
```

### Intervalos Comunes

| Nombre | Intervalos | Notas |
|--------|-----------|-------|
| Triada Mayor | [0, 4, 7] | 1 - 3 - 5 |
| Triada Menor | [0, 3, 7] | 1 - b3 - 5 |
| Disminuido | [0, 3, 6] | 1 - b3 - b5 |
| Aumentado | [0, 4, 8] | 1 - 3 - #5 |
| Sus2 | [0, 2, 7] | 1 - 2 - 5 |
| Sus4 | [0, 5, 7] | 1 - 4 - 5 |
| 7 Dominante | [0, 4, 7, 10] | 1 - 3 - 5 - b7 |
| Mayor 7 | [0, 4, 7, 11] | 1 - 3 - 5 - 7 |
| Menor 7 | [0, 3, 7, 10] | 1 - b3 - 5 - b7 |
| Novena | [0, 4, 7, 10, 2] | 1 - 3 - 5 - b7 - 9 |

### Pasos para Agregar un Nuevo Tipo de Acorde

1. **Abrir el script**
   ```bash
   nano scripts/expand-chord-dictionary.mjs
   ```

2. **Encontrar `CHORD_FORMULAS`** (línea ~50)

3. **Agregar la nueva fórmula**
   ```javascript
   'sus2#5': { 
     intervals: [0, 2, 8], 
     name: 'Sus2 Aumentado', 
     category: 'sus' 
   },
   ```

4. **Regenerar el diccionario**
   ```bash
   node scripts/expand-chord-dictionary.mjs
   ```

5. **Verificar cambios**
   ```bash
   node -e "const d = require('./data/chord-dictionary.json'); console.log(Object.keys(d.chords).filter(c => c.includes('sus2#5')))"
   ```

---

## 🔍 Validar el Diccionario

### Script de Validación Rápida

```bash
node -e "
const data = require('./data/chord-dictionary.json');
console.log('Acordes:', Object.keys(data.chords).length);
console.log('Posiciones:', data.metadata.totalPositions);
console.log('Versión:', data.metadata.version);
"
```

### Validación Completa

```bash
node scripts/validate-chord-dictionary.mjs
```

### Verificar Acorde Específico

```bash
node -e "
const data = require('./data/chord-dictionary.json');
const chord = 'Cmaj7';
if (data.chords[chord]) {
  console.log(\`✓ \${chord} - \${data.chords[chord].positions.length} posiciones\`);
  console.log(JSON.stringify(data.chords[chord].positions[0], null, 2));
} else {
  console.log(\`✗ \${chord} no encontrado\`);
}
"
```

---

## 📊 Estadísticas del Diccionario

### Ver Estadísticas Generales

```bash
node -e "
const data = require('./data/chord-dictionary.json');
console.log('=== ESTADÍSTICAS ===');
console.log('Total de acordes:', data.metadata.totalChords);
console.log('Total de posiciones:', data.metadata.totalPositions);
console.log('Promedio pos/acorde:', (data.metadata.totalPositions / data.metadata.totalChords).toFixed(2));
console.log('Versión:', data.metadata.version);
"
```

### Ver Acordes por Nota

```bash
node -e "
const data = require('./data/chord-dictionary.json');
const byNote = {};
Object.keys(data.chords).forEach(chord => {
  const note = chord.match(/^[A-G]#?/)[0];
  byNote[note] = (byNote[note] || 0) + 1;
});
console.log(byNote);
"
```

---

## 🐛 Solucionar Problemas

### El diccionario JSON no es válido

```bash
# Validar JSON
node -e "try { require('./data/chord-dictionary.json'); console.log('✓ JSON válido'); } catch(e) { console.error('✗ Error:', e.message); }"
```

### Faltan acordes después de regenerar

```bash
# 1. Verificar que el script se ejecutó correctamente
node scripts/expand-chord-dictionary.mjs

# 2. Verificar que se copió a public/
cp data/chord-dictionary.json public/data/chord-dictionary.json

# 3. Verificar conteo
node -e "const d = require('./data/chord-dictionary.json'); console.log('Acordes:', Object.keys(d.chords).length)"
```

### Las posiciones no son correctas

Esto es normal si hay cambios en las fórmulas. Las posiciones se recalculan automáticamente basadas en:
- Fórmula de intervalos del acorde
- Afinación estándar de guitarra (E-A-D-G-B-E)
- Búsqueda de posiciones óptimas en el diapasón

---

## 🚀 Expandir a Otras Afinaciones

Para agregar soporte a otras afinaciones (Drop D, Open G, etc.):

1. **Crear variante del script**
   ```bash
   cp scripts/expand-chord-dictionary.mjs scripts/expand-chord-dictionary-drop-d.mjs
   ```

2. **Modificar `STANDARD_TUNING`**
   ```javascript
   // Drop D tuning: D-A-D-G-B-E
   const STANDARD_TUNING = [2, 5, 10, 3, 8, 1];
   ```

3. **Generar el diccionario**
   ```bash
   node scripts/expand-chord-dictionary-drop-d.mjs
   ```

---

## 📈 Mejoras Futuras

### Corto Plazo
- [ ] Agregar 7sus4, 7add13 chords
- [ ] Incluir enharmonic equivalents (C# = Db)
- [ ] Mejorar descripción de posiciones

### Mediano Plazo
- [ ] Acordes Slash (C/G, Am/E)
- [ ] Power Chords extendidos
- [ ] Acordes de guitarra clásica

### Largo Plazo
- [ ] Soporte para 7 y 8 cuerdas
- [ ] Audio samples para cada acorde
- [ ] Sugerencias inteligentes de transposición
- [ ] Análisis armónico automático

---

## 📚 Referencia de Categorías

```javascript
// En generateAllVariations()
const baseChords = [
  ['major', rootNote],
  ['minor', `${rootNote}m`],
  ['sus2', `${rootNote}sus2`],
  ['sus4', `${rootNote}sus4`],
  ['dim', `${rootNote}dim`],
  ['aug', `${rootNote}aug`],
];

const seventhChords = [
  ['7', `${rootNote}7`],
  ['maj7', `${rootNote}maj7`],
  ['m7', `${rootNote}m7`],
  ['m7b5', `${rootNote}m7b5`],
  ['dim7', `${rootNote}dim7`],
  ['minmaj7', `${rootNote}minmaj7`],
];

const extendedChords = [
  ['add9', `${rootNote}add9`],
  ['add11', `${rootNote}add11`],
  ['madd9', `${rootNote}madd9`],
  ['9', `${rootNote}9`],
  ['maj9', `${rootNote}maj9`],
  ['m9', `${rootNote}m9`],
];
```

---

## 🔐 Consideraciones de Producción

### Antes de Desplegar

1. **Regenerar el diccionario**
   ```bash
   npm run expand-chord-dictionary
   ```

2. **Validar completitud**
   ```bash
   npm run validate-chord-dictionary
   ```

3. **Verificar archivos**
   - `data/chord-dictionary.json` actualizado
   - `public/data/chord-dictionary.json` sincronizado
   - Metadatos correctos

4. **Hacer commit**
   ```bash
   git add data/chord-dictionary.json public/data/chord-dictionary.json
   git commit -m "chore: update chord dictionary to v3.x.x"
   ```

### Monitoreo Post-Despliegue

- Verificar que la aplicación carga correctamente
- Comprobar que se pueden cargar acordes desde servicios
- Validar que los diagramas se renderizan correctamente

---

## 📞 Soporte

Para problemas o preguntas:

1. **Revisar logs**
   ```bash
   npm run expand-chord-dictionary 2>&1 | tee chord-generation.log
   ```

2. **Verificar estructura del JSON**
   ```bash
   node -e "console.log(JSON.stringify(require('./data/chord-dictionary.json'), null, 2).slice(0, 500))"
   ```

3. **Consultar documentación**
   - `docs/CHORD_DICTIONARY_EXPANDED.md` - Referencia técnica
   - `CHORD_DICTIONARY_QUICK_REFERENCE.md` - Uso rápido
   - `CHORD_DICTIONARY_EXPANSION_SUMMARY.md` - Resumen de cambios

---

## 🎓 Versiones

| Versión | Fecha | Acordes | Posiciones | Cambios |
|---------|-------|---------|-----------|---------|
| 1.0.0 | 2024-xx-xx | 13 | ~40 | Versión original |
| 2.0.0 | 2026-xx-xx | 192 | 768 | Primera expansión |
| 3.0.0 | 2026-11-22 | 288 | 1,440 | Expansión completa |

---

## ✅ Checklist de Mantenimiento Mensual

```
[ ] Revisar solicitudes de nuevos acordes
[ ] Validar que el diccionario se genera correctamente
[ ] Comprobar que la copia a public/ funciona
[ ] Revisar bugs reportados
[ ] Actualizar documentación si es necesario
[ ] Hacer backup del diccionario actual
```

---

**Última actualización**: 2026-11-22  
**Estado**: Active Maintenance  
**Responsable**: Música/Teoría Musical
