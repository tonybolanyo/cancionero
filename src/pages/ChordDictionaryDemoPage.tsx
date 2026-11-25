import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Guitar, AlertCircle } from 'lucide-react';
import { EnhancedChordDiagramCard } from '../components/EnhancedChordDiagramCard';
import { loadChordDictionary, getAllChords } from '../services/chordDictionaryService';

export const ChordDictionaryDemoPage: React.FC = () => {
  const [allChords, setAllChords] = useState<string[]>([]);
  const [selectedChords, setSelectedChords] = useState<string[]>(['C', 'Am', 'G', 'D']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    demo: true,
    all: false,
    guide: false
  });

  const initializeDictionary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadChordDictionary();
      const chords = getAllChords();
      setAllChords(chords);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el diccionario de acordes';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeDictionary();
  }, [initializeDictionary]);

  const toggleChord = (chord: string) => {
    setSelectedChords(prev =>
      prev.includes(chord)
        ? prev.filter(c => c !== chord)
        : [...prev, chord]
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Guitar className="w-8 h-8 text-[var(--accent-primary)]" />
            <h1 className="text-4xl font-bold text-[var(--text-primary)]">
              Diccionario de Acordes
            </h1>
          </div>
          <p className="text-lg text-[var(--text-secondary)]">
            Sistema de múltiples posiciones para acordes de guitarra
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Explora diferentes formas de tocar cada acorde, desde posiciones abiertas hasta posiciones en trastes altos
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Error</h3>
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={initializeDictionary}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
            <p className="mt-4 text-[var(--text-muted)]">Cargando diccionario de acordes...</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Demo Section */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection('demo')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    🎸 Acordes Destacados
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Acordes más comunes con múltiples posiciones
                  </p>
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-[var(--text-muted)] transition-transform ${
                    expandedSections.demo ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.demo && (
                <div className="border-t border-[var(--border-subtle)] px-6 py-6">
                  {selectedChords.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-center py-8">
                      Selecciona acordes de la lista de abajo
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {selectedChords.map(chord => (
                        <div key={chord} className="flex flex-col items-center">
                          <EnhancedChordDiagramCard
                            chord={chord}
                            instrument="guitar"
                            showMultiplePositions={true}
                            showPositionInfo={false}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Selector Section */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection('all')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    📋 Seleccionar Acordes
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {allChords.length} acordes disponibles en el diccionario
                  </p>
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-[var(--text-muted)] transition-transform ${
                    expandedSections.all ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.all && (
                <div className="border-t border-[var(--border-subtle)] px-6 py-6">
                  <div className="flex flex-wrap gap-2">
                    {allChords.map(chord => (
                      <button
                        key={chord}
                        onClick={() => toggleChord(chord)}
                        className={`px-3 py-2 rounded-lg font-mono font-semibold text-sm transition-all ${
                          selectedChords.includes(chord)
                            ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                            : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                        }`}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Guide Section */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection('guide')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    📖 Cómo Funciona
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Aprende a usar el diccionario de acordes
                  </p>
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-[var(--text-muted)] transition-transform ${
                    expandedSections.guide ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.guide && (
                <div className="border-t border-[var(--border-subtle)] px-6 py-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                      ✨ Características
                    </h3>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">•</span>
                        <span><strong>Múltiples posiciones</strong>: Cada acorde tiene 2-3 formas de tocarlo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">•</span>
                        <span><strong>Dificultad clasificada</strong>: Fácil, Medio, Difícil</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">•</span>
                        <span><strong>Información detallada</strong>: Span de trastes, cejillas, cuerdas abiertas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">•</span>
                        <span><strong>Base de datos JSON</strong>: Fácil de expandir y mantener</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                      🎯 Dificultad de Acordes
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded bg-green-100 text-green-700 font-semibold">Fácil</span>
                        <span className="text-[var(--text-secondary)]">Acordes abiertos, fáciles de aprender</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded bg-yellow-100 text-yellow-700 font-semibold">Medio</span>
                        <span className="text-[var(--text-secondary)]">Requieren cejilla o más coordinación</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded bg-red-100 text-red-700 font-semibold">Difícil</span>
                        <span className="text-[var(--text-secondary)]">Cejillas complejas o posiciones altas</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                      🔍 Lectura de Diagramas
                    </h3>
                    <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-2 text-sm text-[var(--text-secondary)]">
                      <p><strong className="text-[var(--text-primary)]">O</strong> = Cuerda abierta</p>
                      <p><strong className="text-[var(--text-primary)]">×</strong> = Cuerda silenciada (no se toca)</p>
                      <p><strong className="text-[var(--text-primary)]">●</strong> = Dedo en ese traste</p>
                      <p><strong className="text-[var(--text-primary)]">Nfr</strong> = Número de traste base</p>
                      <p><strong className="text-[var(--text-primary)]">─────</strong> = Línea de cejilla</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                      💡 Consejos de Uso
                    </h3>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">1.</span>
                        <span>Comienza con acordes <strong>Fácil</strong> para aprender los básicos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">2.</span>
                        <span>Experimenta con diferentes posiciones del mismo acorde</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">3.</span>
                        <span>Usa posiciones <strong>Medio/Difícil</strong> una vez domines los básicos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--accent-primary)] font-bold mt-0.5">4.</span>
                        <span>Diferentes posiciones permiten sonidos y voicings únicos</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>ℹ️ Nota:</strong> El diccionario de acordes se carga automáticamente desde{' '}
                <code className="bg-blue-100 px-2 py-1 rounded font-mono text-xs">
                  /public/data/chord-dictionary.json
                </code>
                . Puedes expandir este diccionario agregando más acordes y posiciones.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChordDictionaryDemoPage;
