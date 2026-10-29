import { useEffect } from 'react';
import { SEO_CONFIG, getSiteUrl, getCanonicalUrl } from '../utils/seoConfig';

export interface MetaTagsConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterCreator?: string;
  canonicalUrl?: string;
  author?: string;
  robots?: string;
  language?: string;
  structuredData?: Record<string, unknown>;
}

export function useMetaTags(config: MetaTagsConfig = {}) {
  useEffect(() => {
    // Set title
    if (config.title) {
      document.title = config.title.includes(SEO_CONFIG.site.name) 
        ? config.title 
        : `${config.title} | ${SEO_CONFIG.site.name}`;
    }

    // Helper function to update or create meta tags
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      let element = document.querySelector(
        isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      ) as HTMLMetaElement | null;

      if (!element) {
        element = document.createElement('meta');
        if (isProperty) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Meta description
    setMetaTag('description', config.description || SEO_CONFIG.site.description);

    // Keywords
    if (config.keywords && config.keywords.length > 0) {
      setMetaTag('keywords', config.keywords.join(', '));
    }

    // Open Graph tags
    setMetaTag('og:title', config.ogTitle || config.title || SEO_CONFIG.site.name, true);
    setMetaTag('og:description', config.ogDescription || config.description || SEO_CONFIG.site.description, true);
    setMetaTag('og:url', config.ogUrl || getSiteUrl(), true);
    setMetaTag('og:type', config.ogType || 'website', true);
    
    if (config.ogImage) {
      setMetaTag('og:image', config.ogImage, true);
      setMetaTag('og:image:alt', config.ogTitle || config.title || SEO_CONFIG.site.name, true);
    }

    // Twitter Card tags
    setMetaTag('twitter:card', config.twitterCard || 'summary_large_image');
    setMetaTag('twitter:title', config.twitterTitle || config.ogTitle || config.title || SEO_CONFIG.site.name);
    setMetaTag('twitter:description', config.twitterDescription || config.ogDescription || config.description || SEO_CONFIG.site.description);
    if (config.twitterImage) {
      setMetaTag('twitter:image', config.twitterImage);
    }
    if (config.twitterCreator) {
      setMetaTag('twitter:creator', config.twitterCreator);
    }

    // Other meta tags
    if (config.author) {
      setMetaTag('author', config.author);
    }
    if (config.robots) {
      setMetaTag('robots', config.robots);
    }
    if (config.language) {
      document.documentElement.lang = config.language;
    }

    // Update or create canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = config.canonicalUrl || getSiteUrl();

    // Structured Data (JSON-LD)
    if (config.structuredData) {
      let structuredDataScript = document.querySelector('script[type="application/ld+json"][data-structured-data]') as HTMLScriptElement | null;
      if (!structuredDataScript) {
        structuredDataScript = document.createElement('script');
        structuredDataScript.type = 'application/ld+json';
        structuredDataScript.setAttribute('data-structured-data', 'true');
        document.head.appendChild(structuredDataScript);
      }
      structuredDataScript.textContent = JSON.stringify(config.structuredData);
    }
  }, [config]);
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: SEO_CONFIG.site.name,
    description: SEO_CONFIG.site.description,
    url: getSiteUrl(),
    sameAs: [
      `https://github.com/${SEO_CONFIG.social.github}`,
      `https://twitter.com/${SEO_CONFIG.social.twitter}`,
    ],
    genre: SEO_CONFIG.artist.genres,
    knowsLanguage: SEO_CONFIG.site.language,
  };
}

export function generateSongSchema(song: {
  id: string;
  title: string;
  description?: string;
  year?: number;
  duration?: string;
  genre?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
}) {
  const songUrl = `${getSiteUrl()}?song=${song.id}`;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    description: song.description || '',
    url: songUrl,
    datePublished: song.year ? `${song.year}-01-01` : undefined,
    duration: song.duration ? `PT${song.duration}` : undefined,
    genre: song.genre || 'Singer-Songwriter',
    byArtist: {
      '@type': 'MusicGroup',
      name: SEO_CONFIG.artist.name,
      url: getSiteUrl(),
    },
    ...(song.spotifyUrl && { sameAs: song.spotifyUrl }),
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_CONFIG.site.name,
    description: SEO_CONFIG.site.description,
    url: getSiteUrl(),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getSiteUrl()}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
