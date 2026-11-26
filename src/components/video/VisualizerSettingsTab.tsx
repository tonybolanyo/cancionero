import React from 'react';
import { Film, Sparkles, Palette, Upload, Type } from 'lucide-react';
import { EFFECT_OPTIONS, RESOLUTION_PRESETS, THEME_OPTIONS } from '../../lib/video/presets';
import {
  BackgroundTheme,
  LyricFontStyle,
  VideoResolution,
  VisualizerEffect
} from '../../lib/video/types';

export interface VisualizerSettingsTabProps {
  resolution: VideoResolution;
  onChangeResolution: (res: VideoResolution) => void;
  effect: VisualizerEffect;
  onChangeEffect: (effect: VisualizerEffect) => void;
  theme: BackgroundTheme;
  onChangeTheme: (theme: BackgroundTheme) => void;
  onCustomImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fontStyle: LyricFontStyle;
  onChangeFontStyle: (style: LyricFontStyle) => void;
  watermarkText: string;
  onChangeWatermarkText: (text: string) => void;
  showChords: boolean;
  onChangeShowChords: (show: boolean) => void;
  showMetadataBadge: boolean;
  onChangeShowMetadataBadge: (show: boolean) => void;
  showProgressBar: boolean;
  onChangeShowProgressBar: (show: boolean) => void;
}

export const VisualizerSettingsTab: React.FC<VisualizerSettingsTabProps> = ({
  resolution,
  onChangeResolution,
  effect,
  onChangeEffect,
  theme,
  onChangeTheme,
  onCustomImageUpload,
  fontStyle,
  onChangeFontStyle,
  watermarkText,
  onChangeWatermarkText,
  showChords,
  onChangeShowChords,
  showMetadataBadge,
  onChangeShowMetadataBadge,
  showProgressBar,
  onChangeShowProgressBar
}) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Resolution Setting (1080p, 720p, 360p) */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
              <Film className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Tamaño y Calidad de Visualización (YouTube 16:9)</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              1080p es la resolución recomendada por YouTube para una nitidez cristalina de las letras.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">
            Por defecto: 1080p
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {(['1080p', '720p', '360p'] as VideoResolution[]).map((res) => {
            const cfg = RESOLUTION_PRESETS[res];
            const isSelected = resolution === res;
            return (
              <button
                key={res}
                onClick={() => onChangeResolution(res)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{res}</span>
                  {res === '1080p' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                      Estándar
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)] block">
                  {cfg.width} × {cfg.height}
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-tight">
                  {cfg.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visualizer Effect Style */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
        <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Efecto de Audio Reactivo</span>
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Algoritmo visual que responde a las frecuencias de guitarra, voz y dinámica rítmica.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {EFFECT_OPTIONS.map((opt) => {
            const isSelected = effect === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChangeEffect(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
              >
                <span className="font-bold text-xs text-[var(--text-primary)] block mb-1">
                  {opt.name}
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Background Theme */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Atmósfera y Fondo Visual</span>
          </h3>
          <label className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Imagen Propia</span>
            <input
              type="file"
              accept="image/*"
              onChange={onCustomImageUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {THEME_OPTIONS.map((thm) => {
            const isSelected = theme === thm.id;
            return (
              <button
                key={thm.id}
                onClick={() => onChangeTheme(thm.id)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  isSelected
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${thm.gradient} shadow-inner border border-white/20`} />
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-full">
                  {thm.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Typography & Overlays */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
        <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
          <Type className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Tipografía y Elementos de Pantalla</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Estilo de Fuente de la Letra
            </label>
            <div className="flex gap-2">
              {[
                { id: 'serif', label: 'Serif Poético' },
                { id: 'sans', label: 'Sans Limpio' },
                { id: 'mono', label: 'Monospace' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => onChangeFontStyle(f.id as LyricFontStyle)}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                    fontStyle === f.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Marca de Agua / Canal de YouTube
            </label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => onChangeWatermarkText(e.target.value)}
              placeholder="@tonygb · Cancionero"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-6 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showChords}
              onChange={(e) => onChangeShowChords(e.target.checked)}
              className="rounded accent-[var(--accent-primary)]"
            />
            <span className="text-[var(--text-secondary)]">Mostrar cifrado de acordes sobre la letra</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMetadataBadge}
              onChange={(e) => onChangeShowMetadataBadge(e.target.checked)}
              className="rounded accent-[var(--accent-primary)]"
            />
            <span className="text-[var(--text-secondary)]">Cartela de título, autor y tono (superior izquierda)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showProgressBar}
              onChange={(e) => onChangeShowProgressBar(e.target.checked)}
              className="rounded accent-[var(--accent-primary)]"
            />
            <span className="text-[var(--text-secondary)]">Barra de progreso de audio inferior</span>
          </label>
        </div>
      </div>
    </div>
  );
};
