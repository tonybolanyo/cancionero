#!/usr/bin/env node

/**
 * Script para generar un diccionario expandido de acordes de guitarra
 * Incluye 200+ acordes con múltiples posiciones cada uno
 * Basado en teoría musical estándar y patrones de guitarra
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chordDictionaryPath = path.join(__dirname, '../data/chord-dictionary.json');

// Notas cromáticas
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Fórmulas de acordes (semitonos desde la raíz)
const CHORD_FORMULAS = {
  // === Tríadas básicas ===
  'major': { intervals: [0, 4, 7], name: 'Mayor', category: 'triads' },
  'minor': { intervals: [0, 3, 7], name: 'Menor', category: 'triads' },
  'dim': { intervals: [0, 3, 6], name: 'Disminuido', category: 'triads' },
  'aug': { intervals: [0, 4, 8], name: 'Aumentado', category: 'triads' },
  
  // === Sus chords ===
  'sus2': { intervals: [0, 2, 7], name: 'Sus2', category: 'sus' },
  'sus4': { intervals: [0, 5, 7], name: 'Sus4', category: 'sus' },
  
  // === Séptimas ===
  '7': { intervals: [0, 4, 7, 10], name: 'Séptima Dominante', category: 'seventh' },
  'maj7': { intervals: [0, 4, 7, 11], name: 'Séptima Mayor', category: 'seventh' },
  'm7': { intervals: [0, 3, 7, 10], name: 'Menor Séptima', category: 'seventh' },
  'm7b5': { intervals: [0, 3, 6, 10], name: 'Semidisminuido', category: 'seventh' },
  'dim7': { intervals: [0, 3, 6, 9], name: 'Disminuido Séptima', category: 'seventh' },
  'minmaj7': { intervals: [0, 3, 7, 11], name: 'Menor Mayor Séptima', category: 'seventh' },
  
  // === Add chords ===
  'add9': { intervals: [0, 4, 7, 2], name: 'Add9', category: 'add' },
  'add11': { intervals: [0, 4, 7, 5], name: 'Add11', category: 'add' },
  'madd9': { intervals: [0, 3, 7, 2], name: 'Menor Add9', category: 'add' },
  
  // === Noventas ===
  '9': { intervals: [0, 4, 7, 10, 2], name: 'Novena', category: 'extended' },
  'maj9': { intervals: [0, 4, 7, 11, 2], name: 'Novena Mayor', category: 'extended' },
  'm9': { intervals: [0, 3, 7, 10, 2], name: 'Novena Menor', category: 'extended' },
  
  // === Alterados ===
  '7#5': { intervals: [0, 4, 8, 10], name: 'Séptima #5', category: 'altered' },
  '7b5': { intervals: [0, 4, 6, 10], name: 'Séptima b5', category: 'altered' },
  '7#9': { intervals: [0, 4, 7, 10, 3], name: 'Séptima #9', category: 'altered' },
  '7b9': { intervals: [0, 4, 7, 10, 1], name: 'Séptima b9', category: 'altered' },
  
  // === Power chords ===
  '5': { intervals: [0, 7], name: 'Power Chord', category: 'power' },
};

// Afinación estándar (semitonos desde C)
const STANDARD_TUNING = [0, 5, 10, 3, 8, 1]; // E-A-D-G-B-E

/**
 * Obtiene la nota en un traste específico
 */
function getNoteAtFret(stringIndex, fretNumber) {
  if (fretNumber < 0) return null;
  const noteIndex = (STANDARD_TUNING[stringIndex] + fretNumber) % 12;
  return NOTES[noteIndex];
}

/**
 * Genera posiciones para un acorde
 */
function generateChordPositions(rootNote, formula, chordName) {
  const positions = [];
  const requiredNotes = formula.map(interval => {
    const idx = (NOTES.indexOf(rootNote) + interval) % 12;
    return NOTES[idx];
  });

  // Buscar hasta 5 posiciones en diferentes trastes
  for (let baseFret = 0; baseFret <= 14 && positions.length < 5; baseFret++) {
    const frets = [];
    let hasBarreOnBaseFret = false;

    // Para cada cuerda, encontrar la mejor nota del acorde
    for (let string = 0; string < 6; string++) {
      let bestFret = -1;
      let minDistance = Infinity;

      // Buscar en un rango de trastes
      for (let fret = baseFret; fret <= Math.min(22, baseFret + 6); fret++) {
        const note = getNoteAtFret(string, fret);
        
        if (note && requiredNotes.includes(note)) {
          const distance = Math.abs(fret - baseFret);
          if (distance < minDistance) {
            minDistance = distance;
            bestFret = fret;
          }
        }
      }

      if (bestFret !== -1) {
        frets.push(bestFret);
        if (bestFret === baseFret && baseFret !== 0) {
          hasBarreOnBaseFret = true;
        }
      } else {
        frets.push(-1);
      }
    }

    // Validar la posición
    const notesInPos = frets
      .map((f, idx) => f >= 0 ? getNoteAtFret(idx, f) : null)
      .filter(Boolean);
    
    const uniqueNotes = [...new Set(notesInPos)];
    
    // Verificar que tenga la raíz y al menos 1 nota más del acorde
    if (uniqueNotes.includes(rootNote) && 
        uniqueNotes.filter(n => requiredNotes.includes(n)).length >= Math.min(2, formula.length)) {
      
      const difficulty = calculateDifficulty(frets, hasBarreOnBaseFret);
      
      positions.push({
        name: `Posición ${positions.length + 1}${baseFret > 0 ? ` (Traste ${baseFret})` : ' (Abierta)'}`,
        frets: frets,
        baseFret: baseFret,
        barre: hasBarreOnBaseFret ? baseFret : null,
        difficulty: difficulty,
        description: generateDescription(baseFret, hasBarreOnBaseFret, formula.length)
      });
    }
  }

  return positions;
}

/**
 * Calcula la dificultad del acorde
 */
function calculateDifficulty(frets, hasBarre) {
  const activeFrets = frets.filter(f => f >= 0);
  if (activeFrets.length === 0) return 'easy';
  
  const maxFret = Math.max(...activeFrets);
  
  if (hasBarre && maxFret > 7) {
    return 'hard';
  } else if (hasBarre || maxFret > 5) {
    return 'medium';
  }
  return 'easy';
}

/**
 * Genera descripción del acorde
 */
function generateDescription(baseFret, hasBarre, intervalCount) {
  const parts = [];
  
  if (baseFret === 0) {
    parts.push('Posición abierta');
  } else {
    parts.push(`Traste ${baseFret}`);
  }
  
  if (hasBarre) {
    parts.push('con cejilla');
  }
  
  parts.push(`(${intervalCount} notas)`);
  
  return parts.join(' ');
}

/**
 * Genera todas las variaciones de un acorde
 */
function generateAllVariations(rootNote) {
  const variations = {};
  
  for (const [key, data] of Object.entries(CHORD_FORMULAS)) {
    let chordName = rootNote + (key === 'major' ? '' : key);
    
    // Alias para nombres cortos
    const aliases = [];
    if (key === 'minor') {
      aliases.push(rootNote + 'm'); // C -> Cm
    }
    
    const positions = generateChordPositions(rootNote, data.intervals, chordName);
    
    if (positions.length > 0) {
      variations[chordName] = {
        positions: positions,
        type: key,
        category: data.category,
        name: data.name
      };
      
      // Agregar alias si existe
      for (const alias of aliases) {
        variations[alias] = variations[chordName];
      }
    }
  }
  
  return variations;
}

/**
 * Función principal
 */
function main() {
  console.log('🎸 Generando diccionario expandido de acordes de guitarra...\n');

  const allChords = {};
  let totalChords = 0;
  let totalPositions = 0;
  const categoryStats = {};

  // Generar para todas las 12 notas
  for (const note of NOTES) {
    const variations = generateAllVariations(note);
    
    for (const [chordName, chordData] of Object.entries(variations)) {
      if (chordData.positions.length > 0) {
        allChords[chordName] = {
          positions: chordData.positions
        };
        
        totalChords++;
        totalPositions += chordData.positions.length;
        
        const cat = chordData.category;
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      }
    }
  }

  // Preparar diccionario final
  const finalChords = {};
  
  // Ordenar alfabéticamente
  const sortedChords = Object.keys(allChords).sort();
  
  for (const chordName of sortedChords) {
    finalChords[chordName] = allChords[chordName];
  }

  const dictionary = {
    chords: finalChords,
    metadata: {
      version: '3.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      instrument: 'guitar',
      tuning: 'standard',
      description: 'Diccionario expandido de acordes para guitarra con múltiples posiciones',
      totalChords: totalChords,
      totalPositions: totalPositions,
      generated: true,
      generationDate: new Date().toISOString(),
      categories: Object.keys(CHORD_FORMULAS).length
    }
  };

  // Guardar diccionario
  fs.writeFileSync(chordDictionaryPath, JSON.stringify(dictionary, null, 2), 'utf8');
  
  console.log(`✅ Diccionario guardado: ${chordDictionaryPath}\n`);
  console.log(`📊 Estadísticas Globales:`);
  console.log(`   • Total de acordes: ${totalChords}`);
  console.log(`   • Total de posiciones: ${totalPositions}`);
  console.log(`   • Promedio posiciones/acorde: ${(totalPositions / totalChords).toFixed(2)}`);
  console.log(`   • Notas base: ${NOTES.length}`);
  console.log(`   • Tipos de acordes: ${Object.keys(CHORD_FORMULAS).length}\n`);
  
  console.log(`📈 Acordes por Categoría:`);
  for (const [category, count] of Object.entries(categoryStats).sort()) {
    console.log(`   • ${category.padEnd(12)}: ${count} acordes`);
  }

  // Mostrar algunos ejemplos
  console.log(`\n🎵 Ejemplos de acordes disponibles:`);
  const examples = sortedChords.slice(0, 15);
  for (const chord of examples) {
    const positions = allChords[chord].positions.length;
    console.log(`   • ${chord.padEnd(8)} - ${positions} posición(es)`);
  }
  
  console.log(`\n   ... y ${totalChords - examples.length} acordes más.\n`);
  console.log(`✨ ¡Diccionario de acordes completado exitosamente!`);
}

main();
