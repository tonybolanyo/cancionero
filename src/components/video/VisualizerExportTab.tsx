import React from 'react';
import { Check, Cloud, Download, Film, Info } from 'lucide-react';
import { formatFileSize, RESOLUTION_PRESETS } from '../../lib/video/presets';
import { VideoResolution } from '../../lib/video/types';

export interface VisualizerExportTabProps {
  resolution: VideoResolution;
  recordedBlob: Blob | null;
  recordedVideoUrl: string | null;
  isUploadingToDrive: boolean;
  driveUploadSuccess: string | null;
  driveUploadError: string | null;
  onDownloadVideo: () => void;
  onSaveToDrive: () => void;
  onGoToPreview: () => void;
}

export const VisualizerExportTab: React.FC<VisualizerExportTabProps> = ({
  resolution,
  recordedBlob,
  recordedVideoUrl,
  isUploadingToDrive,
  driveUploadSuccess,
  driveUploadError,
  onDownloadVideo,
  onSaveToDrive,
  onGoToPreview
}) => {
  const selectedResConfig = RESOLUTION_PRESETS[resolution];

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      {recordedVideoUrl ? (
        <div className="p-6 rounded-3xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] shadow-sm space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)]">
                ¡Vídeo renderizado con éxito!
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Resolución: {selectedResConfig.width}x{selectedResConfig.height} ({resolution}) · Peso: {formatFileSize(recordedBlob?.size || 0)}
              </p>
            </div>
          </div>

          <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-md">
            <video
              src={recordedVideoUrl}
              controls
              onError={(e) => {
                console.warn('Error al reproducir la previsualización de vídeo renderizado:', e);
              }}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={onDownloadVideo}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Vídeo para YouTube</span>
            </button>

            <button
              onClick={onSaveToDrive}
              disabled={isUploadingToDrive}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Cloud className="w-4 h-4" />
              <span>
                {isUploadingToDrive ? 'Subiendo a Google Drive...' : 'Guardar en Google Drive'}
              </span>
            </button>
          </div>

          {driveUploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0" />
              <span>{driveUploadSuccess}</span>
            </div>
          )}

          {driveUploadError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
              <Info className="w-4 h-4 shrink-0" />
              <span>{driveUploadError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center rounded-3xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            Aún no has grabado el vídeo de la canción
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
            Puedes ajustar los parámetros en la pestaña anterior y pulsar "Grabar Vídeo". El sistema capturará el lienzo a {resolution} junto con el audio sincronizado.
          </p>
          <button
            onClick={onGoToPreview}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-md"
          >
            Ir a la Previsualización
          </button>
        </div>
      )}
    </div>
  );
};
