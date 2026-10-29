/**
 * SEO Configuration
 * 
 * Este archivo contiene la configuración centralizada para SEO
 * que puede ser personalizada según el entorno o sitio
 */

export const SEO_CONFIG = {
  // Información del sitio
  site: {
    name: 'Cancionero de versos perdidos',
    url: import.meta.env.VITE_SITE_URL || 'https://tonygb.com/cancionero',
    description: 'Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía.',
    language: 'es',
    locale: 'es_ES',
  },

  // Información del artista/autor
  artist: {
    name: 'Tony García Bernal',
    twitterHandle: '@tonygb',
    githubUsername: 'tonybolanyo',
    genres: ['Acoustic', 'Singer-Songwriter', 'Folk', 'Cantautor'],
  },

  // Palabras clave por defecto
  keywords: {
    global: [
      'canciones',
      'poesía',
      'acústico',
      'cantautor',
      'letras',
      'compositor',
      'música original',
      'singer-songwriter',
    ],
  },

  // Robots y indexación
  robots: {
    default: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    noIndex: 'noindex, nofollow',
  },

  // Redes sociales
  social: {
    twitter: 'tonygb',
    github: 'tonybolanyo',
  },

  // Imágenes por defecto (si se añaden en futuro)
  images: {
    defaultOgImage: undefined, // Configura si tienes imagen de preview
    defaultTwitterImage: undefined,
  },

  // Configuración de breadcrumbs
  breadcrumbs: {
    home: { name: 'Inicio', url: '/' },
    songs: { name: 'Canciones', url: '/?tab=all' },
  },
};

/**
 * Función para generar palabras clave según contexto
 */
export function getKeywordsFor(context: 'song' | 'search' | 'artist') {
  const baseKeywords = SEO_CONFIG.keywords.global;

  switch (context) {
    case 'song':
      return [...baseKeywords, 'canción', 'letra'];
    case 'search':
      return [...baseKeywords, 'búsqueda'];
    case 'artist':
      return [...baseKeywords, 'artista', 'música'];
    default:
      return baseKeywords;
  }
}

/**
 * Función para generar URL segura
 */
export function getSiteUrl(path: string = '') {
  const base = SEO_CONFIG.site.url;
  return path ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : base;
}

/**
 * Función para generar URL canónica
 */
export function getCanonicalUrl(path: string = '') {
  return getSiteUrl(path);
}

/**
 * Obtener información de redes sociales
 */
export function getSocialLinks() {
  return {
    twitter: `https://twitter.com/${SEO_CONFIG.social.twitter}`,
    github: `https://github.com/${SEO_CONFIG.social.github}`,
  };
}
