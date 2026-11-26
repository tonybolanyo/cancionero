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

import {
  resolveServerAuthConfig,
  resolveSessionSecretKey,
  sealSessionPayload,
  unsealSessionPayload,
  parseCookies,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  verifyCsrfRequest,
  validateSafeRepoTarget,
  validateSafeGitHubRepoPath,
  SESSION_COOKIE_NAME,
  SESSION_DEFAULT_TTL_MS,
  SESSION_REMEMBER_TTL_MS,
  type ServerAuthConfig
} from './src/lib/server/authSession';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProdEnv = process.env.NODE_ENV === 'production';
const serverAuthConfig: ServerAuthConfig = resolveServerAuthConfig(process.env, isProdEnv);
const sessionSecretKey = resolveSessionSecretKey(process.env);

if (isProdEnv && (!serverAuthConfig.isGithubConfigured || !serverAuthConfig.isEmailConfigured)) {
  console.error(
    '[auth] CRÍTICO: AUTHORIZED_GITHUB_USER y/o AUTHORIZED_AUTHOR_EMAIL no están configurados en .env en producción. Las rutas protegidas rechazarán el acceso (fail-closed).'
  );
} else if (!isProdEnv && serverAuthConfig.usedDevFallback) {
  console.warn(
    '[auth] AUTHORIZED_GITHUB_USER / AUTHORIZED_AUTHOR_EMAIL no definidos en .env; usando valores de desarrollo. En producción es obligatorio definirlos en .env.'
  );
}

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

function getSealedSessionFromRequest(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE_NAME];
  return unsealSessionPayload(raw, sessionSecretKey);
}

async function verifyGitHubTokenIdentity(
  token: string,
  expectedLogin: string
): Promise<{ authorized: boolean; login?: string; user?: any; reason?: string }> {
  if (!expectedLogin) {
    return {
      authorized: false,
      reason: 'AUTHORIZED_GITHUB_USER no está configurado en el servidor.'
    };
  }

  const cached = tokenVerificationCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      authorized: cached.authorized,
      login: cached.userIdentifier,
      reason: cached.authorized ? undefined : 'Token no autorizado.'
    };
  }

  try {
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'tony-cancionero-server'
      }
    });

    if (!ghRes.ok) {
      return { authorized: false, reason: `GitHub rechazó el token (HTTP ${ghRes.status}).` };
    }

    const ghUser = await ghRes.json();
    const login = String(ghUser.login || '').trim().toLowerCase();
    const isAllowed = Boolean(login) && login === expectedLogin;

    tokenVerificationCache.set(token, {
      authorized: isAllowed,
      userIdentifier: login,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    if (isAllowed) {
      return { authorized: true, login, user: ghUser };
    }
    return {
      authorized: false,
      login,
      reason: `Usuario @${login} no coincide con el autor autorizado (@${expectedLogin}).`
    };
  } catch {
    return { authorized: false, reason: 'Error de red validando credenciales con GitHub.' };
  }
}

/**
 * Verifies if the request carries a valid HttpOnly session cookie or Bearer token
 * belonging to the authorized author. Enforces CSRF checks on cookie-authenticated mutations.
 */
async function verifyAuthorRequest(
  req: Request
): Promise<{ authorized: boolean; githubToken?: string; authSource?: 'cookie' | 'bearer'; reason?: string }> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (!token) {
      return { authorized: false, reason: 'Token de autorización ausente.' };
    }

    // 1. Check cache
    const cached = tokenVerificationCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        authorized: cached.authorized,
        githubToken: cached.authorized ? token : undefined,
        authSource: 'bearer',
        reason: cached.authorized ? undefined : 'Token no autorizado.'
      };
    }

    // 2. Try GitHub REST API (PAT)
    if (serverAuthConfig.authorizedGithubUser) {
      const ghCheck = await verifyGitHubTokenIdentity(token, serverAuthConfig.authorizedGithubUser);
      if (ghCheck.authorized) {
        return { authorized: true, githubToken: token, authSource: 'bearer' };
      }
      if (ghCheck.login) {
        return { authorized: false, reason: ghCheck.reason };
      }
    }

    // 3. Try Google OAuth tokeninfo
    if (serverAuthConfig.authorizedAuthorEmail) {
      try {
        const googleRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
        );
        if (googleRes.ok) {
          const googleData = await googleRes.json();
          const email = String(googleData.email || '').trim().toLowerCase();
          const emailVerified = googleData.email_verified !== false && googleData.email_verified !== 'false';
          const isAllowed = emailVerified && Boolean(email) && email === serverAuthConfig.authorizedAuthorEmail;

          tokenVerificationCache.set(token, {
            authorized: isAllowed,
            userIdentifier: email,
            expiresAt: Date.now() + 5 * 60 * 1000
          });

          if (isAllowed) {
            return { authorized: true, authSource: 'bearer' };
          }
          return {
            authorized: false,
            reason: `Cuenta Google (${email}) no coincide con el correo propietario (${serverAuthConfig.authorizedAuthorEmail}).`
          };
        }
      } catch {
        // Google check failed
      }
    }

    tokenVerificationCache.set(token, {
      authorized: false,
      userIdentifier: 'invalid',
      expiresAt: Date.now() + 60 * 1000
    });

    return { authorized: false, reason: 'Token de autorización inválido o no reconocido.' };
  }

  // Fallback to encrypted HttpOnly session cookie
  const sealedSession = getSealedSessionFromRequest(req);
  if (!sealedSession) {
    return { authorized: false, reason: 'Sesión de autor o cabecera Authorization Bearer requerida.' };
  }

  // Enforce CSRF protection on cookie-authenticated mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const csrf = verifyCsrfRequest(req);
    if (!csrf.ok) {
      return { authorized: false, reason: csrf.reason };
    }
  }

  if (
    !serverAuthConfig.authorizedGithubUser ||
    sealedSession.login.trim().toLowerCase() !== serverAuthConfig.authorizedGithubUser
  ) {
    return { authorized: false, reason: 'Sesión de cookie no coincide con el autor autorizado.' };
  }

  const ghCheck = await verifyGitHubTokenIdentity(
    sealedSession.token,
    serverAuthConfig.authorizedGithubUser
  );
  if (!ghCheck.authorized) {
    return { authorized: false, reason: ghCheck.reason || 'Sesión de GitHub expirada o revocada.' };
  }

  return {
    authorized: true,
    githubToken: sealedSession.token,
    authSource: 'cookie'
  };
}

/**
 * Middleware: Strictly enforce author authorization on sensitive endpoints
 */
async function requireAuthorAuth(req: Request, res: Response, next: NextFunction) {
  const check = await verifyAuthorRequest(req);
  if (!check.authorized) {
    const configuredHint = serverAuthConfig.authorizedGithubUser || 'no-configurado';
    return res.status(403).json({
      success: false,
      error: `Acceso denegado: Operación reservada exclusivamente para el autor propietario (@${configuredHint}). ${check.reason || ''}`
    });
  }
  (req as any).verifiedAuthorGithubToken = check.githubToken;
  (req as any).verifiedAuthSource = check.authSource;
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
  app.set('trust proxy', 1);
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
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  const rawBase = process.env.VITE_BASE_URL || process.env.BASE_PATH || '/cancionero/';
  const normalizedBase = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const basePath = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
  const baseMount = basePath === '/' ? '/' : basePath.slice(0, -1);

  const apiRouter = express.Router();
  apiRouter.use(apiRateLimiter);

  // Auth Session Check (HttpOnly cookie)
  apiRouter.get('/auth/session', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const sealed = getSealedSessionFromRequest(req);
    if (!sealed) {
      return res.json({
        authMode: 'server_cookie',
        authenticated: false,
        isAuthor: false,
        user: null,
        storageMode: 'http_only_cookie',
        authorizedUsername: serverAuthConfig.authorizedGithubUser
      });
    }

    if (
      !serverAuthConfig.authorizedGithubUser ||
      sealed.login.trim().toLowerCase() !== serverAuthConfig.authorizedGithubUser
    ) {
      res.setHeader('Set-Cookie', buildClearSessionCookieHeader(req));
      return res.json({
        authMode: 'server_cookie',
        authenticated: false,
        isAuthor: false,
        user: null,
        storageMode: 'http_only_cookie',
        authorizedUsername: serverAuthConfig.authorizedGithubUser
      });
    }

    const ghCheck = await verifyGitHubTokenIdentity(
      sealed.token,
      serverAuthConfig.authorizedGithubUser
    );
    if (!ghCheck.authorized) {
      res.setHeader('Set-Cookie', buildClearSessionCookieHeader(req));
      return res.json({
        authMode: 'server_cookie',
        authenticated: false,
        isAuthor: false,
        user: null,
        storageMode: 'http_only_cookie',
        authorizedUsername: serverAuthConfig.authorizedGithubUser
      });
    }

    return res.json({
      authMode: 'server_cookie',
      authenticated: true,
      isAuthor: true,
      user: sealed.user,
      rememberMe: sealed.rememberMe,
      storageMode: 'http_only_cookie',
      authorizedUsername: serverAuthConfig.authorizedGithubUser
    });
  });

  // Auth Login: Validates GitHub PAT server-side and stores it ONLY in an encrypted HttpOnly cookie
  apiRouter.post('/auth/github', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const csrf = verifyCsrfRequest(req);
    if (!csrf.ok) {
      return res.status(403).json({ success: false, error: csrf.reason });
    }

    if (!serverAuthConfig.isGithubConfigured || !serverAuthConfig.authorizedGithubUser) {
      return res.status(503).json({
        success: false,
        error: 'AUTHORIZED_GITHUB_USER no está configurado en las variables de entorno del servidor (.env).'
      });
    }

    const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const rememberMe = Boolean(req.body?.rememberMe);

    if (!rawToken) {
      return res.status(400).json({
        success: false,
        error: 'Por favor introduce tu Personal Access Token (PAT) de GitHub.'
      });
    }

    try {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${rawToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'tony-cancionero-server'
        }
      });

      if (!ghRes.ok) {
        if (ghRes.status === 401) {
          return res.status(401).json({
            success: false,
            error: 'Token de GitHub no válido o expirado (HTTP 401 Unauthorized).'
          });
        }
        if (ghRes.status === 403) {
          return res.status(403).json({
            success: false,
            error: 'Límite de solicitudes de la API de GitHub superado o acceso denegado (HTTP 403).'
          });
        }
        return res.status(ghRes.status).json({
          success: false,
          error: `Error al conectar con la API de GitHub (código HTTP ${ghRes.status}).`
        });
      }

      const userData = await ghRes.json();
      const login = String(userData.login || '').trim().toLowerCase();

      if (!login || login !== serverAuthConfig.authorizedGithubUser) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: Te has identificado en GitHub como @${login || 'desconocido'}, pero solamente el usuario @${serverAuthConfig.authorizedGithubUser} tiene permisos de autor en este cancionero.`
        });
      }

      const githubUser = {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url,
        bio: userData.bio,
        email: userData.email
      };

      const ttlMs = rememberMe ? SESSION_REMEMBER_TTL_MS : SESSION_DEFAULT_TTL_MS;
      const now = Date.now();
      const sealed = sealSessionPayload(
        {
          token: rawToken,
          login: userData.login,
          user: githubUser,
          rememberMe,
          iat: now,
          exp: now + ttlMs
        },
        sessionSecretKey
      );

      tokenVerificationCache.set(rawToken, {
        authorized: true,
        userIdentifier: login,
        expiresAt: now + 5 * 60 * 1000
      });

      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(sealed, {
          rememberMe,
          maxAgeSeconds: rememberMe ? Math.floor(ttlMs / 1000) : undefined,
          req
        })
      );

      return res.json({
        success: true,
        authMode: 'server_cookie',
        storageMode: 'http_only_cookie',
        user: githubUser
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Error de red al conectar con api.github.com: ${err?.message || 'Comprueba tu conexión.'}`
      });
    }
  });

  // Auth Logout: Clears HttpOnly cookie and verification cache
  apiRouter.post('/auth/logout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const csrf = verifyCsrfRequest(req);
    if (!csrf.ok) {
      return res.status(403).json({ success: false, error: csrf.reason });
    }
    const sealed = getSealedSessionFromRequest(req);
    if (sealed?.token) {
      tokenVerificationCache.delete(sealed.token);
    }
    res.setHeader('Set-Cookie', buildClearSessionCookieHeader(req));
    return res.json({ success: true });
  });

  // Authenticated GitHub Proxy: Atomic multi-file push using HttpOnly session PAT
  apiRouter.post('/github/push', requireAuthorAuth, async (req, res) => {
    const githubToken = (req as any).verifiedAuthorGithubToken as string | undefined;
    if (!githubToken) {
      return res.status(403).json({
        success: false,
        message: 'Se requiere sesión de GitHub válida para hacer push al repositorio.'
      });
    }

    const { owner, repo, branch, commitMessage, files } = req.body || {};
    const targetCheck = validateSafeRepoTarget(
      owner,
      repo,
      branch,
      serverAuthConfig.authorizedGithubUser
    );
    if (!targetCheck.valid) {
      return res.status(400).json({ success: false, message: targetCheck.error });
    }

    const cleanMessage = typeof commitMessage === 'string' ? commitMessage.trim().slice(0, 500) : '';
    if (!cleanMessage) {
      return res.status(400).json({ success: false, message: 'Mensaje de commit requerido.' });
    }

    if (!Array.isArray(files) || files.length === 0 || files.length > 500) {
      return res.status(400).json({ success: false, message: 'Lista de archivos inválida para commit atómico.' });
    }

    const dedupMap = new Map<string, { path: string; content?: string; delete?: boolean }>();
    for (const item of files) {
      if (!item || !validateSafeGitHubRepoPath(item.path)) {
        return res.status(400).json({
          success: false,
          message: `Ruta de archivo no permitida en repositorio: ${String(item?.path || '')}`
        });
      }
      dedupMap.set(item.path.trim(), {
        path: item.path.trim(),
        content: typeof item.content === 'string' ? item.content : '',
        delete: Boolean(item.delete)
      });
    }

    const targetRepo = `${targetCheck.owner}/${targetCheck.repo}`;
    const apiBase = `https://api.github.com/repos/${targetCheck.owner}/${targetCheck.repo}`;
    const encodedBranch = encodeURIComponent(targetCheck.branch);
    const ghHeaders: Record<string, string> = {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'tony-cancionero-server'
    };

    try {
      const refRes = await fetch(`${apiBase}/git/ref/heads/${encodedBranch}`, {
        method: 'GET',
        headers: ghHeaders,
        cache: 'no-cache'
      });
      if (!refRes.ok) {
        const errData = await refRes.json().catch(() => ({}));
        return res.status(refRes.status).json({
          success: false,
          requiresPermissions: refRes.status === 401 || refRes.status === 403 || refRes.status === 404,
          targetRepo,
          message: errData.message || `Error GitHub ref (${refRes.status})`
        });
      }
      const refData = await refRes.json();
      const baseCommitSha: string | undefined = refData?.object?.sha;
      if (!baseCommitSha) {
        return res.status(502).json({ success: false, targetRepo, message: 'No se pudo obtener SHA de la rama.' });
      }

      const baseCommitRes = await fetch(`${apiBase}/git/commits/${baseCommitSha}`, {
        method: 'GET',
        headers: ghHeaders,
        cache: 'no-cache'
      });
      if (!baseCommitRes.ok) {
        const errData = await baseCommitRes.json().catch(() => ({}));
        return res.status(baseCommitRes.status).json({
          success: false,
          targetRepo,
          message: errData.message || `Error obteniendo commit base (${baseCommitRes.status})`
        });
      }
      const baseCommitData = await baseCommitRes.json();
      const baseTreeSha: string | undefined = baseCommitData?.tree?.sha;
      if (!baseTreeSha) {
        return res.status(502).json({ success: false, targetRepo, message: 'No se pudo obtener árbol base.' });
      }

      const filesToCommit = Array.from(dedupMap.values());
      const filesToCreate = filesToCommit.filter(f => !f.delete);
      const filesToDelete = filesToCommit.filter(f => f.delete);
      const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];
      let catalogBlobSha: string | null = null;

      const BATCH_SIZE = 6;
      for (let i = 0; i < filesToCreate.length; i += BATCH_SIZE) {
        const batch = filesToCreate.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async file => {
            const blobRes = await fetch(`${apiBase}/git/blobs`, {
              method: 'POST',
              headers: ghHeaders,
              body: JSON.stringify({
                content: Buffer.from(file.content ?? '', 'utf8').toString('base64'),
                encoding: 'base64'
              })
            });
            if (!blobRes.ok) {
              const errData = await blobRes.json().catch(() => ({}));
              throw Object.assign(new Error(errData.message || 'Error creando blob'), { status: blobRes.status });
            }
            const blobData = await blobRes.json();
            if (file.path === 'catalog.json') {
              catalogBlobSha = blobData.sha;
            }
            return {
              path: file.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blobData.sha as string
            };
          })
        );
        treeEntries.push(...batchResults);
      }

      for (const delFile of filesToDelete) {
        treeEntries.push({
          path: delFile.path,
          mode: '100644',
          type: 'blob',
          sha: null
        });
      }

      const treeRes = await fetch(`${apiBase}/git/trees`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
      });
      if (!treeRes.ok) {
        const errData = await treeRes.json().catch(() => ({}));
        return res.status(treeRes.status).json({
          success: false,
          targetRepo,
          message: errData.message || `Error creando árbol Git (${treeRes.status})`
        });
      }
      const treeData = await treeRes.json();

      const commitRes = await fetch(`${apiBase}/git/commits`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          message: cleanMessage,
          tree: treeData.sha,
          parents: [baseCommitSha]
        })
      });
      if (!commitRes.ok) {
        const errData = await commitRes.json().catch(() => ({}));
        return res.status(commitRes.status).json({
          success: false,
          targetRepo,
          message: errData.message || `Error creando commit (${commitRes.status})`
        });
      }
      const newCommitData = await commitRes.json();

      const patchRefRes = await fetch(`${apiBase}/git/refs/heads/${encodedBranch}`, {
        method: 'PATCH',
        headers: ghHeaders,
        body: JSON.stringify({ sha: newCommitData.sha, force: false })
      });
      if (!patchRefRes.ok) {
        const errData = await patchRefRes.json().catch(() => ({}));
        return res.status(patchRefRes.status).json({
          success: false,
          isConflict: patchRefRes.status === 409 || patchRefRes.status === 422,
          targetRepo,
          message: errData.message || `Error actualizando rama (${patchRefRes.status})`
        });
      }

      const newCommitSha = String(newCommitData.sha);
      const shortSha = newCommitSha.substring(0, 7);
      const committedPaths = filesToCommit.map(f => f.path);

      return res.json({
        success: true,
        commitSha: shortSha,
        fullCommitSha: newCommitSha,
        catalogBlobSha,
        commitUrl: newCommitData.html_url || `https://github.com/${targetRepo}/commit/${newCommitSha}`,
        targetRepo,
        filesCommitted: committedPaths,
        message: `Commit atómico completado en GitHub: [${shortSha}] (${committedPaths.length} archivos sincronizados en ${targetRepo}@${targetCheck.branch})`
      });
    } catch (err: any) {
      return res.status(err?.status || 502).json({
        success: false,
        targetRepo,
        message: err?.message || 'Error al ejecutar push atómico vía servidor.'
      });
    }
  });

  // Authenticated GitHub Proxy: Fetch catalog.json using HttpOnly session PAT
  apiRouter.get('/github/catalog', requireAuthorAuth, async (req, res) => {
    const githubToken = (req as any).verifiedAuthorGithubToken as string | undefined;
    if (!githubToken) {
      return res.status(403).json({ success: false, error: 'Sesión de GitHub requerida.' });
    }

    const targetCheck = validateSafeRepoTarget(
      req.query.owner,
      req.query.repo,
      req.query.branch,
      serverAuthConfig.authorizedGithubUser
    );
    if (!targetCheck.valid) {
      return res.status(400).json({ success: false, error: targetCheck.error });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'tony-cancionero-server'
    };
    const ifNoneMatch = typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : '';
    if (ifNoneMatch) {
      headers['If-None-Match'] = ifNoneMatch;
    }

    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${targetCheck.owner}/${targetCheck.repo}/contents/catalog.json?ref=${encodeURIComponent(targetCheck.branch)}&_t=${Date.now()}`,
        { headers, cache: 'no-cache' }
      );
      if (ghRes.status === 304) {
        return res.json({
          success: true,
          notModified: true,
          etag: ghRes.headers.get('etag') || ifNoneMatch
        });
      }
      if (!ghRes.ok) {
        return res.status(ghRes.status).json({ success: false, error: `GitHub HTTP ${ghRes.status}` });
      }
      const data = await ghRes.json();
      const contentStr = data?.content ? Buffer.from(String(data.content), 'base64').toString('utf8') : '[]';
      const songs = JSON.parse(contentStr);
      return res.json({
        success: true,
        notModified: false,
        etag: ghRes.headers.get('etag'),
        sha: data?.sha || null,
        songs: Array.isArray(songs) ? songs : []
      });
    } catch (err: any) {
      return res.status(502).json({ success: false, error: err?.message || 'Error leyendo catálogo remoto.' });
    }
  });

  // Authenticated GitHub Proxy: Delete file using HttpOnly session PAT
  apiRouter.post('/github/delete-file', requireAuthorAuth, async (req, res) => {
    const githubToken = (req as any).verifiedAuthorGithubToken as string | undefined;
    if (!githubToken) {
      return res.status(403).json({ success: false, error: 'Sesión de GitHub requerida.' });
    }

    const { owner, repo, branch, path: filePath, message } = req.body || {};
    const targetCheck = validateSafeRepoTarget(
      owner,
      repo,
      branch,
      serverAuthConfig.authorizedGithubUser
    );
    if (!targetCheck.valid) {
      return res.status(400).json({ success: false, error: targetCheck.error });
    }

    if (!validateSafeGitHubRepoPath(filePath) || !String(filePath).startsWith('songs/')) {
      return res.status(400).json({ success: false, error: 'Solo se permite eliminar archivos en songs/*.md.' });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'tony-cancionero-server'
    };

    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${targetCheck.owner}/${targetCheck.repo}/contents/${filePath}?ref=${encodeURIComponent(targetCheck.branch)}`,
        { headers }
      );
      if (!getRes.ok) {
        return res.json({ success: false });
      }
      const getData = await getRes.json();
      if (!getData?.sha) {
        return res.json({ success: false });
      }

      const delRes = await fetch(
        `https://api.github.com/repos/${targetCheck.owner}/${targetCheck.repo}/contents/${filePath}`,
        {
          method: 'DELETE',
          headers,
          body: JSON.stringify({
            message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 300) : `delete: ${filePath}`,
            sha: getData.sha,
            branch: targetCheck.branch
          })
        }
      );
      return res.json({ success: delRes.ok });
    } catch {
      return res.json({ success: false });
    }
  });

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
      audioModel: resolveGeminiAudioModel(),
      authMode: 'server_cookie',
      hasServerAuthorConfig:
        serverAuthConfig.isGithubConfigured && serverAuthConfig.isEmailConfigured
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
