import React from 'react';
import { Download, FileText, FolderArchive, ShieldCheck, Upload } from 'lucide-react';

export interface GitExportTabProps {
  onDownloadZip: () => void;
  onDownloadJson: () => void;
  onResetCatalog: () => void;
}

export const GitExportTab: React.FC<GitExportTabProps> = ({
  onDownloadZip,
  onDownloadJson,
  onResetCatalog
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] mb-3">
              <FolderArchive className="w-5 h-5" />
            </div>
            <h4 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
              Repositorio Completo (.zip)
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Descarga un archivo ZIP listo para descomprimir e iniciar un repositorio Git en tu ordenador.
              Incluye la carpeta <code className="text-[var(--accent-primary)] font-semibold">songs/*.md</code>,{' '}
              <code className="text-[var(--accent-primary)] font-semibold">catalog.json</code>,{' '}
              <code className="text-[var(--accent-primary)] font-semibold">README.md</code> y{' '}
              <code className="text-[var(--accent-primary)] font-semibold">.gitignore</code>.
            </p>
          </div>
          <button
            onClick={onDownloadZip}
            className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Repositorio ZIP</span>
          </button>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
              Catálogo Completo (catalog.json)
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Exporta la base de datos completa en formato JSON estructurado con metadatos de acordes, tonalidades, BPM y enlaces a Spotify, YouTube y SoundCloud.
            </p>
          </div>
          <button
            onClick={onDownloadJson}
            className="w-full py-2.5 px-4 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Exportar catalog.json</span>
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-[var(--text-primary)] block">
            Restablecer catálogo a canciones de demostración
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            Recarga las 6 canciones predeterminadas con letras, maquetas y acordes.
          </span>
        </div>
        <button
          onClick={onResetCatalog}
          className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        >
          Restablecer
        </button>
      </div>
    </div>
  );
};

export interface GitImportTabProps {
  backupCount: number;
  onGoToBackups: () => void;
  mdFileInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onMdUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJsonUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const GitImportTab: React.FC<GitImportTabProps> = ({
  backupCount,
  onGoToBackups,
  mdFileInputRef,
  fileInputRef,
  onMdUpload,
  onJsonUpload
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
      <div className="p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-xs font-bold text-[var(--text-primary)] block">
            Protección automática contra pérdida de datos
          </span>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Antes de procesar cualquier archivo Markdown o JSON, se crea automáticamente un punto de restauración del repertorio actual. Si surge algún conflicto o error en el archivo, puedes regresar al estado anterior con un solo clic en la pestaña{' '}
            <button
              type="button"
              onClick={onGoToBackups}
              className="font-bold underline text-[var(--accent-primary)] hover:opacity-80 cursor-pointer"
            >
              Puntos de Restauración ({backupCount})
            </button>
            .
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        Sube tus propios archivos desde tu disco duro o repositorio Git para sincronizarlos con la aplicación:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
              Importar Archivos Markdown (.md)
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Sube uno o varios archivos <code className="text-[var(--accent-primary)] font-semibold">.md</code> con encabezado YAML. Se añadirán o actualizarán en tu repertorio automáticamente.
            </p>
          </div>
          <input
            type="file"
            ref={mdFileInputRef}
            onChange={onMdUpload}
            accept=".md,.markdown,.txt"
            multiple
            className="hidden"
          />
          <button
            onClick={() => mdFileInputRef.current?.click()}
            className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Seleccionar archivos .md</span>
          </button>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
              Importar Catálogo JSON
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Sube un archivo <code className="text-[var(--accent-primary)] font-semibold">catalog.json</code> o copia de seguridad previa para fusionar canciones.
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onJsonUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-4 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Seleccionar archivo .json</span>
          </button>
        </div>
      </div>
    </div>
  );
};
