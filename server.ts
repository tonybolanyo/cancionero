import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Increase payload limit for audio files (mp3/wav)
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // API Endpoint: Audio Musical Analysis via Gemini AI
  app.post('/api/analyze-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType, filename } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'No se recibieron datos de audio.' });
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

      // Format clean base64 data
      const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const validMime = mimeType?.includes('wav') ? 'audio/wav' : 'audio/mp3';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: validMime,
                data: cleanData
              }
            },
            {
              text: `Actúa como un productor musical, guitarrista y transcriptor experto de canciones acústicas y de autor.
Analiza con precisión este archivo de audio (${filename || 'canción en mp3/wav'}).
Detecta de forma rigurosa:
1. tempo: entero en BPM (pulsaciones por minuto, ej. 85, 96, 110, 128).
2. key: tonalidad principal en notación estándar anglosajona (ej. 'Am', 'G', 'C', 'Em', 'D', 'Dm', 'F#m', 'E').
3. scale: escala o modo musical (ej. 'Menor natural', 'Mayor', 'Menor armónica', 'Dórico').
4. timeSignature: compás musical (ej. '4/4', '3/4', '6/8').
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
              timeSignature: { type: Type.STRING, description: 'Compás métrico ej. 4/4, 3/4, 6/8' },
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
        analysis: parsed
      });
    } catch (err: any) {
      console.error('Audio analysis API error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Error procesando el análisis de audio con el modelo IA.'
      });
    }
  });

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // Direct endpoint to serve fresh catalog.json with no-cache headers
  app.get(['/catalog.json', '/cancionero/catalog.json'], (req, res) => {
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
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
