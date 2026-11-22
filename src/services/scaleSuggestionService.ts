/**
 * Scale suggestion service
 * Suggests appropriate scales based on key/root note, chord progression, or detected chords
 */

export interface ScaleSuggestion {
  scaleName: string;
  scaleId: string;
  confidence: number; // 0-1
  reason: string;
  compatibility: 'perfect' | 'good' | 'fair';
}

// Musical scale patterns (intervals from root)
const scalePatterns: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
};

// Chord to scale compatibility map
const chordScaleCompatibility: Record<string, Record<string, number>> = {
  // Major chords work well with:
  'major': {
    'major': 0.95,
    'majorPentatonic': 0.9,
    'mixolydian': 0.85,
    'lydian': 0.8,
    'dorian': 0.4,
    'minor': 0.3,
    'phrygian': 0.2
  },
  // Minor chords work well with:
  'minor': {
    'minor': 0.95,
    'minorPentatonic': 0.9,
    'dorian': 0.85,
    'phrygian': 0.8,
    'harmonicMinor': 0.85,
    'melodicMinor': 0.8,
    'major': 0.3,
    'majorPentatonic': 0.2
  },
  // Dominant 7th works well with:
  'dominant7': {
    'mixolydian': 0.95,
    'major': 0.8,
    'blues': 0.75,
    'majorPentatonic': 0.7,
    'dorian': 0.4
  },
  // Diminished works well with:
  'diminished': {
    'diminished': 0.95,
    'harmonicMinor': 0.7,
    'minorPentatonic': 0.5,
    'blues': 0.4
  },
  // Augmented works well with:
  'augmented': {
    'wholeTone': 0.9,
    'harmonicMinor': 0.6,
    'minor': 0.4
  },
  // Suspended 4th works well with:
  'sus4': {
    'major': 0.85,
    'lydian': 0.9,
    'mixolydian': 0.8,
    'majorPentatonic': 0.75,
  }
};

/**
 * Extract chord type from chord name
 * e.g., "Cmaj7" -> "major", "Am" -> "minor", "G7" -> "dominant7"
 */
export function extractChordType(chordName: string): string {
  const chord = chordName.toLowerCase();
  
  if (chord.includes('aug')) return 'augmented';
  if (chord.includes('dim')) return 'diminished';
  if (chord.includes('sus4')) return 'sus4';
  if (chord.includes('sus2')) return 'sus4';
  if (chord.includes('7') && !chord.includes('maj7') && !chord.includes('min7')) {
    return 'dominant7';
  }
  if (chord.includes('m') || chord.includes('min')) {
    return 'minor';
  }
  
  return 'major';
}

/**
 * Suggest scales based on a single chord
 */
export function suggestScalesForChord(chordName: string): ScaleSuggestion[] {
  const chordType = extractChordType(chordName);
  const compatibility = chordScaleCompatibility[chordType] || chordScaleCompatibility['major'];
  
  return Object.entries(compatibility)
    .sort((a, b) => b[1] - a[1])
    .map(([scaleId, score]) => ({
      scaleName: formatScaleName(scaleId),
      scaleId,
      confidence: score,
      reason: `Compatible con acordes ${chordType === 'major' ? 'mayores' : chordType === 'minor' ? 'menores' : 'de ' + chordType}`,
      compatibility: score >= 0.8 ? 'perfect' : score >= 0.5 ? 'good' : 'fair'
    }));
}

/**
 * Suggest scales based on a chord progression
 */
export function suggestScalesForProgression(chords: string[]): ScaleSuggestion[] {
  if (chords.length === 0) {
    return suggestScalesForChord('C');
  }

  // Calculate average compatibility across all chords
  const scaleScores: Record<string, number> = {};
  
  chords.forEach(chord => {
    const suggestions = suggestScalesForChord(chord);
    suggestions.forEach(s => {
      if (!scaleScores[s.scaleId]) {
        scaleScores[s.scaleId] = 0;
      }
      scaleScores[s.scaleId] += s.confidence;
    });
  });

  // Average the scores
  Object.keys(scaleScores).forEach(scale => {
    scaleScores[scale] /= chords.length;
  });

  return Object.entries(scaleScores)
    .sort((a, b) => b[1] - a[1])
    .map(([scaleId, score]) => ({
      scaleName: formatScaleName(scaleId),
      scaleId,
      confidence: score,
      reason: `Óptima para la progresión de acordes`,
      compatibility: score >= 0.8 ? 'perfect' : score >= 0.5 ? 'good' : 'fair'
    }));
}

/**
 * Suggest scales based on detected key (from audio analysis)
 */
export function suggestScalesForKey(keyName: string): ScaleSuggestion[] {
  const isMinor = keyName.toLowerCase().includes('m') || 
                  keyName.toLowerCase().includes('minor');
  
  if (isMinor) {
    return [
      { 
        scaleName: 'Escala Menor Natural',
        scaleId: 'minor',
        confidence: 0.95,
        reason: 'Escala estándar para tonalidades menores',
        compatibility: 'perfect'
      },
      { 
        scaleName: 'Escala Pentatónica Menor',
        scaleId: 'minorPentatonic',
        confidence: 0.9,
        reason: 'Perfecta para solos sobre tonalidades menores',
        compatibility: 'perfect'
      },
      { 
        scaleName: 'Escala Menor Armónica',
        scaleId: 'harmonicMinor',
        confidence: 0.8,
        reason: 'Añade tensión con el séptimo grado elevado',
        compatibility: 'good'
      },
      { 
        scaleName: 'Dorian',
        scaleId: 'dorian',
        confidence: 0.75,
        reason: 'Modo menor con segundo grado mayor',
        compatibility: 'good'
      },
      { 
        scaleName: 'Blues',
        scaleId: 'blues',
        confidence: 0.7,
        reason: 'Perfecta para solos bluesy',
        compatibility: 'good'
      }
    ];
  } else {
    return [
      { 
        scaleName: 'Escala Mayor',
        scaleId: 'major',
        confidence: 0.95,
        reason: 'Escala estándar para tonalidades mayores',
        compatibility: 'perfect'
      },
      { 
        scaleName: 'Escala Pentatónica Mayor',
        scaleId: 'majorPentatonic',
        confidence: 0.9,
        reason: 'Perfecta para solos sobre tonalidades mayores',
        compatibility: 'perfect'
      },
      { 
        scaleName: 'Mixolydian',
        scaleId: 'mixolydian',
        confidence: 0.8,
        reason: 'Mayor con séptimo grado menor',
        compatibility: 'good'
      },
      { 
        scaleName: 'Lydian',
        scaleId: 'lydian',
        confidence: 0.75,
        reason: 'Mayor con cuarto grado elevado',
        compatibility: 'good'
      },
      { 
        scaleName: 'Dorian',
        scaleId: 'dorian',
        confidence: 0.6,
        reason: 'Modo mayor con sexto grado menor',
        compatibility: 'fair'
      }
    ];
  }
}

/**
 * Format scale ID to display name
 */
function formatScaleName(scaleId: string): string {
  const names: Record<string, string> = {
    'major': 'Escala Mayor',
    'minor': 'Escala Menor',
    'minorPentatonic': 'Escala Pentatónica Menor',
    'majorPentatonic': 'Escala Pentatónica Mayor',
    'blues': 'Escala Blues',
    'dorian': 'Modo Dorian',
    'phrygian': 'Modo Phrygian',
    'lydian': 'Modo Lydian',
    'mixolydian': 'Modo Mixolydian',
    'harmonicMinor': 'Escala Menor Armónica',
    'melodicMinor': 'Escala Menor Melódica',
    'diminished': 'Escala Disminuida',
    'wholeTone': 'Escala de Tonos Enteros'
  };
  
  return names[scaleId] || scaleId;
}

/**
 * Get scale ID from display name
 */
export function getScaleIdFromName(name: string): string {
  const names: Record<string, string> = {
    'escala mayor': 'major',
    'escala menor': 'minor',
    'escala pentatónica menor': 'minorPentatonic',
    'escala pentatónica mayor': 'majorPentatonic',
    'escala blues': 'blues',
    'modo dorian': 'dorian',
    'modo phrygian': 'phrygian',
    'modo lydian': 'lydian',
    'modo mixolydian': 'mixolydian',
    'escala menor armónica': 'harmonicMinor',
    'escala menor melódica': 'melodicMinor',
    'escala disminuida': 'diminished',
    'escala de tonos enteros': 'wholeTone'
  };
  
  return names[name.toLowerCase()] || name;
}
