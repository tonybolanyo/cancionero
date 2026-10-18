import React from 'react';
import { X, Music, GitBranch, FileCode, Shield, Compass, Palette } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-y-auto text-[var(--text-primary)] transition-colors duration-200">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Manifiesto del Cancionero & Personalización
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed font-serif bg-[var(--bg-surface)]">
          <p>
            Este cancionero reúne todas las canciones compuestas a lo largo de los años en un espacio propio,
            sin bases de datos ni suscripciones privativas.
          </p>

          <div className="space-y-4 not-italic font-sans">
            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex gap-3">
              <Palette className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                  Variables CSS & Personalización Global
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Todos los estilos visuales (tipografías <code className="text-[var(--accent-primary)] font-semibold">--font-sans</code>, <code className="text-[var(--accent-primary)] font-semibold">--font-serif</code> y colores de lienzo, tarjetas, textos y acentos) están centralizados como variables CSS en <code className="text-[var(--accent-primary)] font-semibold">src/index.css</code>. Puedes cambiar los colores tanto del modo claro como del modo oscuro modificando únicamente ese bloque.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex gap-3">
              <Music className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                  Centralización Multiplataforma
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Los temas publicados integran reproductores directos de Spotify, YouTube y SoundCloud, permitiendo al oyente disfrutar del audio sin salir de la lectura de las letras.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex gap-3">
              <FileCode className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                  Soberanía de Datos: Markdown & JSON
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Cero bases de datos complejas. Cada composición vive en su propio archivo <code className="text-[var(--accent-primary)] font-semibold">.md</code> con encabezado YAML para metadatos (tonalidad, tempo, compás) y letra con cifrado de acordes transportable.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex gap-3">
              <GitBranch className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                  Control de Versiones Tipo Git
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Cada cambio en un verso o acorde se puede registrar con un commit de Git. Puedes exportar el repositorio completo en un ZIP listo para GitHub o sincronizarlo con tu flujo de trabajo local.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex gap-3">
              <Shield className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                  Borradores & Canciones Privadas
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  El cancionero ofrece filtros específicos para maquetas de estudio, ideas en desarrollo e inéditas privadas sin enlaces públicos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
