import metadata from '../../metadata.json';

export interface SiteMetadata {
  name: string;
  subtitle: string;
  description: string;
  url: string;
  author: string;
}

export const siteMetadata: SiteMetadata = {
  name: metadata.name || 'Cancionero de versos perdidos',
  subtitle: (metadata as Record<string, any>).subtitle || 'Canciones de autor, letras íntimas y poesía acústica',
  description: metadata.description || 'Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía.',
  url: 'https://tonygb.com/cancionero',
  author: 'Tony'
};
