import { SyncedLyricLine } from '../../types/lyrics';
import { TranscriptionSegment } from '../../types/transcription';

function sanitizeSegmentText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeTranscriptionSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
  const cleaned = segments
    .map((segment) => {
      const start = Number.isFinite(segment.start) ? Math.max(0, segment.start) : 0;
      const end = Number.isFinite(segment.end) ? Math.max(start, segment.end) : start;
      const text = sanitizeSegmentText(segment.text || '');
      return { start, end, text };
    })
    .filter((segment) => segment.text.length > 0);

  cleaned.sort((a, b) => a.start - b.start);
  return cleaned;
}

export function segmentsToSyncedLyricLines(segments: TranscriptionSegment[]): SyncedLyricLine[] {
  const normalized = normalizeTranscriptionSegments(segments);
  return normalized.map((segment, index) => ({
    id: `asr-line-${index}-${Math.round(segment.start * 100)}`,
    time: Number(segment.start.toFixed(2)),
    text: segment.text
  }));
}
