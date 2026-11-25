/**
 * Helpers for resolving application-relative URLs (static assets, data JSON, WASM, API routes)
 * consistently against Vite's configured BASE_URL across browser, Web Workers, and Node tests.
 */

export function getAppBaseUrl(overrideBase?: string): string {
  const envBase =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env !== 'undefined' &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';

  const rawBase = (overrideBase ?? envBase).trim();
  if (!rawBase) {
    return '/';
  }

  const withLeading =
    rawBase.startsWith('/') || /^https?:\/\//i.test(rawBase)
      ? rawBase
      : `/${rawBase}`;

  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function resolveAppUrl(path: string, baseUrl?: string): string {
  const trimmedPath = path.trim();
  const base = getAppBaseUrl(baseUrl);

  if (!trimmedPath) {
    return base;
  }

  // Keep absolute HTTP(S), protocol-relative, data, and blob URLs untouched
  if (/^(https?:)?\/\/|^(data|blob):/i.test(trimmedPath)) {
    return trimmedPath;
  }

  const cleanPath = trimmedPath.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  return `${base}${cleanPath}`;
}
