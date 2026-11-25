import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_MIMES,
  MAX_AUDIO_UPLOAD_BYTES,
  normalizeAudioMimeType,
  prepareGeminiAudioPart,
  resolveGeminiAudioModel,
  resolveGeminiTranscribeModel,
  type AudioPartSource,
  type PreparedGeminiAudioPart
} from './src/lib/server/geminiAudio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTHORIZED_GITHUB_USER = (
  process.env.VITE_GITHUB_ALLOWED_USER ||
  process.env.AUTHORIZED_GITHUB_USER ||
  'tonygb'
).trim().toLowerCase();

const AUTHORIZED_AUTHOR_EMAIL = (
  process.env.VITE_AUTHORIZED_AUTHOR_EMAIL ||
  process.env.AUTHORIZED_AUTHOR_EMAIL ||
  'tony@tonygb.com'
).trim().toLowerCase();

// In-memory token verification cache to avoid excessive external API roundtrips
interface CachedTokenVerification {
  authorized: boolean;
  userIdentifier: string;
  expiresAt: number;
}
const tokenVerificationCache = new Map<string, CachedTokenVerification>();

// Rate limiter storage: IP -> Array of timestamps in ms
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 requests per minute

/**
 * Middleware: Rate limiter for API endpoints to prevent DoS & credit abuse
 */
function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Filter timestamps within current window
  const activeTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (activeTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes al servidor. Por favor, inténtalo de nuevo en un minuto.'
    });
  }

  activeTimestamps.push(now);
  rateLimitMap.set(ip, activeTimestamps);

  // Periodic cleanup
  if (rateLimitMap.size > 2000) {
    rateLimitMap.clear();
  }

  next();
}

/**
 * Verifies if the request carries a token belonging to the authorized author
 */
async function verifyAuthorRequest(req: Request): Promise<{ authorized: boolean; reason?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, reason: 'Cabecera Authorization Bearer requerida.' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authorized: false, reason: 'Token de autorización ausente.' };
  }

  // Check cache
  const cached = tokenVerificationCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return { authorized: cached.authorized, reason: cached.authorized ? undefined : 'Token no autorizado.' };
  }

  // 1. Try GitHub REST API (PAT)
  try {
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'tony-cancionero-server'
      }
    });

    if (ghRes.ok) {
      const ghUser = await ghRes.json();
      const login = String(ghUser.login || '').trim().toLowerCase();
      const isAllowed = login === AUTHORIZED_GITHUB_USER;

      tokenVerificationCache.set(token, {
        authorized: isAllowed,
        userIdentifier: login,
        expiresAt: Date.now() + 5 * 60 * 1000 // Cache for 5 minutes
      });

      if (isAllowed) {
        return { authorized: true };
      }
      return { authorized: false, reason: `Usuario @${login} no coincide con el autor autorizado (@${AUTHORIZED_GITHUB_USER}).` };
    }
  } catch {
    // If GitHub check fails or token is not GitHub, proceed to Google check
  }

  // 2. Try Google OAuth tokeninfo
  try {
    const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (googleRes.ok) {
      const googleData = await googleRes.json();
      const email = String(googleData.email || '').trim().toLowerCase();
      const isAllowed = email === AUTHORIZED_AUTHOR_EMAIL;

      tokenVerificationCache.set(token, {
        authorized: isAllowed,
        userIdentifier: email,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      if (isAllowed) {
        return { authorized: true };
      }
      return { authorized: false, reason: `Cuenta Google (${email}) no coincide con el correo propietario (${AUTHORIZED_AUTHOR_EMAIL}).` };
    }
  } catch {
    // Google check failed
  }

  tokenVerificationCache.set(token, {
    authorized: false,
    userIdentifier: 'invalid',
    expiresAt: Date.now() + 60 * 1000
  });

  return { authorized: false, reason: 'Token de autorización inválido o no reconocido.' };
}

/**
 * Middleware: Strictly enforce author authorization on sensitive endpoints
 */
async function requireAuthorAuth(req: Request, res: Response, next: NextFunction) {
  const check = await verifyAuthorRequest(req);
  if (!check.authorized) {
    return res.status(403).json({
      success: false,
      error: `Acceso denegado: Operación reservada exclusivamente para el autor propietario (@${AUTHORIZED_GITHUB_USER} / ${AUTHORIZED_AUTHOR_EMAIL}). ${check.reason || ''}`
    });
  }
  next();
}

/**
 * Sanitize filename to prevent directory traversal or control characters
 */
function sanitizeFileName(filename: unknown): string {
  if (typeof filename !== 'string') return 'audio';
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\.\.+/g, '.')
    .trim()
    .slice(0, 100);
}

const AUDIO_UPLOAD_TMP_DIR = path.join(os.tmpdir(), 'cancionero-audio-uploads');
fs.mkdirSync(AUDIO_UPLOAD_TMP_DIR, { recursive: true });

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, AUDIO_UPLOAD_TMP_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_AUDIO_EXTENSIONS.has(ext) ? ext : '.audio';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    }
  }),
  limits: {
    fileSize: MAX_AUDIO_UPLOAD_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const baseMime = (file.mimetype || '').split(';')[0].toLowerCase().trim();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isAllowed =
      ALLOWED_AUDIO_MIMES.has(baseMime) ||
      baseMime.startsWith('audio/') ||
      ALLOWED_AUDIO_EXTENSIONS.has(ext);
    if (!isAllowed) {
      return cb(new Error('Formato de audio no soportado.'));
    }
    cb(null, true);
  }
});

function handleAudioUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  audioUpload.single('audio')(req, res, (err: any) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: `El archivo de audio supera el límite máximo permitido (${Math.round(MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024))} MB).`
        });
      }
      return res.status(400).json({
        success: false,
        error: `Error procesando el archivo subido: ${err.message}`
      });
    }
    return res.status(400).json({
      success: false,
      error: err?.message || 'Archivo de audio inválido.'
    });
  });
}

function extractAudioSourceFromRequest(req: Request, defaultMime: string): AudioPartSource | null {
  if (req.file) {
    const cleanFilename = sanitizeFileName(req.body?.filename || req.file.originalname || 'audio');
    const validMime = normalizeAudioMimeType(req.body?.mimeType || req.file.mimetype, cleanFilename, defaultMime);
    return {
      filePath: req.file.path,
      sizeBytes: req.file.size,
      mimeType: validMime,
      filename: cleanFilename
    };
  }

  const { audioBase64, mimeType, filename } = req.body || {};
  if (audioBase64 && typeof audioBase64 === 'string') {
    const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanData, 'base64');
    if (buffer.length > 0) {
      const cleanFilename = sanitizeFileName(filename);
      const validMime = normalizeAudioMimeType(mimeType, cleanFilename, defaultMime);
      return {
        buffer,
        sizeBytes: buffer.length,
        mimeType: validMime,
        filename: cleanFilename
      };
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  // Dev server must always run on port 3000 as required by the environment
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Safe JSON/urlencoded limits (audio files are streamed via multipart/form-data)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  const rawBase = process.env.VITE_BASE_URL || process.env.BASE_PATH || '/cancionero/';
  const normalizedBase = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const basePath = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
  const baseMount = basePath === '/' ? '/' : basePath.slice(0, -1);

  const apiRouter = express.Router();
  apiRouter.use(apiRateLimiter);

  // API Endpoint: Audio Musical Analysis via Gemini AI (Protected: Author Only)
  apiRouter.post('/analyze-audio', requireAuthorAuth, handleAudioUpload, async (req, res) => {
    const tempFilePath = req.file?.path;
    let preparedAudio: PreparedGeminiAudioPart | null = null;

    try {
      const audioSource = extractAudioSourceFromRequest(req, 'audio/mpeg');
      if (!audioSource) {
        return res.status(400).json({ success: false, error: 'No se recibieron datos de audio válidos.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: 'GEMINI_API_KEY no configurada en variables de entorno del servidor.',
          needsApiKey: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const model = resolveGeminiAudioModel();
      preparedAudio = await prepareGeminiAudioPart(ai, audioSource);

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            preparedAudio.part,
            {
              text: `Actúa como un productor musical, guitarrista y transcriptor experto de canciones acústicas y de autor.
Analiza con precisión este archivo de audio (${audioSource.filename || 'canción en mp3/wav'}).
Detecta de forma rigurosa:
1. tempo: entero en BPM (pulsaciones por minuto, ej. 85, 96, 110, 128).
2. key: tonalidad principal en notación estándar anglosajona (ej. 'Am', 'G', 'C', 'Em', 'D', 'Dm', 'F#m', 'E').
3. scale: escala o modo musical (ej. 'Menor natural', 'Mayor', 'Menor armónica', 'Dórico').
4. timeSignature: compás musical (ej. '4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '7/4', '5/8', '9/8', '12/8').
5. tuning: afinación estimada del instrumento (ej. 'Estándar (EADGBE)', 'Drop D', 'Capo 2').
6. chordProgression: resumen sintético de la secuencia armónica principal (ej. 'Am - F - C - G').
7. chords: lista cronológica de los acordes detectados con su timestamp aproximado y la sección (Intro, Estrofa, Estribillo, Puente).
8. musicalNotes: observaciones estilísticas sobre ritmo, dinámica y arpegio.
9. suggestedLyricsChords: versos sugeridos con acordes entre corchetes para la letra (ej. '[Am] Verso inicial... [G] siguiente línea').`
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tempo: { type: Type.INTEGER, description: 'Tempo en BPM estimado' },
              key: { type: Type.STRING, description: 'Tonalidad musical ej. Am, C, G' },
              scale: { type: Type.STRING, description: 'Escala musical ej. Menor natural, Mayor' },
              timeSignature: { type: Type.STRING, description: 'Compás métrico ej. 4/4, 3/4, 6/8, 5/4, 7/8, 7/4, 5/8, 9/8, 12/8' },
              tuning: { type: Type.STRING, description: 'Afinación del instrumento' },
              chordProgression: { type: Type.STRING, description: 'Secuencia principal ej. Am - F - C - G' },
              chords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.STRING, description: 'Marca de tiempo ej. 0:00, 0:15' },
                    chord: { type: Type.STRING, description: 'Acorde ej. Am, F, C, G, Dm' },
                    section: { type: Type.STRING, description: 'Sección musical ej. Intro, Estrofa, Estribillo' }
                  },
                  required: ['timestamp', 'chord']
                }
              },
              musicalNotes: { type: Type.STRING, description: 'Notas musicales y estilo' },
              suggestedLyricsChords: { type: Type.STRING, description: 'Letra con acordes entre corchetes' }
            },
            required: ['tempo', 'key', 'scale', 'timeSignature', 'chordProgression']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        success: true,
        source: 'gemini_ai',
        model,
        transport: preparedAudio.transport,
        analysis: parsed
      });
    } catch (err: any) {
      const isDepleted =
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.status === 402 ||
        String(err?.message).includes('402') ||
        String(err?.message).includes('prepayment credits are depleted') ||
        String(err?.message).includes('RESOURCE_EXHAUSTED');

      if (isDepleted) {
        console.warn('Audio analysis API: Gemini prepayment credits depleted. Delegating to client-side Web Audio DSP.');
        return res.status(200).json({
          success: false,
          creditsDepleted: true,
          error: 'Créditos de prepago agotados en AI Studio. Procesamiento delegado al motor local Web Audio DSP.'
        });
      }

      console.warn('Audio analysis API warning:', err.message || err);
      return res.status(200).json({
        success: false,
        error: err.message || 'Error procesando el análisis con el modelo IA. Usa el motor local Web Audio.'
      });
    } finally {
      await preparedAudio?.cleanup();
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }
  });

  // API Endpoint: Lyrics transcription (Protected: Author Only)
  apiRouter.post('/transcribe-lyrics', requireAuthorAuth, handleAudioUpload, async (req, res) => {
    const tempFilePath = req.file?.path;
    let preparedAudio: PreparedGeminiAudioPart | null = null;

    try {
      const audioSource = extractAudioSourceFromRequest(req, 'audio/mpeg');
      if (!audioSource) {
        return res.status(400).json({ success: false, error: 'No se recibieron datos de audio válidos.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: 'GEMINI_API_KEY no configurada en variables de entorno del servidor.',
          needsApiKey: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const model = resolveGeminiTranscribeModel();
      preparedAudio = await prepareGeminiAudioPart(ai, audioSource);

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            preparedAudio.part,
            {
              text: `Transcribe la letra cantada del audio (${audioSource.filename || 'canción'}) en idioma original.
Devuelve SOLO JSON con esta estructura:
{
  "text": "transcripción completa",
  "segments": [
    { "start": 0.0, "end": 3.2, "text": "línea o frase" }
  ]
}
Reglas:
- start y end en segundos (número decimal).
- Mantén orden temporal.
- Omite texto dudoso en lugar de inventarlo.
- Si no hay voz cantada comprensible, devuelve text vacío y segments vacío.`
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER },
                    text: { type: Type.STRING }
                  },
                  required: ['start', 'end', 'text']
                }
              }
            },
            required: ['text', 'segments']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const segments = Array.isArray(parsed.segments)
        ? parsed.segments
            .map((segment: { start?: number; end?: number; text?: string }) => ({
              start: Number.isFinite(segment.start) ? Math.max(0, Number(segment.start)) : 0,
              end: Number.isFinite(segment.end) ? Math.max(0, Number(segment.end)) : 0,
              text: String(segment.text || '').trim()
            }))
            .filter((segment: { text: string }) => segment.text.length > 0)
        : [];

      return res.json({
        success: true,
        source: 'gemini_ai',
        model,
        transport: preparedAudio.transport,
        transcription: {
          text: String(parsed.text || '').trim(),
          segments
        }
      });
    } catch (err: any) {
      console.warn('Lyrics transcription API warning:', err.message || err);
      return res.status(200).json({
        success: false,
        error: err.message || 'Error procesando la transcripción con el modelo IA.'
      });
    } finally {
      await preparedAudio?.cleanup();
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }
  });

  // Healthcheck endpoint
  apiRouter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      audioModel: resolveGeminiAudioModel()
    });
  });

  // Return JSON 404 for unknown API endpoints
  apiRouter.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint de API no encontrado.' });
  });

  app.use('/api', apiRouter);
  if (baseMount !== '/') {
    app.use(`${baseMount}/api`, apiRouter);
  }

  // Direct endpoint to serve fresh catalog.json with no-cache headers
  const catalogRoutes = Array.from(
    new Set(['/catalog.json', `${basePath}catalog.json`, '/cancionero/catalog.json'])
  );
  app.get(catalogRoutes, (req, res) => {
    const catalogPath = path.resolve(__dirname, 'catalog.json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(catalogPath);
  });

  // Serve Vite in dev mode or static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (baseMount !== '/') {
      app.use(baseMount, express.static(distPath));
    }
    app.use(express.static(distPath));

    // Avoid serving index.html with 200 OK for missing static assets/data files
    const missingAssetPattern = /\/(assets|data)\/|\.wasm$|\.json$/i;
    app.get('*', (req, res) => {
      if (missingAssetPattern.test(req.path)) {
        return res.status(404).type('text/plain').send('Not Found');
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
