import React from 'react';
import { ArrowLeft, Compass, Palette, Music, FileCode, Shield, GitBranch } from 'lucide-react';
import { siteMetadata } from '../utils/siteConfig';
import { useAppNavigation } from '../context/NavigationContext';

export const AboutPage: React.FC = () => {
  const { goBack } = useAppNavigation();

  return (
    <div className="max-w-[900px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>
      </div>

      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1 flex items-center gap-2">
          <Compass className="w-3.5 h-3.5" />
          <span>Filosofía & Manifiesto</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
          {siteMetadata.name}
        </h1>
        <p className="text-base font-serif italic text-[var(--text-secondary)] mt-2 leading-relaxed">
          "{siteMetadata.description}"
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-serif leading-relaxed">
          <p>
            Este cancionero nace como un espacio vivo para preservar las composiciones, letras íntimas y pequeñas verdades creadas con guitarra y voz. Lejos del ruido y de los algoritmos efímeros, cada canción se concibe como una obra artesanal con su propia historia, métrica y armonía.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-subtle)] not-italic font-sans">
          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
              <Disc className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Agrupación por Álbumes</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Discografía organizada con títulos, tracks ordenados, enlaces directos a Spotify, Apple Music, YouTube y SoundCloud, además de notas de producción.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
              <Music className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Edición Atril & Escenario</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Exportación en formato imprimible PDF adaptado para atril de músico, con acordes sobre la letra o en línea, transposición instantánea y letras sincronizadas (LRC).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
              <FileCode className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Formato Markdown Puro (.md)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Cada canción se conserva en texto plano con frontmatter YAML, garantizando legibilidad a largo plazo, independencia de plataformas y compatibilidad total con Git.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
              <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Variables CSS & Modo Dual</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Arquitectura dual (modo claro / modo oscuro) gobernada mediante variables semánticas centralizadas en el sistema de diseño.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function Disc(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
