#!/usr/bin/env node
/**
 * Script para generar robots.txt
 * Se ejecuta durante el build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const domain = process.env.DOMAIN || 'tonygb.com';
const basePath = '/cancionero';

console.log(`🤖 Generando robots.txt...`);
console.log(`   Dominio: ${domain}`);
console.log(`   Base path: ${basePath}`);

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const robotsTxt = `# robots.txt para ${domain}${basePath}
# Generado automáticamente

User-agent: *
Allow: ${basePath}/

Disallow: /.well-known
Disallow: /.github
Disallow: /node_modules

# Velocidad de rastreo
Crawl-delay: 1

# Sitemaps
Sitemap: https://${domain}${basePath}/sitemap.xml
`;

try {
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt);
  console.log(`✅ robots.txt generado`);
} catch (error) {
  console.error(`❌ Error generando robots.txt:`, error.message);
  process.exit(1);
}
