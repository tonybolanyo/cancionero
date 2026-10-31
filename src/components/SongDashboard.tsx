import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  BarChart3,
  Music,
  Layers,
  Calendar,
  Sparkles,
  Tag,
  Download,
  FolderArchive,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  FileJson,
  ShieldCheck,
  X
} from 'lucide-react';
import { Song } from '../types/song';
import { useTheme } from '../context/ThemeContext';
import {
  exportDatabaseWithAudioZip,
  downloadExportResult,
  ExportProgress
} from '../utils/databaseExportService';

interface SongDashboardProps {
  songs: Song[];
  isAuthor: boolean;
}

type ChartGrouping = 'genre' | 'key' | 'year' | 'tag';

export const SongDashboard: React.FC<SongDashboardProps> = ({ songs, isAuthor }) => {
  const [groupBy, setGroupBy] = useState<ChartGrouping>('genre');
  const { theme } = useTheme();

  // Full database export state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  const songsWithAudioCount = useMemo(() => {
    return songs.filter(s => !!s.audioUrl).length;
  }, [songs]);

  const handleExportFullDatabaseBackup = async () => {
    if (isExporting || songs.length === 0) return;

    setIsExporting(true);
    setExportFeedback(null);
    setExportProgress({
      message: 'Iniciando copia de seguridad externa...',
      percent: 5
    });

    try {
      const result = await exportDatabaseWithAudioZip(songs, (progress) => {
        setExportProgress(progress);
      });

      downloadExportResult(result);

      const sizeMb = (result.sizeBytes / (1024 * 1024)).toFixed(2);
      setExportFeedback({
        type: 'success',
        message: '¡Copia de seguridad externa descargada con éxito!',
        details: `Archivo: ${result.filename} (${sizeMb} MB) · ${result.totalSongs} canciones en songs.json · ${result.audioFilesIncluded} audios empaquetados en /audio/`
      });
    } catch (err: any) {
      console.error('Error al exportar base de datos con audios:', err);
      setExportFeedback({
        type: 'error',
        message: 'No se pudo completar la exportación de la copia de seguridad.',
        details: err.message || 'Error desconocido durante la compresión del archivo.'
      });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Aggregate data by genre
  const genreData = useMemo(() => {
    const counts: Record<string, { count: number; songs: string[] }> = {};
    songs.forEach(song => {
      const g = song.genre?.trim() || 'Sin género';
      if (!counts[g]) {
        counts[g] = { count: 0, songs: [] };
      }
      counts[g].count += 1;
      counts[g].songs.push(song.title);
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        songList: data.songs
      }))
      .sort((a, b) => b.count - a.count);
  }, [songs]);

  // Aggregate data by musical key
  const keyData = useMemo(() => {
    const counts: Record<string, { count: number; songs: string[] }> = {};
    songs.forEach(song => {
      const k = song.key?.trim() || 'Desconocida';
      if (!counts[k]) {
        counts[k] = { count: 0, songs: [] };
      }
      counts[k].count += 1;
      counts[k].songs.push(song.title);
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        songList: data.songs
      }))
      .sort((a, b) => b.count - a.count);
  }, [songs]);

  // Aggregate data by composition year
  const yearData = useMemo(() => {
    const counts: Record<string, { count: number; songs: string[] }> = {};
    songs.forEach(song => {
      const y = song.year ? song.year.toString() : 'N/A';
      if (!counts[y]) {
        counts[y] = { count: 0, songs: [] };
      }
      counts[y].count += 1;
      counts[y].songs.push(song.title);
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        songList: data.songs
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [songs]);

  // Aggregate data by tags
  const tagData = useMemo(() => {
    const counts: Record<string, { count: number; songs: string[] }> = {};
    songs.forEach(song => {
      if (song.tags && song.tags.length > 0) {
        song.tags.forEach(t => {
          const clean = t.trim().toLowerCase();
          if (!counts[clean]) {
            counts[clean] = { count: 0, songs: [] };
          }
          counts[clean].count += 1;
          counts[clean].songs.push(song.title);
        });
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name: `#${name}`,
        count: data.count,
        songList: data.songs
      }))
      .sort((a, b) => b.count - a.count);
  }, [songs]);

  const activeData = groupBy === 'genre'
    ? genreData
    : groupBy === 'key'
    ? keyData
    : groupBy === 'year'
    ? yearData
    : tagData;

  // Key stats
  const topGenre = genreData[0]?.name || 'N/A';
  const topKey = keyData[0]?.name || 'N/A';
  
  const averageBpm = useMemo(() => {
    const tempos = songs.filter(s => typeof s.tempo === 'number' && s.tempo > 0).map(s => s.tempo as number);
    if (tempos.length === 0) return null;
    const sum = tempos.reduce((a, b) => a + b, 0);
    return Math.round(sum / tempos.length);
  }, [songs]);

  // Accent color gradient sequence for bars
  const barColors = [
    '#d97706', // amber-600
    '#f59e0b', // amber-500
    '#b45309', // amber-700
    '#eab308', // yellow-500
    '#ca8a04', // yellow-600
    '#78716c'  // stone-500
  ];

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="p-3.5 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-xl text-xs space-y-1.5 max-w-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-[var(--text-primary)] font-serif text-sm">
              {label}
            </span>
            <span className="font-mono font-bold text-[var(--accent-primary)] px-2 py-0.5 rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
              {item.count} {item.count === 1 ? 'canción' : 'canciones'}
            </span>
          </div>

          {item.songList && item.songList.length > 0 && (
            <div className="pt-1.5 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-0.5">
              <span className="text-[var(--text-muted)] block font-medium">Temas:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {item.songList.slice(0, 5).map((title: string, idx: number) => (
                  <li key={idx} className="truncate">{title}</li>
                ))}
                {item.songList.length > 5 && (
                  <li className="text-[var(--text-muted)] list-none pl-3">
                    +{item.songList.length - 5} más...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const isDarkMode = theme === 'dark';
  const gridStroke = isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';
  const tickFill = isDarkMode ? '#a1a1aa' : '#57534e';

  return (
    <section id="dashboard-section" className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-12 border-t border-[var(--border-subtle)]">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard & Analítica Musical</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Distribución Armónica y Estilística
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Visualización estadística del repertorio basada en los metadatos almacenados en archivos Markdown
          </p>
        </div>

        {/* View Segmented Switcher & Export Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setGroupBy('genre')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'genre'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Género</span>
            </button>

            <button
              onClick={() => setGroupBy('key')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'key'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Por Tonalidad</span>
            </button>

            <button
              onClick={() => setGroupBy('year')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'year'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Por Año</span>
            </button>

            <button
              onClick={() => setGroupBy('tag')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'tag'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Por Tag</span>
            </button>
          </div>

          <button
            onClick={handleExportFullDatabaseBackup}
            disabled={isExporting || songs.length === 0}
            title="Exportar archivo songs.json completo y pistas de audio en un archivo comprimido .zip"
            className="px-3.5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:shadow disabled:opacity-50 shrink-0"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                <span>Empaquetando...</span>
              </>
            ) : (
              <>
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Exportar songs.json + Audios (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <span className="text-xs text-[var(--text-muted)] font-medium block">
            Género Predominante
          </span>
          <span className="text-lg sm:text-xl font-bold font-serif text-[var(--text-primary)] truncate block mt-1">
            {topGenre}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
            {genreData[0]?.count || 0} canciones
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <span className="text-xs text-[var(--text-muted)] font-medium block">
            Tonalidad Más Usada
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-[var(--accent-primary)] block mt-1">
            {topKey}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
            {keyData[0]?.count || 0} composiciones
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <span className="text-xs text-[var(--text-muted)] font-medium block">
            Tempo Promedio
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] block mt-1">
            {averageBpm ? `${averageBpm} BPM` : 'Variable'}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
            Pulsaciones por minuto
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <span className="text-xs text-[var(--text-muted)] font-medium block">
            Repertorio Analizado
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[var(--text-primary)] block mt-1">
            {songs.length}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
            {isAuthor ? 'Total con borradores' : 'Temas públicos'}
          </span>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] transition-colors duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            {groupBy === 'genre'
              ? 'Número de Canciones por Género Musical'
              : groupBy === 'key'
              ? 'Frecuencia de Canciones por Tonalidad (Key)'
              : 'Evolución de Composiciones por Año'}
          </h3>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Gráfico interactivo · Pasa el ratón para ver detalles
          </span>
        </div>

        {activeData.length > 0 ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeData}
                margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={gridStroke}
                />
                <XAxis
                  dataKey="name"
                  stroke={tickFill}
                  tick={{ fill: tickFill, fontSize: 12, fontFamily: 'var(--font-sans)' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  interval={0}
                  angle={activeData.length > 5 ? -25 : 0}
                  textAnchor={activeData.length > 5 ? 'end' : 'middle'}
                />
                <YAxis
                  allowDecimals={false}
                  stroke={tickFill}
                  tick={{ fill: tickFill, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                >
                  {activeData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={barColors[index % barColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-xs text-[var(--text-muted)]">
            No hay suficientes datos disponibles para graficar.
          </div>
        )}

        {/* Footnote about musical data */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[var(--text-muted)] gap-2">
          <span>
            💡 Los datos se actualizan en tiempo real al agregar o modificar canciones en formato Markdown.
          </span>
          <span className="font-mono text-[11px]">
            Librería: Recharts · Renderizado SVG reactivo
          </span>
        </div>
      </div>

      {/* Full Database + Audio External Backup Card */}
      <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4 transition-colors duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
                <FolderArchive className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Copia de Seguridad Externa Completa (Base de Datos + Archivos de Audio)
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Exporta el estado completo de la base de datos (<code className="text-[var(--accent-primary)] font-mono font-semibold">songs.json</code>) comprimido en un paquete <code className="text-[var(--text-primary)] font-mono font-semibold">.zip</code> junto con todas las maquetas y archivos de audio vinculados (<code className="text-[var(--accent-primary)] font-mono">.mp3</code> / <code className="text-[var(--accent-primary)] font-mono">.wav</code>) en el directorio <code className="text-[var(--text-primary)] font-mono">/audio/</code>, los archivos individuales de canciones en Markdown (<code className="text-[var(--accent-primary)] font-mono">/songs/</code>) y el manifiesto técnico de pistas (<code className="text-[var(--text-primary)] font-mono">audio-manifest.json</code>).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>songs.json ({songs.length} temas)</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center gap-1.5">
                <FileAudio className="w-3.5 h-3.5 text-emerald-500" />
                <span>{songsWithAudioCount} pistas de audio asociadas</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Restauración offline</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-center gap-3 shrink-0">
            <button
              onClick={handleExportFullDatabaseBackup}
              disabled={isExporting || songs.length === 0}
              className="py-3 px-5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                  <span>Procesando Copia...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Copia Completa (.zip)</span>
                </>
              )}
            </button>
            <span className="text-[10px] text-[var(--text-muted)] text-center lg:text-right">
              Formato ZIP estándar · Compatible con Windows, Mac, Linux
            </span>
          </div>
        </div>

        {/* Live Export Progress Indicator */}
        {isExporting && exportProgress && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--accent-border)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <span>{exportProgress.message}</span>
              </span>
              <span className="font-mono font-bold text-[var(--accent-primary)]">
                {exportProgress.percent}%
              </span>
            </div>
            <div className="w-full bg-[var(--bg-canvas)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
              <div
                className="bg-[var(--accent-primary)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Success / Error Notification */}
        {exportFeedback && (
          <div
            className={`p-4 rounded-xl text-xs flex items-start justify-between gap-3 ${
              exportFeedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-500/15 border border-red-500/30 text-red-800 dark:text-red-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {exportFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">{exportFeedback.message}</span>
                {exportFeedback.details && (
                  <p className="text-[11px] opacity-90 leading-relaxed font-mono">
                    {exportFeedback.details}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setExportFeedback(null)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
