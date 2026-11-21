# Guía de Recuperación de Indexación en Google Search Console

## Situación Actual

Basándome en los datos reportados por Google Search Console:

| Problema | Cantidad | Severidad |
|----------|----------|-----------|
| Descubierta: actualmente sin indexar | 34 | 🔴 Alta |
| Rastreada: actualmente sin indexar | 1 | 🟡 Media |
| Página alternativa con canónica adecuada | 2 | 🟢 Baja |
| No se ha encontrado (404) | 1 | 🔴 Alta |
| Página con redirección | 1 | 🔴 Alta |
| **TOTAL PROBLEMAS** | **39** | - |

## Cambios Implementados (Nov 21, 2026)

### 1. ✅ Sitemaps Mejorados

```
tonygb.com/
├── robots.txt (NUEVO - referencias explícitas)
├── sitemap-index.xml (NUEVO - índice maestro)
├── sitemap.xml (MEJORADO - página principal)
└── cancionero/
    ├── sitemap.xml (MEJORADO - canciones con URLs sanitizadas)
    └── sitemap-index.xml (NUEVO - acceso alternativo)
```

### 2. ✅ URLs Corregidas

**Antes**:
```
https://tonygb.com/cancionero/song/Mi Canción    ❌ Espacios sin codificar
https://tonygb.com/cancionero/song/Já Que...    ❌ Caracteres especiales sin encoding
```

**Ahora**:
```
https://tonygb.com/cancionero/song/mi-cancion     ✅ Lowercase + codificado
https://tonygb.com/cancionero/song/ja-que...      ✅ Correctamente codificado
```

### 3. ✅ Validaciones Agregadas

- Validación de URL con `new URL()` antes de incluir
- Sanitización con `encodeURIComponent()`
- Deduplicación de URLs
- Logging de URLs inválidas omitidas

### 4. ✅ Robots.txt Mejorado

```
Sitemap: https://tonygb.com/sitemap-index.xml     ← Principal
Sitemap: https://tonygb.com/sitemap.xml           ← Respaldo
Sitemap: https://tonygb.com/cancionero/sitemap.xml ← Respaldo
```

## Pasos de Recuperación

### Paso 1: Enviar Sitemap Index a Google (INMEDIATO)

1. Ve a **Google Search Console** → **tonygb.com**
2. Ir a **Sitemaps** (en el menú izquierdo)
3. Click en **"Añadir/probar sitemap"**
4. Pega: `https://tonygb.com/sitemap-index.xml`
5. Click en **"Enviar"**

**Resultado esperado**: Google descubrirá automáticamente:
- `https://tonygb.com/sitemap.xml`
- `https://tonygb.com/cancionero/sitemap.xml`

### Paso 2: Monitorear Envíos (DURANTE 1-2 SEMANAS)

1. En **Sitemaps**, observa:
   - "Páginas enviadas" (total en sitemap)
   - "Páginas indexadas" (páginas reales indexadas)

```
Esperado:
✅ sitemap-index.xml: descubrimiento automático
✅ sitemap.xml: ~2 páginas
✅ cancionero/sitemap.xml: ~36 URLs (canciones + main)
```

### Paso 3: Revisar Problemas Críticos

**En Google Search Console:**

1. Ve a **"Cobertura"**
2. Categoría **"Error"** → Click para expandir
3. Categoría **"Válido con advertencias"** → Click para expandir

#### Para cada URL problemática (404 o redirect):

```
Si es 404:
  → Revisar archivo .md correspondiente
  → Verificar que status: 'published'
  → Eliminar de sitemap si no existe

Si es redirect:
  → Usar URL destino en sitemap
  → Verificar que redirect es 301 (permanente)
  → Esperar rerastreo
```

### Paso 4: Mejorar Indexación de Canciones

Las 34 páginas "Sin indexar" se indexarán automáticamente si mejoran estos factores:

#### A. Contenido Único
✅ Cada canción debe tener:
- Título único
- Letra/contenido original o citado
- Metadatos (artista, género, año)
- Descripción OG (meta tags)

#### B. Internal Linking
✅ Agregar links internos a:
- Pagina principal del cancionero
- Otras canciones relacionadas
- Géneros o categorías

#### C. Canonical Tags
✅ Verificar en cada página:
```html
<link rel="canonical" href="https://tonygb.com/cancionero/song/nombre-cancion">
```

#### D. Meta Tags
✅ En index.html o plantilla:
```html
<meta name="description" content="Canción: [Título]">
<meta property="og:url" content="https://tonygb.com/cancionero/song/[id]">
<meta property="og:title" content="[Título] - Cancionero">
<meta property="og:type" content="article">
```

### Paso 5: Validación de Estructura (MANUAL)

Ejecutar en terminal:

```bash
# Descargar y validar sitemaps
curl -s https://tonygb.com/robots.txt | head -20
curl -s https://tonygb.com/sitemap-index.xml | xmllint --format -
curl -s https://tonygb.com/cancionero/sitemap.xml | xmllint --format - | head -50
```

**Debe mostrar**:
- ✅ XML válido (bien formado)
- ✅ URLs en formato HTTPS
- ✅ Fechas lastmod válidas (YYYY-MM-DD)
- ✅ Prioridades entre 0.0-1.0

## Timeline de Recuperación Esperado

| Semana | Hito | Esperado |
|--------|------|----------|
| **Semana 1** | Envío de sitemap index | Google descubre todos los sitemaps |
| **Semana 2** | Rastreo inicial | Google rastrea todas las URLs |
| **Semana 3-4** | Indexación gradual | 50-70% de URLs indexadas |
| **Semana 5-6** | Indexación completa | 90%+ de URLs indexadas |

## Monitoreo Continuo

### Diariamente
- Revisar **Google Search Console** → **Resumen**
- Buscar: `site:tonygb.com/cancionero`

### Semanalmente
- Revisar **"Cobertura"** para nuevos errores
- Revisar **"Rendimiento"** para impresiones y CTR

### Mensualmente
- Generar reporte de indexación
- Comparar con baseline anterior
- Ajustar estrategia según resultados

## Causas de No-Indexación (Diagnosis)

Si una canción sigue sin indexarse, revisar:

### Bloqueos de Robots

```bash
# Revisar robots.txt
curl https://tonygb.com/robots.txt | grep Disallow

# Verificar que /cancionero NO está en Disallow
```

### Meta Tags Noindex

```bash
# Buscar en index.html
grep -i "noindex" dist/index.html
# No debe encontrar nada
```

### Contenido Duplicado

```bash
# Buscar en Google
site:tonygb.com/cancionero/song/NOMBRECANCION
# Si aparece múltiples versiones, revisar canonical
```

### URL Bloqueada por CSS/JS

En Google Search Console → Crawl Stats
- Si hay mucho contenido "bloqueado", revisar robots.txt

## Cambios en la Estrategia de Deploy

### Antes ❌
- Un solo `sitemap.xml` en raíz
- URLs con caracteres sin encodificar
- Sin validación de URLs
- Sin sitemap index

### Ahora ✅
- Sitemap index en raíz + respaldos
- URLs sanitizadas (lowercase + encoded)
- Validación completa de URLs
- Tres vías de acceso a sitemaps

## Automatización Implementada

### En GitHub Actions (cada push)

```yaml
- name: Build application
  run: npm run build
  # Ejecuta internamente:
  # 1. npm run generate-robots (robots.txt + sitemap.xml principal)
  # 2. npm run generate-sitemap (cancionero/sitemap.xml)
  # 3. npm run generate-sitemap-index (sitemap-index.xml)
```

### Verificación automática

```bash
- name: Verify SEO files generated
  run: ls -lh dist/sitemap*.xml dist/robots.txt
```

## Scripts de Generación (Referencia)

Ubicación: `/scripts/`

| Script | Genera | Ejecuta |
|--------|--------|---------|
| `generate-seo-files.js` | robots.txt + sitemap.xml | `npm run generate-robots` |
| `generate-sitemap.mjs` | cancionero/sitemap.xml | `npm run generate-sitemap` |
| `generate-sitemap-index.mjs` | sitemap-index.xml | `npm run generate-sitemap-index` |

## Troubleshooting

### Problema: "Descubierta: actualmente sin indexar" (34 páginas)

**Causas posibles**:
1. Contenido duplicado/thin
2. Falta de internal links
3. URL muy nueva (normal en primeras 2 semanas)
4. Meta robots noindex (revisar)

**Solución**:
- Mejorar contenido de cada canción
- Agregar meta description única
- Crear links internos relevantes
- Esperar 2 semanas más

### Problema: "Rastreada: actualmente sin indexar" (1 página)

**Causas**:
1. Duplicate content (revisar canonical)
2. Noindex meta tag
3. Canonicalizada a otra URL

**Solución**:
- Revisar en Search Console qué URL es
- Verificar canonical tag
- Si es intencional (duplicado), dejarlo
- Si no es intencional, corregir

### Problema: URLs 404

**Solución inmediata**:
```bash
# Encontrar archivo .md
find songs -name "*NOMBRECANCION*"

# Si no existe, eliminar del sitemap (ocurre automáticamente)
npm run build
```

### Problema: URLs con redirect

**Solución**:
1. Verificar que redirect es 301
2. Usar URL destino en sitemap (ocurre automáticamente en próximo build)
3. Esperar rerastreo (1-7 días)

## Recursos Útiles

- **Google Search Console Help**: https://support.google.com/webmasters
- **Sitemap Protocol**: https://www.sitemaps.org/
- **Rich Results Test**: https://search.google.com/test/rich-results
- **Mobile-Friendly Test**: https://search.google.com/test/mobile-friendly
- **Google Search Central**: https://developers.google.com/search

## Checklist de Implementación

### ✅ Completado
- [x] Sanitización de URLs en sitemap de canciones
- [x] Validación de URLs antes de incluir
- [x] Sitemap index que referencía múltiples sitemaps
- [x] Robots.txt mejorado con referencias explícitas
- [x] Scripts de generación automática en cada build
- [x] Logging detallado de errores en scripts
- [x] Documentación de SEO

### ⏭️ Próximos Pasos (Manual)
- [ ] Enviar sitemap-index.xml a Google Search Console
- [ ] Monitorear "Cobertura" durante 2 semanas
- [ ] Revisar URLs con 404/redirect
- [ ] Mejorar contenido de canciones (meta, descripción, links)
- [ ] Monitorear impresiones en "Rendimiento"

## Contacto

Para preguntas o ajustes, revisar:
- `/docs/deployment/SITEMAP_MANAGEMENT.md` (documentación técnica)
- GitHub Issues en tonybolanyo/cancionero
