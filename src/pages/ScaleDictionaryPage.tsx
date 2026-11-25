import React, { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Music, AlertCircle, ChevronUp } from 'lucide-react';
import { ScaleFretboard } from '../components/ScaleFretboard';
import { BaseNoteSelector } from '../components/BaseNoteSelector';
import { ScaleSuggestions } from '../components/ScaleSuggestions';
import { ScaleQuiz } from '../components/ScaleQuiz';
import { 
  loadScaleDictionary, 
  getAllScales,
  getScaleEntry,
  getDifficultyColor,
  getDifficultyLabel,
  ScaleEntry
} from '../services/scaleDictionaryService';

export const ScaleDictionaryPage: React.FC = () => {
  const [allScales, setAllScales] = useState<string[]>([]);
  const [selectedScale, setSelectedScale] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  const [baseNote, setBaseNote] = useState<string>('C');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedScales, setExpandedScales] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'explorer' | 'suggestions' | 'quiz'>('explorer');

  const initializeDictionary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadScaleDictionary();
      const scales = getAllScales();
      setAllScales(scales);
      if (scales.length > 0) {
        setSelectedScale(scales[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el diccionario de escalas';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeDictionary();
  }, [initializeDictionary]);

  const toggleScaleExpand = (scaleId: string) => {
    setExpandedScales(prev => ({
      ...prev,
      [scaleId]: !prev[scaleId]
    }));
  };

  const handleScaleSelect = (scaleId: string) => {
    setSelectedScale(scaleId);
    setSelectedPosition(0);
    setExpandedScales(prev => ({
      ...prev,
      [scaleId]: true
    }));
  };

  const selectedScaleData = selectedScale ? getScaleEntry(selectedScale) : null;

  const handleTabChange = useCallback((tab: 'explorer' | 'suggestions' | 'quiz') => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="w-8 h-8 text-[var(--accent-primary)]" />
            <h1 className="text-4xl font-bold text-[var(--text-primary)]">
              Diccionario de Escalas
            </h1>
          </div>
          <p className="text-lg text-[var(--text-secondary)]">
            Aprende escalas en diferentes posiciones del diapasón
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Visualiza cómo se distribuyen las notas en todo el mástil de tu guitarra
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
            <p className="mt-4 text-[var(--text-muted)]">Cargando diccionario de escalas...</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Tabs Navigation */}
            <div className="flex gap-2 border-b border-[var(--border-color)] overflow-x-auto">
              <button
                onClick={() => handleTabChange('explorer')}
                className={`px-6 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === 'explorer'
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📚 Explorador de Escalas
              </button>
              <button
                onClick={() => handleTabChange('suggestions')}
                className={`px-6 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === 'suggestions'
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                💡 Sugerencias Inteligentes
              </button>
              <button
                onClick={() => handleTabChange('quiz')}
                className={`px-6 py-3 font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === 'quiz'
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                🧠 Quiz Interactivo
              </button>
            </div>

            {/* Explorer Tab */}
            {activeTab === 'explorer' && (
            <div className="space-y-6">
              {/* Base Note Selector - Quick Access */}
              <BaseNoteSelector
                selectedNote={baseNote}
                onNoteChange={setBaseNote}
                showSharps={true}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Scale List */}
            <div className="lg:col-span-1">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden sticky top-4">
                <div className="px-6 py-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary-dark)] text-white">
                  <h2 className="text-xl font-bold">Escalas Disponibles</h2>
                  <p className="text-sm opacity-90 mt-1">{allScales.length} escalas</p>
                </div>

                <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
                  {allScales.map(scaleId => {
                    const scaleData = getScaleEntry(scaleId);
                    if (!scaleData) return null;

                    const isSelected = selectedScale === scaleId;
                    const isExpanded = expandedScales[scaleId];

                    return (
                      <div key={scaleId}>
                        <button
                          onClick={() => handleScaleSelect(scaleId)}
                          className={`w-full px-4 py-3 text-left transition-all ${
                            isSelected
                              ? 'bg-[var(--accent-primary-light)] border-l-4 border-[var(--accent-primary)]'
                              : 'hover:bg-[var(--bg-surface-subtle)]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-[var(--text-primary)]">
                                {scaleData.name}
                              </h3>
                              <p className={`text-xs mt-1 ${getDifficultyColor(scaleData.difficulty)}`}>
                                {getDifficultyLabel(scaleData.difficulty)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel - Scale Details */}
            <div className="lg:col-span-2 space-y-6">
              {selectedScaleData && (
                <>
                  {/* Scale Info */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                          {selectedScaleData.name}
                        </h2>
                        <p className="text-[var(--text-secondary)]">
                          {selectedScaleData.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-subtle)]">
                        <div>
                          <p className="text-sm text-[var(--text-muted)]">Dificultad</p>
                          <p className={`font-semibold ${getDifficultyColor(selectedScaleData.difficulty)}`}>
                            {getDifficultyLabel(selectedScaleData.difficulty)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[var(--text-muted)]">Notas</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {selectedScaleData.intervals.length} notas
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[var(--border-subtle)]">
                        <p className="text-sm text-[var(--text-muted)] mb-2">Notas de la escala</p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {selectedScaleData.keyNotes}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position Selector and Fretboard */}
                  {selectedScaleData.positions.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4">
                      {/* Position Selector */}
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">
                          Posiciones en el Diapasón
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedScaleData.positions.map((position, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedPosition(idx)}
                              className={`p-3 rounded-lg text-left transition-all ${
                                selectedPosition === idx
                                  ? 'bg-[var(--accent-primary)] text-white'
                                  : 'bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                              }`}
                            >
                              <p className="font-semibold">{position.name}</p>
                              <p className="text-xs opacity-75 mt-1">{position.description}</p>
                              <p className="text-xs opacity-60 mt-1">Patrón: {position.shape}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fretboard Visualization */}
                      <div className="pt-4 border-t border-[var(--border-subtle)]">
                        <ScaleFretboard
                          position={selectedScaleData.positions[selectedPosition]}
                          scaleId={selectedScale || ''}
                          rootNote={selectedScale?.split('-')[0] || 'C'}
                          showFretNumbers={true}
                        />
                      </div>

                      {/* Position Info */}
                      <div className="pt-4 border-t border-[var(--border-subtle)]">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                            💡 Consejo de práctica
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            Practica cambiar entre posiciones fluIdamente. La clave es memorizar la forma del patrón 
                            y trasladarla a diferentes trastes. Comienza lentamente y acelera gradualmente.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
            </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-6">
                {/* Base Note Selector */}
                <BaseNoteSelector
                  selectedNote={baseNote}
                  onNoteChange={setBaseNote}
                  showSharps={true}
                />

                {/* Scale Suggestions for the selected base note */}
                <ScaleSuggestions
                  sourceType="key"
                  sourceValue={baseNote}
                  onSelectScale={(scaleId) => {
                    handleScaleSelect(`${baseNote}-${scaleId}`);
                    handleTabChange('explorer');
                  }}
                  maxSuggestions={5}
                />

                {/* Quick Reference for Common Progressions */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    📋 Progresiones de Acordes Comunes
                  </h3>
                  <div className="space-y-3">
                    {[
                      { progression: ['C', 'F', 'G'], name: 'Pop/Rock Clásico' },
                      { progression: ['Am', 'F', 'C', 'G'], name: 'Indie/Alternativo' },
                      { progression: ['Em', 'Am', 'D', 'G'], name: 'Folk/Acústico' },
                      { progression: ['Dm', 'F', 'C', 'G'], name: 'Clásico Español' }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleScaleSelect('minor');
                        }}
                        className="w-full p-4 bg-white dark:bg-[var(--bg-primary)] rounded-lg border border-amber-300 dark:border-amber-700 hover:shadow-md transition-all text-left"
                      >
                        <div className="font-semibold text-[var(--text-primary)]">{item.name}</div>
                        <div className="text-sm text-[var(--text-secondary)] mt-1">
                          {item.progression.join(' - ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="py-6">
                <ScaleQuiz
                  onScaleSelect={(scaleId, position) => {
                    handleScaleSelect(scaleId);
                    if (position !== undefined) {
                      setSelectedPosition(position);
                    }
                    handleTabChange('explorer');
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
