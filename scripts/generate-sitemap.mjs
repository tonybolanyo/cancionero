#!/usr/bin/env node
/**
 * Script para generar sitemap.xml de canciones
 * Lee los archivos markdown en /songs y genera URLs para cada canción
 * Se ejecuta durante el build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const songsDir = path.join(__dirname, '../songs');
const distDir = path.join(__dirname, '../dist');
const domain = process.env.DOMAIN || 'tonygb.com';
const basePath = '/cancionero';

console.log(`🎵 Generando sitemap de canciones...`);
console.log(`   Dominio: ${domain}`);
console.log(`   Base path: ${basePath}`);

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

/**
 * Valida y sanitiza URLs para evitar caracteres inválidos
 */
function sanitizeUrl(url) {
  try {
    new URL(url);
    return url;
  } catch {
    console.warn(`⚠️  URL inválida ignorada: ${url}`);
    return null;
  }
}

/**
 * Extrae metadata del frontmatter markdown
 */
function extractMetadata(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const metadata = {};

  // Parsear YAML simplificado
  const lines = frontmatter.split('\n');
  lines.forEach(line => {
    if (!line.trim()) return;
    const [key, ...valueParts] = line.split(':');
    let value = valueParts.join(':').trim();

    // Remover comillas
    value = value.replace(/^["']|["']$/g, '');

    metadata[key.trim()] = value;
  });

  return metadata;
}

/**
 * Obtiene todas las canciones publicadas
 */
function getSongs() {
  const songs = [];

  if (!fs.existsSync(songsDir)) {
    console.warn(`⚠️  Directorio de canciones no encontrado: ${songsDir}`);
    return songs;
  }

  const files = fs.readdirSync(songsDir);

  files.forEach(file => {
    if (!file.endsWith('.md')) return;

    const filePath = path.join(songsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = extractMetadata(content);

    if (!metadata) return;

    // Solo incluir canciones publicadas
    if (metadata.status !== 'published') return;

    const id = metadata.id || file.replace('.md', '');
    
    // Sanitizar el ID para que sea URL-safe
    const safeId = encodeURIComponent(id.toLowerCase().replace(/\s+/g, '-'));
    
    const lastmod = metadata.updatedAt
      ? new Date(metadata.updatedAt).toISOString().split('T')[0]
      : new Date(fs.statSync(filePath).mtime).toISOString().split('T')[0];

    const url = `https://${domain}${basePath}/song/${safeId}`;
    
    if (!sanitizeUrl(url)) return;

    songs.push({
      id,
      title: metadata.title || id,
      url,
      lastmod,
      priority: 0.8,
      changefreq: 'monthly'
    });
  });

  return songs;
}

/**
 * Genera el sitemap XML con validación
 */
function generateSitemap(songs) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Agregar página principal del cancionero
  const mainUrl = `https://${domain}${basePath}/`;
  if (sanitizeUrl(mainUrl)) {
    xml += `  <url>
    <loc>${mainUrl}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.9</priority>
    <changefreq>weekly</changefreq>
  </url>
`;
  }

  // Agregar cada canción (validado)
  songs.forEach(song => {
    if (sanitizeUrl(song.url)) {
      xml += `  <url>
    <loc>${song.url}</loc>
    <lastmod>${song.lastmod}</lastmod>
    <priority>${song.priority}</priority>
    <changefreq>${song.changefreq}</changefreq>
  </url>
`;
    }
  });

  xml += `</urlset>`;
  return xml;
}

try {
  const songs = getSongs();
  const sitemapXml = generateSitemap(songs);

  // Crear carpeta cancionero si no existe
  const cancioneroDir = path.join(distDir, 'cancionero');
  if (!fs.existsSync(cancioneroDir)) {
    fs.mkdirSync(cancioneroDir, { recursive: true });
  }

  // Escribir sitemap.xml en la carpeta cancionero
  fs.writeFileSync(path.join(cancioneroDir, 'sitemap.xml'), sitemapXml);
  console.log(`✅ sitemap.xml generado en /cancionero/ (${songs.length + 1} URLs válidas)`);

  // Información de debugging (opcional)
  if (process.env.DEBUG) {
    console.log(`\n📋 Canciones incluidas:`);
    songs.slice(0, 5).forEach(song => {
      console.log(`   - ${song.title} (${song.url})`);
    });
    if (songs.length > 5) {
      console.log(`   ... y ${songs.length - 5} más`);
    }
  }
} catch (error) {
  console.error(`❌ Error generando sitemap:`, error.message);
  process.exit(1);
}
