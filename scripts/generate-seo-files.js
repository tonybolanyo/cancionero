#!/usr/bin/env node
/**
 * Script para generar archivos SEO (robots.txt y sitemap.xml)
 * Se ejecuta durante el build en GitHub Actions
 * 
 * Ambiente:
 * - DOMAIN: Dominio del sitio (ej: tonygb.com)
 * - GOOGLE_ANALYTICS_ID: ID de Google Analytics (opcional)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const domain = process.env.DOMAIN || 'tonygb.com';
const gaId = process.env.GOOGLE_ANALYTICS_ID || '';

console.log(`📝 Generando archivos SEO...`);
console.log(`   Dominio: ${domain}`);
console.log(`   Google Analytics: ${gaId ? '✅ Configurado' : '⏭️ No configurado'}`);

// Crear directorio dist si no existe
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// ============================================================================
// 1. Generar robots.txt mejorado
// ============================================================================
const robotsTxt = `# Robots.txt - ${domain}
# Generado automáticamente durante el build

User-agent: *
Allow: /
Disallow: /admin
Disallow: /.git
Disallow: /.github
Disallow: /node_modules
Disallow: /*?*sort=
Disallow: /*?*page=

# Crawl-delay (respetar con 2 segundos)
Crawl-delay: 2

# Sitemaps para facilitar indexación
Sitemap: https://${domain}/sitemap-index.xml
Sitemap: https://${domain}/sitemap.xml
Sitemap: https://${domain}/cancionero/sitemap.xml

# Google Search Console verification
# Agregar meta tag de verificación en index.html

# Social Media Crawlers (permitir acceso completo)
User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: WhatsApp
Allow: /

User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 2
`;

fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt);
console.log('✅ robots.txt generado');

// ============================================================================
// 2. Generar sitemap.xml de páginas principales (homepage)
// ============================================================================

function generateMainSitemap() {
  // URLs principales que siempre deben estar indexadas
  const mainPages = [
    {
      url: `https://${domain}/`,
      priority: 1.0,
      changefreq: 'daily',
      description: 'Homepage'
    },
    {
      url: `https://${domain}/cancionero/`,
      priority: 0.95,
      changefreq: 'daily',
      description: 'Cancionero'
    }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const now = new Date().toISOString().split('T')[0];

  mainPages.forEach(page => {
    // Validar que la URL sea válida
    try {
      new URL(page.url);
      xml += `  <url>
    <loc>${page.url}</loc>
    <lastmod>${now}</lastmod>
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
  </url>
`;
    } catch (e) {
      console.warn(`⚠️  URL inválida ignorada: ${page.url}`);
    }
  });

  xml += `</urlset>`;
  return xml;
}

const mainSitemapXml = generateMainSitemap();
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), mainSitemapXml);
console.log('✅ sitemap.xml (páginas principales) generado');

// ============================================================================
// 3. Inyectar Google Analytics en index.html con validaciones
// ============================================================================

const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // Crear script de Google Analytics si el ID está configurado
  let gaScript = '';
  if (gaId) {
    // Validar que sea un ID válido de GA4 (formato: G-XXXXXXXXXX)
    if (!/^G-[A-Z0-9]{10}$/.test(gaId)) {
      console.warn(`⚠️  Google Analytics ID parece inválido: ${gaId}`);
    }
    gaScript = `
    <!-- Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', {
        'page_path': window.location.pathname,
        'anonymize_ip': true,
        'allow_google_signals': false
      });
    </script>
    <!-- End Google Analytics -->`;
  } else {
    gaScript = `
    <!-- Google Analytics: No configurado (agrega GOOGLE_ANALYTICS_ID en secrets) -->`;
  }

  // Inyectar antes de </head> (evitar duplicados)
  if (htmlContent.includes('</head>')) {
    // Remover gaScript antiguo si existe (evitar duplicados)
    htmlContent = htmlContent.replace(/\s*<!-- Google Analytics.*?End Google Analytics -->/s, '');
    htmlContent = htmlContent.replace('</head>', `${gaScript}\n</head>`);
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
  buildDate: new Date().toISOString(),
  googleAnalyticsId: gaId ? gaId : null,
  sitemaps: [
    `https://${domain}/sitemap-index.xml`,
    `https://${domain}/sitemap.xml`,
    `https://${domain}/cancionero/sitemap.xml`
  ],
  robots: `https://${domain}/robots.txt`
};

fs.writeFileSync(
  path.join(distDir, '.seo-config.json'),
  JSON.stringify(seoConfig, null, 2)
);
console.log('✅ .seo-config.json generado (archivo interno)');

console.log('\n🎉 Archivos SEO generados exitosamente!');

