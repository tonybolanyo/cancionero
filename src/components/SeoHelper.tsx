import React, { useMemo } from 'react';
import { useMetaTags, generateSongSchema, generateBreadcrumbSchema } from '../hooks/useMetaTags';
import { Song } from '../types/song';
import { SEO_CONFIG, getSiteUrl } from '../utils/seoConfig';

interface SeoHelperProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogUrl?: string;
  song?: Song | null;
  breadcrumbs?: Array<{ name: string; url?: string }>;
}

/**
 * SeoHelper component - Manages SEO meta tags and structured data
 * Use this component at the root level or in route-specific pages
 */
export function SeoHelper({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  song,
  breadcrumbs,
}: SeoHelperProps) {
  // Determine what data to use for meta tags
  const seoConfig = useMemo(() => {
    if (song) {
      const songTitle = `${song.title} - ${SEO_CONFIG.site.name}`;
      const songDescription = song.notes || `Canción en ${song.key} por ${SEO_CONFIG.artist.name}. ${song.genre ? `Género: ${song.genre}. ` : ''}${song.year ? `Año: ${song.year}. ` : ''}`;
      const songUrl = `${getSiteUrl()}?song=${song.id}`;
      
      return {
        title: songTitle,
        description: songDescription,
        keywords: [
          'canción',
          'poesía',
          song.title,
          song.genre || 'acústico',
          song.key,
          ...(song.tags || []),
        ],
        ogTitle: songTitle,
        ogDescription: songDescription,
        ogUrl: songUrl,
        ogType: 'music.song',
        twitterTitle: songTitle,
        twitterDescription: songDescription,
        canonicalUrl: songUrl,
        structuredData: generateSongSchema({
          id: song.id,
          title: song.title,
          description: songDescription,
          year: song.year,
          duration: song.duration,
          genre: song.genre,
          spotifyUrl: song.spotifyUrl,
          youtubeUrl: song.youtubeUrl,
        }),
      };
    }

    if (breadcrumbs && breadcrumbs.length > 0) {
      return {
        title,
        description,
        keywords,
        ogImage,
        ogUrl,
        structuredData: generateBreadcrumbSchema(breadcrumbs),
      };
    }

    return {
      title,
      description,
      keywords,
      ogImage,
      ogUrl,
    };
  }, [song, breadcrumbs, title, description, keywords, ogImage, ogUrl]);

  useMetaTags({
    ...seoConfig,
    ogTitle: seoConfig.ogTitle || seoConfig.title,
    ogDescription: seoConfig.ogDescription || seoConfig.description,
    twitterTitle: seoConfig.twitterTitle || seoConfig.ogTitle || seoConfig.title,
    twitterDescription: seoConfig.twitterDescription || seoConfig.ogDescription || seoConfig.description,
    twitterImage: seoConfig.ogImage,
    canonicalUrl: seoConfig.canonicalUrl,
  });

  // This component doesn't render anything
  return null;
}

export default SeoHelper;
