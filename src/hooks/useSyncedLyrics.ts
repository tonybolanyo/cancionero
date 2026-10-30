import { useMemo, useEffect, useRef, useCallback } from 'react';
import { SyncedLyricLine } from '../types/lyrics';

export interface UseSyncedLyricsOptions {
  lines: SyncedLyricLine[];
  currentTime: number;
  autoScroll?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  scrollOffsetFraction?: number; // 0.3 = centrar o situar a un tercio de la vista
}

export interface UseSyncedLyricsReturn {
  activeIndex: number;
  activeLine: SyncedLyricLine | null;
  nextLine: SyncedLyricLine | null;
  previousLine: SyncedLyricLine | null;
  lineProgress: number; // 0..1 avance dentro de la línea actual
  seekToLine: (index: number) => number; // Retorna tiempo en segundos
  scrollToActiveLine: (behavior?: ScrollBehavior) => void;
}

/**
 * Hook para sincronizar el tiempo de reproducción con las líneas de letra LRC
 */
export function useSyncedLyrics({
  lines,
  currentTime,
  autoScroll = true,
  scrollContainerRef,
  scrollOffsetFraction = 0.35
}: UseSyncedLyricsOptions): UseSyncedLyricsReturn {
  const lastActiveIndexRef = useRef<number>(-1);

  // Encontrar la línea activa mediante búsqueda binaria rápida
  const activeIndex = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    if (currentTime < lines[0].time) return -1;

    // Búsqueda binaria para encontrar el último elemento con line.time <= currentTime
    let low = 0;
    let high = lines.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lines[mid].time <= currentTime) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }, [lines, currentTime]);

  const activeLine = activeIndex >= 0 && activeIndex < lines.length ? lines[activeIndex] : null;
  const nextLine = activeIndex + 1 < lines.length ? lines[activeIndex + 1] : null;
  const previousLine = activeIndex > 0 ? lines[activeIndex - 1] : null;

  // Progreso fraccionario dentro de la línea actual (0.0 a 1.0)
  const lineProgress = useMemo(() => {
    if (!activeLine) return 0;
    const startTime = activeLine.time;
    const endTime = nextLine ? nextLine.time : startTime + 4.0;
    const duration = endTime - startTime;
    if (duration <= 0.01) return 1;
    return Math.min(1, Math.max(0, (currentTime - startTime) / duration));
  }, [activeLine, nextLine, currentTime]);

  // Función para desplazar el contenedor suavemente hacia la línea activa
  const scrollToActiveLine = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!scrollContainerRef?.current || activeIndex < 0) return;

    const container = scrollContainerRef.current;
    const activeEl = container.querySelector(`[data-lyric-index="${activeIndex}"]`) as HTMLElement | null;

    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeEl.getBoundingClientRect();
      
      const currentScrollTop = container.scrollTop;
      const elementRelativeTop = elementRect.top - containerRect.top;
      const targetScrollTop = currentScrollTop + elementRelativeTop - (container.clientHeight * scrollOffsetFraction);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior
      });
    }
  }, [activeIndex, scrollContainerRef, scrollOffsetFraction]);

  // Auto-scroll reactivo cuando cambia la línea activa
  useEffect(() => {
    if (autoScroll && activeIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = activeIndex;
      if (activeIndex >= 0) {
        scrollToActiveLine('smooth');
      }
    }
  }, [activeIndex, autoScroll, scrollToActiveLine]);

  // Helper para buscar el tiempo de una línea dada
  const seekToLine = useCallback((index: number): number => {
    if (!lines || index < 0 || index >= lines.length) return 0;
    return lines[index].time;
  }, [lines]);

  return {
    activeIndex,
    activeLine,
    nextLine,
    previousLine,
    lineProgress,
    seekToLine,
    scrollToActiveLine
  };
}
