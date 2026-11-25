import { resolveAppUrl } from '../../utils/appUrl';
import { getAudioDurationSeconds } from './duration';

export function buildAudioUploadFormData(file: File, mimeType: string): FormData {
  const formData = new FormData();
  formData.append('audio', file, file.name);
  formData.append('mimeType', mimeType);
  formData.append('filename', file.name);
  return formData;
}

export async function requestServerAudioAnalysis(
  file: File,
  mimeType: string,
  token: string
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  durationSeconds: number;
}> {
  const formData = buildAudioUploadFormData(file, mimeType);

  const [response, durationSeconds] = await Promise.all([
    fetch(resolveAppUrl('api/analyze-audio'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }),
    getAudioDurationSeconds(file).catch(() => 0)
  ]);

  const data = response.ok ? await response.json() : null;
  return {
    ok: response.ok,
    status: response.status,
    data,
    durationSeconds
  };
}

export async function requestServerLyricsTranscription(
  file: File,
  mimeType: string,
  token: string
): Promise<{
  ok: boolean;
  status: number;
  data: any;
}> {
  const formData = buildAudioUploadFormData(file, mimeType);

  const response = await fetch(resolveAppUrl('api/transcribe-lyrics'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = response.ok ? await response.json() : null;
  return {
    ok: response.ok,
    status: response.status,
    data
  };
}
