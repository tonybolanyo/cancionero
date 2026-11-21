# Gestión de Sitemaps para SEO

## Overview

Este proyecto mantiene un sistema de sitemaps robusto para maximizar la indexación en Google Search Console. Los sitemaps se generan automáticamente en cada despliegue con contenido actualizado y validación de URLs.

## Estructura de Sitemaps

Contamos con un sistema de **sitemap index** que referencía múltiples sitemaps especializados:

```
tonygb.com
├── /robots.txt (incluye referencias a todos los sitemaps)
├── /sitemap-index.xml (índice maestro - referencía todos los sitemaps)
├── /sitemap.xml (páginas principales de tonygb.com)
└── /cancionero/
    ├── /sitemap.xml (canciones y páginas del cancionero)
    └── /sitemap-index.xml (copia del índice maestro)
```

## Problemas Corregidos

### 1. ✅ URLs Inválidas / 404s
- **Problema**: Caracteres especiales en URLs causaban 404s
- **Solución**: Implementado `encodeURIComponent()` y validación URL con `new URL()`
- **Script**: `scripts/generate-sitemap.mjs`

```javascript
// Antes: `https://domain/song/Mi Canción` (espacios sin codificar)
// Después: `https://domain/song/Mi%20Canci%C3%B3n` (correctamente codificado)
```

### 2. ✅ Duplicados sin Canonical
- **Problema**: Múltiples rutas a la misma página sin etiquetas canónicas
- **Solución**: Sitemap index garantiza URL única y validación de duplicados
- **Script**: `scripts/generate-sitemap-index.mjs`

### 3. ✅ Páginas Sin Indexar
- **Problema**: 34+ páginas descubiertas pero no indexadas
- **Causas principales**:
  - URLs malformadas en el sitemap
  - Falta de references (sitemaps en robots.txt)
  - Prioridades incorrectas
- **Solución**: 
  - Robots.txt mejorado con múltiples referencias de sitemap
  - Prioridades recalculadas: 1.0 (homepage), 0.95 (cancionero), 0.8+ (canciones)

### 4. ✅ Redirects
- **Problema**: URLs con redirects causaban errores
- **Solución**: 
  - Validación de URLs antes de incluirlas
  - Uso de URLs canónicas en el sitemap index

## Scripts de Generación

### `generate-sitemap.mjs`
Genera `/cancionero/sitemap.xml` con todas las canciones publicadas.

**Características**:
- Lee archivos `.md` en `/songs`
- Filtra solo canciones con `status: 'published'`
- Sanitiza IDs y URLs
- Valida cada URL antes de incluirla
- Registra URLs inválidas/omitidas

**Variables de entorno**:
```bash
DOMAIN=tonygb.com          # Dominio principal (obligatorio)
DEBUG=true                 # Mostrar lista detallada de canciones (opcional)
```

**Ejecución**:
```bash
npm run generate-sitemap
```

### `generate-sitemap-index.mjs`
Genera `/sitemap-index.xml` que referencía todos los sitemaps.

**Características**:
- Referencía sitemap.xml (páginas principales)
- Referencía cancionero/sitemap.xml (canciones)
- Garantiza actualización de lastmod en cada build
- Copia también a `/cancionero/sitemap-index.xml` para acceso alternativo

**Ejecución**:
```bash
npm run generate-sitemap-index
```

### `generate-seo-files.js`
Genera `robots.txt` y archivos SEO complementarios.

**Características**:
- Robots.txt mejorado con múltiples referencias de sitemap
- Incluye directives para crawlers sociales
- Inyecta Google Analytics en index.html
- Genera `.seo-config.json` para verificación interna

**Variables de entorno**:
```bash
DOMAIN=tonygb.com                    # Dominio principal
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX    # ID de GA4 (opcional)
```

**Ejecución**:
```bash
npm run generate-robots
```

## Flujo de Despliegue

En cada push a `main/master`, GitHub Actions ejecuta:

```bash
npm run build
# Que internamente ejecuta:
# 1. npm run generate-version
# 2. npm run generate-catalog
# 3. vite build
# 4. npm run generate-robots       # SEO files
# 5. npm run generate-sitemap      # Canciones sitemap
# 6. npm run generate-sitemap-index # Sitemap index
```

Luego verifica que los archivos SEO se hayan generado correctamente:

```bash
ls -lh dist/sitemap*.xml dist/robots.txt
```

## Mantenimiento y Verificación

### Local (Desarrollo)

```bash
# Generar sitemaps localmente
npm run build

# Verificar contenido
cat dist/robots.txt
cat dist/sitemap.xml
cat dist/sitemap-index.xml
cat dist/cancionero/sitemap.xml

# Ver configuración interna
cat dist/.seo-config.json
```

### En Google Search Console

1. **Enviar sitemap index**:
   - URL: `https://tonygb.com/sitemap-index.xml`
   - Google automáticamente descubrirá los sitemaps referenciados

2. **Monitorear indexación**:
   - Google Search Console → Sitemaps
   - Verificar "Páginas enviadas" vs "Páginas indexadas"
   - Si hay discrepancias, revisar "Problemas críticos"

3. **Problemas comunes**:
   - **"No se ha encontrado (404)"**: URL en sitemap que no existe
     - Solución: Revisar archivos `.md` que definen la URL
   - **"Página con redirección"**: URL redirige a otra
     - Solución: Usar URL destino en el sitemap
   - **"Sin indexar"**: URL válida pero Google no la indexó
     - Solución: Mejorar contenido, añadir internal links, revisar canonical tags

## Best Practices

### 1. URLs Válidas
✅ Usar caracteres ASCII cuando sea posible
✅ Codificar caracteres especiales con encodeURIComponent()
✅ Validar con `new URL(url)` antes de incluir

```javascript
// ❌ Incorrecto
const url = `https://domain/song/${title}`;

// ✅ Correcto
const url = `https://domain/song/${encodeURIComponent(title.toLowerCase())}`;
```

### 2. Prioridades
- **1.0**: Homepage
- **0.95**: Páginas principales (Cancionero)
- **0.8**: Canciones individuales
- **0.5**: Contenido secundario

### 3. Change Frequency
- **daily**: Homepage, Cancionero (contenido frecuente)
- **weekly**: Canciones (actualizaciones ocasionales)
- **monthly**: Contenido estático

### 4. Lastmod
Actualizar siempre en cada build para indicar que el contenido es fresco:

```javascript
const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
```

## Validación de Sitemaps

### Schema XML
Los sitemaps deben seguir este schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tonygb.com/page</loc>
    <lastmod>2026-11-21</lastmod>
    <priority>0.9</priority>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
```

### Schema Sitemap Index
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://tonygb.com/sitemap.xml</loc>
    <lastmod>2026-11-21</lastmod>
  </sitemap>
</sitemapindex>
```

### Validación Online
- Google Search Console → Sitemaps → Detalles
- XML Sitemap Validator: https://www.xml-sitemaps.com/validate-xml-sitemap.html

## Troubleshooting

### "Descubierta: actualmente sin indexar"
Este es el estado más común. Causas principales:

1. **Contenido poco único o duplicado**
   - Solución: Mejorar contenido con valor único

2. **Falta de internal links**
   - Solución: Añadir links internos relevantes

3. **URL muy nueva**
   - Solución: Esperar 1-2 semanas para indexación

4. **Canonical a otra URL**
   - Solución: Si es intencional, es normal; si no, revisar

### "Rastreada: actualmente sin indexar"
Google rastreó pero no indexó. Causas:

1. **Noindex meta tag**
   - Solución: Revisar `<meta name="robots" content="noindex">`

2. **Contenido bloqueado por robots.txt**
   - Solución: Revisar `Disallow` en robots.txt

3. **Canonicalizada a otra URL**
   - Solución: Revisar canonical tag

### URLs 404 en Search Console
1. Revisar que el archivo `.md` existe y está publicado
2. Verificar que la URL en sitemap coincide con la ruta en la aplicación
3. Validar encoding de caracteres especiales

## Recursos

- [Documentación Google Search Console - Sitemaps](https://support.google.com/webmasters/answer/183668)
- [XML Sitemap Protocol](https://www.sitemaps.org/protocol.html)
- [Robots.txt Specification](https://en.wikipedia.org/wiki/Robots.txt)

## Cambios Recientes

### v0.17.0 (Nov 21, 2026)

**Problemas Corregidos**:
- ✅ Sanitización de URLs con caracteres especiales
- ✅ Validación de URLs antes de incluir en sitemap
- ✅ Sitemap index que combina múltiples sitemaps
- ✅ Robots.txt mejorado con referencias explícitas
- ✅ Deduplicación de URLs
- ✅ Ajuste de prioridades según tipo de página

**Scripts Nuevos**:
- `generate-sitemap-index.mjs`: Genera sitemap index maestro
- Mejorado: `generate-sitemap.mjs` con validación URL
- Mejorado: `generate-seo-files.js` con robots.txt robusto

**Workflow**:
- GitHub Actions verifica generación de archivos SEO
- Logs detallados en cada despliegue

## Contacto / Soporte

Para problemas o mejoras, contactar al equipo de desarrollo o revisar issues en GitHub.
