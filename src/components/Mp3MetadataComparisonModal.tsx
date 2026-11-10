import React, { useState, useId, useEffect } from 'react';
import {
  X,
  Check,
  CheckCheck,
  Ban,
  FileAudio,
  Music2,
  FileText,
  Clock,
  Calendar,
  Disc,
  Tag,
  Hash,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  ExtractedMp3Metadata,
  ExtractedMp3FieldComparison,
  buildComparisonFields,
  Mp3FieldKey
} from '../lib/audio/mp3Metadata';

interface Mp3MetadataComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ExtractedMp3Metadata;
  fileName?: string;
  currentSongData: {
    title?: string;
    lyrics?: string;
    lrc?: string;
    key?: string;
    tempo?: number | string;
    year?: number;
    genre?: string;
    notes?: string;
    timeSignature?: string;
    tuning?: string;
    albumTitle?: string;
  };
  onApplyFields: (selectedFields: Partial<Record<Mp3FieldKey, string | number>>) => void;
}

export const Mp3MetadataComparisonModal: React.FC<Mp3MetadataComparisonModalProps> = ({
  isOpen,
  onClose,
  metadata,
  fileName,
  currentSongData,
  onApplyFields
}) => {
  const titleId = useId();

  // Build field comparison list
  const comparisonFields = buildComparisonFields(metadata, currentSongData);

  // By default, select all fields that either differ or are empty in current song
  const [selectedKeys, setSelectedKeys] = useState<Set<Mp3FieldKey>>(() => {
    const initial = new Set<Mp3FieldKey>();
    for (const f of comparisonFields) {
      if (f.isDifferent || f.isEmptyCurrent) {
        initial.add(f.key);
      }
    }
    // If none differed (e.g. all empty or identical), default to all detected fields
    if (initial.size === 0) {
      comparisonFields.forEach(f => initial.add(f.key));
    }
    return initial;
  });

  // Track expanded multiline diffs (e.g. lyrics, lrc, notes)
  const [expandedKeys, setExpandedKeys] = useState<Set<Mp3FieldKey>>(new Set());

  // Reset selections when comparison fields change
  useEffect(() => {
    const initial = new Set<Mp3FieldKey>();
    for (const f of comparisonFields) {
      if (f.isDifferent || f.isEmptyCurrent) {
        initial.add(f.key);
      }
    }
    if (initial.size === 0) {
      comparisonFields.forEach(f => initial.add(f.key));
    }
    setSelectedKeys(initial);
    setExpandedKeys(new Set());
  }, [metadata, currentSongData]);

  // Handle ESC key to reject/close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || comparisonFields.length === 0) return null;

  // Toggle single field selection
  const handleToggleField = (key: Mp3FieldKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle expand for multiline details
  const handleToggleExpand = (key: Mp3FieldKey) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Action: Select All / Accept All
  const handleSelectAll = () => {
    setSelectedKeys(new Set(comparisonFields.map(f => f.key)));
  };

  // Action: Deselect All
  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  // Action: Aceptar todos (Overwrites all detected metadata immediately)
  const handleAcceptAll = () => {
    const allPayload: Partial<Record<Mp3FieldKey, string | number>> = {};
    for (const f of comparisonFields) {
      allPayload[f.key] = f.extractedValue;
    }
    onApplyFields(allPayload);
    onClose();
  };

  // Action: Rechazar todos (Discard all metadata, keep original song untouched)
  const handleRejectAll = () => {
    onClose();
  };

  // Action: Aplicar seleccionados (Overwrites only the checked fields)
  const handleApplySelected = () => {
    const payload: Partial<Record<Mp3FieldKey, string | number>> = {};
    for (const f of comparisonFields) {
      if (selectedKeys.has(f.key)) {
        payload[f.key] = f.extractedValue;
      }
    }
    onApplyFields(payload);
    onClose();
  };

  // Field icons
  const getFieldIcon = (key: Mp3FieldKey) => {
    switch (key) {
      case 'title':
        return <Music2 className="w-4 h-4 text-blue-500" />;
      case 'lyrics':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'lrc':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'key':
        return <Hash className="w-4 h-4 text-purple-500" />;
      case 'tempo':
        return <Sliders className="w-4 h-4 text-rose-500" />;
      case 'year':
        return <Calendar className="w-4 h-4 text-cyan-500" />;
      case 'genre':
        return <Tag className="w-4 h-4 text-indigo-500" />;
      case 'albumTitle':
        return <Disc className="w-4 h-4 text-amber-600" />;
      default:
        return <FileAudio className="w-4 h-4 text-[var(--accent-primary)]" />;
    }
  };

  const selectedCount = selectedKeys.size;
  const totalCount = comparisonFields.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4 bg-[var(--bg-surface-subtle)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
                <FileAudio className="w-5 h-5" />
              </span>
              <h2 id={titleId} className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                Metadatos detectados en el archivo MP3
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              El archivo contiene etiquetas ID3, letra y/o sincronización. Compara en paralelo los valores actuales con los del archivo y decide qué campos sobreescribir.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--text-muted)] font-mono">
              <span className="font-semibold text-[var(--text-primary)]">{fileName || 'Archivo de audio'}</span>
              <span>·</span>
              <span>Formato: {metadata.format}</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {totalCount} {totalCount === 1 ? 'campo detectado' : 'campos detectados'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer shrink-0"
            title="Cerrar sin sobreescribir (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Decision Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Decisión rápida:
            </span>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Aceptar todos</span>
            </button>
            <button
              type="button"
              onClick={handleRejectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border-subtle)]"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Rechazar todos</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[var(--accent-primary)] hover:underline cursor-pointer font-medium"
            >
              Marcar todos
            </button>
            <span className="text-[var(--text-muted)]">/</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-3 pb-2 border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <div className="col-span-4">Campo a Modificar</div>
            <div className="col-span-3">Valor Actual en Canción</div>
            <div className="col-span-3">Valor Extraído del MP3</div>
            <div className="col-span-2 text-right">Decisión</div>
          </div>

          {/* Fields list */}
          <div className="space-y-3">
            {comparisonFields.map(field => {
              const isSelected = selectedKeys.has(field.key);
              const isExpanded = expandedKeys.has(field.key);

              return (
                <div
                  key={field.key}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  {/* Field Row */}
                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
                    {/* Column 1: Field name & info */}
                    <div className="md:col-span-4 flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] shrink-0 mt-0.5">
                        {getFieldIcon(field.key)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)]">
                            {field.label}
                          </h4>
                          {field.isEmptyCurrent && (
                            <span className="text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              Nuevo
                            </span>
                          )}
                          {!field.isEmptyCurrent && field.isDifferent && (
                            <span className="text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              Diferente
                            </span>
                          )}
                          {!field.isDifferent && !field.isEmptyCurrent && (
                            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 rounded">
                              Idéntico
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                          {field.description}
                        </p>
                      </div>
                    </div>

                    {/* Column 2: Current Song Value */}
                    <div className="md:col-span-3 text-xs">
                      <span className="md:hidden text-[11px] font-medium text-[var(--text-muted)] block mb-1">
                        Valor Actual:
                      </span>
                      {field.isEmptyCurrent ? (
                        <span className="italic text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] px-2 py-1 rounded inline-block">
                          (vacío)
                        </span>
                      ) : field.isMultiline ? (
                        <div className="p-2 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] line-clamp-2 max-h-14 overflow-hidden">
                          {field.currentDisplayValue}
                        </div>
                      ) : (
                        <div className="font-medium text-[var(--text-secondary)] truncate">
                          {field.currentDisplayValue}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Extracted MP3 Value */}
                    <div className="md:col-span-3 text-xs">
                      <span className="md:hidden text-[11px] font-medium text-[var(--text-muted)] block mb-1">
                        Valor del MP3:
                      </span>
                      {field.isMultiline ? (
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-[var(--text-primary)] line-clamp-2 max-h-14 overflow-hidden">
                          {field.displayValue}
                        </div>
                      ) : (
                        <div className="font-semibold text-[var(--text-primary)] truncate">
                          {field.displayValue}
                        </div>
                      )}
                    </div>

                    {/* Column 4: Decision Actions (Field-by-Field) */}
                    <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleField(field.key)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {isSelected ? 'Sobreescribir' : 'Conservar'}
                        </span>
                      </label>

                      {/* Multiline expansion button */}
                      {field.isMultiline && (
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(field.key)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                          title={isExpanded ? 'Ocultar comparación completa' : 'Ver versos en paralelo'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Multiline Diff (Verse by Verse / Parallel) */}
                  {field.isMultiline && isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 rounded-b-xl space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
                        <span>Comparación en paralelo verso a verso:</span>
                        <span>{field.label}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        {/* Left: Current Song */}
                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1.5 max-h-56 overflow-y-auto">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-1">
                            <span>Canción actual</span>
                            <span>{field.isEmptyCurrent ? '0 líneas' : `${field.currentDisplayValue.split('\n').length} líneas`}</span>
                          </div>
                          {field.isEmptyCurrent ? (
                            <p className="italic text-[var(--text-muted)] py-4 text-center">
                              No hay contenido previo en la canción para este campo.
                            </p>
                          ) : (
                            <pre className="whitespace-pre-wrap text-[11px] text-[var(--text-secondary)] leading-relaxed">
                              {field.currentDisplayValue}
                            </pre>
                          )}
                        </div>

                        {/* Right: MP3 Value */}
                        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1.5 max-h-56 overflow-y-auto">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20 pb-1">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Extraído del MP3</span>
                            </span>
                            <span>{String(field.extractedValue).split('\n').length} líneas</span>
                          </div>
                          <pre className="whitespace-pre-wrap text-[11px] text-[var(--text-primary)] leading-relaxed font-semibold">
                            {String(field.extractedValue)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{selectedCount}</span>
            <span>de</span>
            <span className="font-semibold text-[var(--text-primary)]">{totalCount}</span>
            <span>campos seleccionados para sobreescribir</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleRejectAll}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              Rechazar todos
            </button>

            <button
              type="button"
              onClick={handleApplySelected}
              disabled={selectedCount === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedCount > 0
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] opacity-50 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {selectedCount === totalCount
                  ? 'Aceptar y sobreescribir todos'
                  : `Sobreescribir seleccionados (${selectedCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
