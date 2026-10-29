#!/usr/bin/env node
/**
 * Script para generar archivos SEO (robots.txt y sitemap.xml)
 * Se ejecuta durante el build en GitHub Actions
 * 
 * Ambiente:
 * - DOMAIN: Dominio del sitio (ej: cancionero.example.com)
 * - GOOGLE_ANALYTICS_ID: ID de Google Analytics (opcional)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const domain = process.env.DOMAIN || 'cancionero.example.com';
const gaId = process.env.GOOGLE_ANALYTICS_ID || '';

console.log(`📝 Generando archivos SEO...`);
console.log(`   Dominio: ${domain}`);
console.log(`   Google Analytics: ${gaId ? '✅ Configurado' : '⏭️ No configurado'}`);

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// ============================================================================
// 1. Generar robots.txt
// ============================================================================
const robotsTxt = `# Robots.txt - ${domain}
# Generado automáticamente por GitHub Actions

User-agent: *
Allow: /
Allow: /sitemap.xml

Disallow: /admin
Disallow: /.git
Disallow: /.github
Disallow: /node_modules

# Velocidad de rastreo
Crawl-delay: 1

# Sitemaps
Sitemap: https://${domain}/sitemap.xml

# Canonical
# Nota: Agregar canonical en cada página HTML individualmente

# Social Media Crawlers
User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: WhatsApp
Allow: /
`;

fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt);
console.log('✅ robots.txt generado');

// ============================================================================
// 2. Generar sitemap.xml
// ============================================================================

// Leer estructura de directorios para generar URLs dinámicas
function getAllPages(dir, baseUrl, relativePath = '') {
  const pages = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const fileName = path.basename(file);

    // Ignorar archivos y carpetas privadas
    if (fileName.startsWith('.') || fileName === 'node_modules') {
      return;
    }

    // Ignorar archivos no relevantes para SEO
    if (['.map', '.css.map', '.js.map'].some(ext => fileName.endsWith(ext))) {
      return;
    }

    const urlPath = relativePath ? `${relativePath}/${fileName}` : fileName;

    if (stat.isDirectory()) {
      // Recursivamente procesar subdirectorios
      pages.push(...getAllPages(filePath, baseUrl, urlPath));
    } else if (['index.html', 'songs', 'schedule', 'programming'].some(keyword => 
      file.includes(keyword) || urlPath.includes(keyword))) {
      // Procesar archivos HTML y directorios relevantes
      let url = `${baseUrl}/${urlPath}`;
      
      // Limpiar URL para archivos index.html
      url = url.replace(/\/index\.html$/, '').replace(/\.html$/, '');
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }

      const mtime = stat.mtime;
      const lastmod = mtime.toISOString().split('T')[0];

      // Prioridad según tipo de página
      let priority = 0.5;
      let changefreq = 'weekly';

      if (urlPath === 'index.html' || urlPath === '') {
        priority = 1.0;
        changefreq = 'daily';
      } else if (urlPath.includes('songs') || urlPath.includes('canciones')) {
        priority = 0.9;
        changefreq = 'daily';
      } else if (urlPath.includes('schedule') || urlPath.includes('programming')) {
        priority = 0.8;
        changefreq = 'weekly';
      }

      pages.push({
        url,
        lastmod,
        priority,
        changefreq
      });
    }
  });

  return pages;
}

// Generar páginas desde dist
let pages = getAllPages(distDir, `https://${domain}`);

// Agregar URLs principales si no existen
const mainUrls = [
  {
    url: `https://${domain}`,
    priority: 1.0,
    changefreq: 'daily'
  },
  {
    url: `https://${domain}/songs`,
    priority: 0.9,
    changefreq: 'daily'
  },
  {
    url: `https://${domain}/schedule`,
    priority: 0.8,
    changefreq: 'weekly'
  }
];

// Merge manteniendo prioridades correctas
pages = [
  ...mainUrls,
  ...pages.filter(p => !mainUrls.some(m => m.url === p.url))
];

// Remover duplicados
pages = Array.from(new Map(pages.map(p => [p.url, p])).values());

// Limitar a 50,000 URLs (límite de sitemap.xml)
pages = pages.slice(0, 50000);

// Generar XML
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

pages.forEach(page => {
  const lastmod = page.lastmod || new Date().toISOString().split('T')[0];
  sitemapXml += `  <url>
    <loc>${page.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${page.priority || 0.5}</priority>
    <changefreq>${page.changefreq || 'monthly'}</changefreq>
  </url>
`;
});

sitemapXml += `</urlset>`;

fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml);
console.log(`✅ sitemap.xml generado (${pages.length} URLs)`);

// ============================================================================
// 3. Inyectar Google Analytics en index.html
// ============================================================================

const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // Crear script de Google Analytics si el ID está configurado
  let gaScript = '';
  if (gaId) {
    gaScript = `
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', {
        'page_path': window.location.pathname,
        'anonymize_ip': true
      });
    </script>
    <!-- End Google Analytics -->
`;
  } else {
    gaScript = `
    <!-- Google Analytics: No configurado (agrega GOOGLE_ANALYTICS_ID en secrets) -->
`;
  }

  // Inyectar antes de </head>
  if (htmlContent.includes('</head>')) {
    htmlContent = htmlContent.replace('</head>', `${gaScript}</head>`);
    fs.writeFileSync(indexPath, htmlContent);
    console.log(`✅ Google Analytics inyectado${gaId ? ` (ID: ${gaId})` : ' (placeholder)'}`);
  } else {
    console.warn('⚠️  No se encontró </head> en index.html');
  }
} else {
  console.warn('⚠️  index.html no encontrado en dist/');
}

// ============================================================================
// 4. Generar archivo de configuración JSON (útil para inspección)
// ============================================================================

const seoConfig = {
  domain,
  googleAnalyticsId: gaId ? gaId : null,
  generatedAt: new Date().toISOString(),
  pages: pages.length,
  urls: pages.slice(0, 10).map(p => p.url) // Primeras 10 URLs como muestra
};

fs.writeFileSync(
  path.join(distDir, '.seo-config.json'),
  JSON.stringify(seoConfig, null, 2)
);
console.log('✅ .seo-config.json generado (archivo interno)');

console.log('\n🎉 Archivos SEO generados exitosamente!');
