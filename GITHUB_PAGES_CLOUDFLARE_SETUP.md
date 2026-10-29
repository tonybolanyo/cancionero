# Configurar GitHub Pages + Cloudflare para Cancionero

Guía completa para optimizar SEO y velocidad con caché inteligente y purga automática.

---

## 🎯 Objetivo Final
- Publicar en `example.com/cancionero`
- Caché optimizado: canciones frescas (máx 24h), programación estable (máx 7d)
- Purgar caché automáticamente con GitHub Actions en cada deploy
- SEO optimizado con meta tags y sitemaps

---

## Fase 1: Configurar GitHub Pages

### 1.1 Configuración Base en GitHub
1. Ve a **tu repositorio** → **Settings** → **Pages**
2. **Source**: Selecciona `Deploy from a branch`
3. **Branch**: Elige la rama que publica (ej: `main` o `dist`)
4. **Folder**: Selecciona `/` o `/docs` según dónde esté tu build
5. Guarda cambios

**Resultado**: Tu sitio está en `https://tonybolanyo.github.io/cancionero` (temporal, cambiaremos a custom domain)

### 1.2 Agregar Dominio Custom
1. En **Settings** → **Pages** → **Custom domain**
2. Ingresa: `cancionero.example.com`
3. Haz clic en **Save**
4. GitHub creará automáticamente un commit con `CNAME` file

**Archivo `CNAME` generado:**
```
cancionero.example.com
```

Si no se genera, créalo manualmente en la raíz de tu rama publicada:
```bash
echo "cancionero.example.com" > CNAME
git add CNAME
git commit -m "Add CNAME for custom domain"
git push
```

---

## Fase 2: Configurar Cloudflare

### 2.1 Crear Cuenta y Agregar Sitio
1. Ve a [cloudflare.com](https://cloudflare.com)
2. **Registra tu sitio**: example.com
3. Cloudflare te mostrará 2 nameservers (ej: `carlos.ns.cloudflare.com` y `lucia.ns.cloudflare.com`)

### 2.2 Actualizar Nameservers en tu Registrador
1. Ve a tu registrador (Namecheap, GoDaddy, etc.)
2. En **Nameservers**, reemplaza los nameservers con los de Cloudflare
3. Guarda cambios (puede tomar 24-48 horas para propagarse)

### 2.3 Crear Registros DNS en Cloudflare
1. En Cloudflare Dashboard → **DNS**
2. Agrega estos registros:

| Tipo  | Nombre         | Contenido                              | TTL   | Proxy |
|-------|----------------|----------------------------------------|-------|-------|
| CNAME | cancionero     | tonybolanyo.github.io                  | Auto  | ✅    |
| A     | example.com    | 185.199.108.153                        | Auto  | ✅    |
| A     | example.com    | 185.199.109.153                        | Auto  | ✅    |
| A     | example.com    | 185.199.110.153                        | Auto  | ✅    |
| A     | example.com    | 185.199.111.153                        | Auto  | ✅    |

**Notas:**
- Las IPs A son los servidores de GitHub Pages
- Marca todos con proxy ✅ (nube naranja) para usar CDN de Cloudflare
- CNAME `cancionero` apunta a tu repo

### 2.4 Verificación SSL
En Cloudflare Dashboard:
- **SSL/TLS** → **Overview** → Selecciona `Full`
- Esto fuerza HTTPS con certificado automático

---

## Fase 3: Estrategia de Caché Inteligente

### 3.1 Crear Reglas de Caché en Cloudflare
Navega a: **Caching** → **Cache Rules** → **Create rule**

#### **Regla 1: Canciones (Alta Frecuencia)**
```
If: (Path contains "/songs" OR Path contains "/canciones")
  AND (NOT Path matches "/api/*")
Then:
  - Cache Status: Cache
  - Cache TTL: 24 hours (1 day)
  - Browser Cache TTL: 4 hours
```
**Razón:** Las canciones se actualizan cada 1-2 días; caché de 24h es ideal.

#### **Regla 2: Programación (Baja Frecuencia)**
```
If: (Path contains "/schedule" OR Path contains "/programming")
Then:
  - Cache Status: Cache
  - Cache TTL: 7 days
  - Browser Cache TTL: 24 hours
```
**Razón:** La programación cambia menos; puede estar en caché más tiempo.

#### **Regla 3: Archivos Estáticos (CSS, JS, Imágenes)**
```
If: (Path matches "*.js" OR "*.css" OR "*.webp" OR "*.png" OR "*.svg")
Then:
  - Cache Status: Cache
  - Cache TTL: 30 days (máximo)
  - Browser Cache TTL: 7 days
```
**Razón:** Assets no cambian frecuentemente; caché agresivo es seguro.

#### **Regla 4: HTML Principal (No Cachear o Corto)**
```
If: Path matches "index.html" OR Path exactly is "/"
Then:
  - Cache Status: Cache
  - Cache TTL: 0 (no cachear en Cloudflare, solo browser)
  - Browser Cache TTL: 5 minutes
```
**Razón:** El index HTML tiene meta tags y sitemaps que cambian; siempre debe estar fresco.

#### **Regla 5: Sitemaps y Robots**
```
If: (Path is "/robots.txt" OR Path is "/sitemap.xml" OR 
     Path matches "/sitemap-*.xml")
Then:
  - Cache Status: Cache
  - Cache TTL: 24 hours
  - Browser Cache TTL: 1 hour
```
**Razón:** Buscadores cachean estos archivos; actualizarlos cada día es suficiente.

### 3.2 Headers HTTP Personalizados (Page Rules)
En Cloudflare: **Rules** → **Page Rules**

**Regla:** `cancionero.example.com/*`
```
Cache Level: Cache Everything
Browser Cache TTL: 1 hour
```

---

## Fase 4: Purga Automática de Caché con GitHub Actions

### 4.1 Crear Secret en GitHub
1. Ve a tu repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Nombre: `CLOUDFLARE_ZONE_ID`
4. Valor: Tu Zone ID de Cloudflare (en Dashboard → Overview, abajo a la derecha)
5. Agrega otro:
   - Nombre: `CLOUDFLARE_API_TOKEN`
   - Valor: Genera en Cloudflare → **My Profile** → **API Tokens** → **Create Token**
     - Permisos: `Zone.Cache.Purge`
     - Zona: `example.com`

### 4.2 Crear GitHub Action para Purgar Caché
Crea archivo: `.github/workflows/purge-cloudflare-cache.yml`

```yaml
name: Purge Cloudflare Cache on Deploy

on:
  push:
    branches:
      - main  # O la rama que publicas en Pages
  workflow_dispatch:  # Permite ejecutar manualmente

jobs:
  purge-cache:
    runs-on: ubuntu-latest
    steps:
      - name: Purge Cloudflare Cache
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"files":["https://cancionero.example.com/index.html","https://cancionero.example.com/sitemap.xml","https://cancionero.example.com/robots.txt"]}'
```

**¿Qué hace?**
- Se ejecuta automáticamente cada vez que haces push a `main`
- Purga solo los archivos críticos (index, sitemap, robots)
- Los assets (CSS, JS) siguen en caché porque no cambian
- Tardará 30 segundos máximo

### 4.3 Purga Selectiva por Tipo de Cambio (Avanzado)
Si quieres purgar más específicamente:

```yaml
name: Purge Cloudflare Cache - Selective

on:
  push:
    branches:
      - main

jobs:
  purge-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Detect Changes
        id: changes
        run: |
          if git diff HEAD~1 | grep -q "songs\|canciones"; then
            echo "PURGE_SONGS=true" >> $GITHUB_OUTPUT
          fi
          if git diff HEAD~1 | grep -q "schedule\|programming"; then
            echo "PURGE_SCHEDULE=true" >> $GITHUB_OUTPUT
          fi
      
      - name: Purge Songs Cache
        if: steps.changes.outputs.PURGE_SONGS == 'true'
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"files":["https://cancionero.example.com/songs/*","https://cancionero.example.com/index.html"]}'
      
      - name: Purge Schedule Cache
        if: steps.changes.outputs.PURGE_SCHEDULE == 'true'
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"files":["https://cancionero.example.com/schedule/*","https://cancionero.example.com/index.html"]}'
```

---

## Fase 5: Optimizaciones SEO

### 5.1 Meta Tags Esenciales
En tu `index.html` (o template):

```html
<head>
  <!-- Básicos -->
  <title>Cancionero | Canciones y Programación Musical</title>
  <meta name="description" content="Acceso a canciones actualizadas diariamente y programación musical. Descubre letras, acordes y más.">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Open Graph (Redes Sociales) -->
  <meta property="og:title" content="Cancionero | Canciones y Programación">
  <meta property="og:description" content="Acceso a canciones actualizadas diariamente y programación musical.">
  <meta property="og:url" content="https://cancionero.example.com">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://cancionero.example.com/og-image.png">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Cancionero">
  <meta name="twitter:description" content="Canciones actualizadas diariamente">
  
  <!-- Canonical (Evita duplicados) -->
  <link rel="canonical" href="https://cancionero.example.com">
  
  <!-- JSON-LD Schema (Estructurado) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Cancionero",
    "url": "https://cancionero.example.com",
    "description": "Canciones y programación musical actualizada diariamente",
    "mainEntity": {
      "@type": "MusicGroup"
    }
  }
  </script>
</head>
```

### 5.2 Archivo robots.txt
Crea: `robots.txt` en la raíz

```
User-agent: *
Allow: /
Allow: /sitemap.xml

Disallow: /admin
Disallow: /.git

Sitemap: https://cancionero.example.com/sitemap.xml
```

### 5.3 Sitemap XML
Crea: `sitemap.xml` en la raíz

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cancionero.example.com</loc>
    <lastmod>2026-10-29</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cancionero.example.com/songs</loc>
    <lastmod>2026-10-29</lastmod>
    <priority>0.9</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://cancionero.example.com/schedule</loc>
    <lastmod>2026-10-28</lastmod>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
```

**Actualiza dinámicamente** con tu herramienta de build si es posible.

### 5.4 Configuración de Rendimiento en Cloudflare
En Cloudflare Dashboard:
- **Speed** → **Optimization**
  - ✅ Auto Minify (HTML, CSS, JS)
  - ✅ Brotli Compression
  - ✅ Early Hints
  - ✅ Rocket Loader (optional)
- **Caching** → **Browser Expiration**: 1 hour (por defecto)

---

## Fase 6: Monitoreo y Validación

### 6.1 Verificar SSL
```bash
curl -I https://cancionero.example.com
# Verifica: HTTP/2 200 OK
# Verifica header: cf-cache-status: HIT (en segunda carga)
```

### 6.2 Validar Sitemap
- Cloudflare Dashboard → **Analytics & Logs** → Verifica las peticiones
- Google Search Console: Agrega `sitemap.xml`
- Bing Webmaster Tools: Agrega `sitemap.xml`

### 6.3 Test de Velocidad
- [PageSpeed Insights](https://pagespeed.web.dev) - Ingresa `cancionero.example.com`
- [GTmetrix](https://gtmetrix.com) - Monitoreo detallado

### 6.4 Verificar Caché
```bash
# Primera petición (MISS o EXPIRED)
curl -I https://cancionero.example.com/songs
# Verifica: cf-cache-status: MISS

# Segunda petición (HIT)
curl -I https://cancionero.example.com/songs
# Verifica: cf-cache-status: HIT
```

---

## Fase 7: Workflow de Publicación Diaria

### Flujo Recomendado:
1. **Edita canciones** → Commit a `main`
2. **GitHub Actions** automáticamente:
   - Construye el sitio
   - Publica en GitHub Pages
   - Purga caché en Cloudflare
3. **Resultado**: Sitio actualizado en 30-60 segundos con caché inteligente

### Script Manual de Purga (Opcional)
Si necesitas purgar manualmente desde CLI:

```bash
#!/bin/bash
# save as: scripts/purge-cache.sh

ZONE_ID="tu-zone-id"
API_TOKEN="tu-api-token"
DOMAIN="cancionero.example.com"

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"files\":[\"https://$DOMAIN/index.html\",\"https://$DOMAIN/sitemap.xml\"]}"

echo "✅ Caché purgado en $DOMAIN"
```

Ejecuta con:
```bash
bash scripts/purge-cache.sh
```

---

## Checklist Final

- [ ] Dominio custom configurado en GitHub Pages (CNAME file)
- [ ] Nameservers de Cloudflare activos (propagación completa 24-48h)
- [ ] Registros DNS creados (CNAME cancionero + A records para apex)
- [ ] SSL/TLS en Full mode
- [ ] 5 Cache Rules configuradas
- [ ] Secrets de Cloudflare en GitHub
- [ ] GitHub Action de purga creado y probado
- [ ] Meta tags en index.html
- [ ] robots.txt y sitemap.xml creados
- [ ] Sitio indexado en Google Search Console
- [ ] Test de velocidad aprobado (Lighthouse > 90)
- [ ] Headers cf-cache-status: HIT verificados

---

## Solución de Problemas

### El sitio no carga / Error 522
- **Causa**: GitHub Pages rechaza la conexión desde Cloudflare
- **Solución**: Verifica que el CNAME esté en tu rama publicada:
  ```bash
  git ls-files | grep CNAME
  # Debe mostrar CNAME en la raíz
  ```

### Caché no se purga automáticamente
- **Causa**: API Token sin permisos correctos
- **Solución**: Regenera el token en Cloudflare con permisos `Zone.Cache.Purge`

### Sitio está lento a pesar de caché
- **Causa**: Assets no comprimidos o imágenes sin optimizar
- **Solución**: Usa Cloudflare Polish (pago) o optimiza localmente con tools como ImageMagick

### Cambios no se ven inmediatamente
- **Causas posibles**:
  1. Navegador caché: Ctrl+Shift+Delete y recarga
  2. Caché de Cloudflare: Espera TTL o purga manualmente
  3. CDN propagación: Espera 5-10 minutos
  
**Debug**: Abre DevTools → Network → verifica header `cf-cache-status`

---

## Referencias
- [GitHub Pages Custom Domain](https://docs.github.com/es/pages/configuring-a-custom-domain-for-your-site)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Cloudflare Purge Cache API](https://developers.cloudflare.com/api/operations/zone-cache-purge)
- [SEO Best Practices](https://developers.google.com/search/docs/beginner/seo-starter-guide)

---

**Última actualización**: 2026-10-29  
**Versión**: 1.0
