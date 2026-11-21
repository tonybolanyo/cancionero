#!/usr/bin/env node
/**
 * Script para generar sitemap-index.xml que referencía múltiples sitemaps
 * Combina:
 * - Sitemap de cancionero (tonygb.com/cancionero/sitemap.xml)
 * - Sitemap de homepage (tonygb.com/sitemap.xml)
 * 
 * Se ejecuta durante el build y en GitHub Actions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const domain = process.env.DOMAIN || 'tonygb.com';

console.log(`📑 Generando sitemap index...`);
console.log(`   Dominio: ${domain}`);

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

/**
 * Genera el sitemap index que referencía múltiples sitemaps
 * Mantiene tanto sitemap.xml como sitemap-index.xml para máxima compatibilidad
 */
function generateSitemapIndex() {
  const now = new Date().toISOString().split('T')[0];
  
  // Listar todos los sitemaps a incluir
  const sitemaps = [
    {
      loc: `https://${domain}/sitemap.xml`,
      lastmod: now,
      priority: 1.0,
      description: 'Sitemap de homepage y páginas principales'
    },
    {
      loc: `https://${domain}/cancionero/sitemap.xml`,
      lastmod: now,
      priority: 0.9,
      description: 'Sitemap de canciones del cancionero'
    }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  sitemaps.forEach(sitemap => {
    xml += `  <!-- ${sitemap.description} -->
  <sitemap>
    <loc>${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>
`;
  });

  xml += `</sitemapindex>`;
  return xml;
}

try {
  const sitemapIndexXml = generateSitemapIndex();

  // Escribir sitemap-index.xml en la raíz de dist
  fs.writeFileSync(path.join(distDir, 'sitemap-index.xml'), sitemapIndexXml);
  console.log(`✅ sitemap-index.xml generado`);

  // También copiar en la carpeta cancionero para acceso alternativo
  const cancioneroDir = path.join(distDir, 'cancionero');
  if (!fs.existsSync(cancioneroDir)) {
    fs.mkdirSync(cancioneroDir, { recursive: true });
  }
  fs.writeFileSync(path.join(cancioneroDir, 'sitemap-index.xml'), sitemapIndexXml);
  console.log(`✅ sitemap-index.xml también copiado a /cancionero/`);

  if (process.env.DEBUG) {
    console.log(`\n📋 Sitemaps referenciados:`);
    console.log(`   - https://${domain}/sitemap.xml`);
    console.log(`   - https://${domain}/cancionero/sitemap.xml`);
  }
} catch (error) {
  console.error(`❌ Error generando sitemap index:`, error.message);
  process.exit(1);
}
