# 🎸 Cancionero - Deployment & SEO Guide

Guía completa para desplegar Cancionero en GitHub Pages con optimizaciones SEO y caché inteligente vía Cloudflare.

---

## 📋 Documentación

Tenemos **4 documentos** listos. Elige según tu caso:

### 🚀 **1. QUICKSTART.md** (5 min) - ¡COMIENZA AQUÍ!
**Para**: Implementar todo rápidamente  
**Contenido**: 
- ✅ Checklist de 15 minutos
- 🔐 Qué secrets configurar
- 🧪 Cómo verificar que funciona
- 🎯 Flujo diario

👉 **Leer primero este documento**

---

### 🔐 **2. SECRETS_CONFIGURATION.md** (7 min)
**Para**: Entender secrets, variables y configuración local  
**Contenido**:
- 🔐 Cómo obtener `CLOUDFLARE_ZONE_ID`
- 🔐 Cómo generar `CLOUDFLARE_API_TOKEN`
- 📦 Variables de entorno
- 🛠️ Configuración en `.env.local`
- 🐛 Troubleshooting

👉 **Leer si tienes dudas con secrets**

---

### 📖 **3. GITHUB_PAGES_CLOUDFLARE_SETUP.md** (15 min)
**Para**: Entender todo técnicamente  
**Contenido**:
- 🔧 7 Fases completas de setup
- 📡 DNS records en Cloudflare
- ⚙️ 5 Cache Rules optimizadas
- 🤖 GitHub Actions explicado
- 🎯 SEO (meta tags, schema, sitemaps)
- 🧪 Validación y monitoreo

👉 **Leer para conocer todos los detalles**

---

### 📊 **4. IMPLEMENTATION_SUMMARY.md** (2 min)
**Para**: Ver qué se creó exactamente  
**Contenido**:
- 📁 Lista de todos los archivos creados
- 🔄 Diagrama del workflow
- 🎯 Estrategia de caché
- ✅ Checklist de validación

👉 **Leer para verificar qué se implementó**

---

## 🎯 Ruta Recomendada

```
START HERE
    ↓
QUICKSTART.md (15 min setup)
    ↓
¿Tengo dudas con secrets?
    ├─ Sí → SECRETS_CONFIGURATION.md
    └─ No → Siguiente
    ↓
¿Quiero entender todo técnicamente?
    ├─ Sí → GITHUB_PAGES_CLOUDFLARE_SETUP.md
    └─ No → Siguiente
    ↓
¿Quiero ver qué se creó?
    ├─ Sí → IMPLEMENTATION_SUMMARY.md
    └─ No → ✅ Ready to deploy!
```

---

## ⚡ TL;DR - Los 3 Pasos Esenciales

### 1️⃣ Configura Secrets en GitHub (2 min)
```
Settings → Secrets and variables → Actions → New repository secret

CLOUDFLARE_ZONE_ID         = Tu Zone ID
CLOUDFLARE_API_TOKEN       = Tu API Token
GOOGLE_ANALYTICS_ID        = G-XXXXXXXXXX (opcional)
```

### 2️⃣ Configura Cloudflare DNS (2 min)
```
Dashboard → DNS

CNAME cancionero → tonybolanyo.github.io
A example.com → 185.199.108.153
A example.com → 185.199.109.153
A example.com → 185.199.110.153
A example.com → 185.199.111.153
```

### 3️⃣ Haz Push a Main
```bash
git push origin main
```

✅ **GitHub Actions** ejecutará automáticamente:
- Build (`npm run build`)
- Genera SEO files (robots.txt, sitemap.xml)
- Inyecta Google Analytics
- Deploy a Pages
- Purga caché Cloudflare

---

## 📁 Archivos Creados

```
.github/workflows/
  └─ purge-cloudflare-cache.yml         # GitHub Actions workflow
  
scripts/
  └─ generate-seo-files.js              # Script de generación de SEO

src/hooks/
  └─ useGoogleAnalytics.ts              # Hook React para GA

docs/
  ├─ QUICKSTART.md                      # 👈 LEER PRIMERO
  ├─ SECRETS_CONFIGURATION.md           # Para dudas
  ├─ GITHUB_PAGES_CLOUDFLARE_SETUP.md   # Detalles técnicos
  ├─ IMPLEMENTATION_SUMMARY.md          # Resumen
  └─ README_DEPLOYMENT.md               # Este archivo
```

---

## ✅ Checklist de Validación

Después de configurar todo, verifica:

```bash
# 1. Sitio carga
curl https://cancionero.example.com

# 2. robots.txt existe
curl https://cancionero.example.com/robots.txt | head -5

# 3. sitemap.xml existe  
curl https://cancionero.example.com/sitemap.xml | head -10

# 4. Google Analytics inyectado
curl https://cancionero.example.com | grep "googletagmanager"

# 5. Caché activo (debe decir HIT después de 2ª petición)
curl -I https://cancionero.example.com | grep cf-cache-status
```

**Resultado esperado**:
```
✅ Sitio carga correctamente
✅ robots.txt visible
✅ sitemap.xml visible
✅ Google Analytics tag presente
✅ cf-cache-status: HIT (en 2ª petición)
```

---

## 🎨 Stack Tecnológico

```
Frontend
├─ React 19
├─ Vite (Build)
└─ Tailwind CSS

Hosting & CDN
├─ GitHub Pages (Static hosting)
└─ Cloudflare (CDN + Caché)

Análitica
└─ Google Analytics 4

CI/CD
└─ GitHub Actions (Auto-deploy + Purga caché)
```

---

## 📊 Estrategia de Caché

```
Canciones           → 24 horas  (actualizas diariamente)
Programación        → 7 días    (cambia semanalmente)
Assets (JS/CSS)     → 30 días   (no cambian)
HTML Index          → 5 min     (meta tags frescos)
Sitemaps/Robots.txt → 24 horas  (buscadores cachean)

Auto-purga: Cada deploy limpia archivos críticos
```

---

## 🚀 Flujo Diario

```
Mañana → Editas canciones
   ↓
Commit → git push origin main
   ↓
GitHub Actions ← se ejecuta automáticamente
   ↓
✅ Build
✅ Generate SEO files
✅ Deploy to Pages
✅ Purge Cloudflare Cache
   ↓
30-60 segundos → Sitio actualizado en producción
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Error 522" en Cloudflare | Verifica CNAME en GitHub Pages |
| Caché no se purga | Verifica `CLOUDFLARE_API_TOKEN` tiene permiso `Zone.Cache.Purge` |
| GA no aparece | Agrega `GOOGLE_ANALYTICS_ID` en Secrets (es opcional) |
| DNS no resuelve | Espera 24-48h para propagación de nameservers |
| Cambios no se ven | Limpia navegador o espera TTL de caché |

**Ver más**: SECRETS_CONFIGURATION.md → Solución de Problemas

---

## 📞 Soporte

- **Setup rápido**: Ver `QUICKSTART.md`
- **Dudas con secrets**: Ver `SECRETS_CONFIGURATION.md`
- **Detalles técnicos**: Ver `GITHUB_PAGES_CLOUDFLARE_SETUP.md`
- **Verificar implementación**: Ver `IMPLEMENTATION_SUMMARY.md`

---

## 🎯 Próximos Pasos

1. ✅ Lee `QUICKSTART.md` (5 min)
2. ✅ Configura secrets en GitHub (5 min)
3. ✅ Configura DNS en Cloudflare (2 min)
4. ✅ Haz `git push` a main (1 min)
5. ✅ Verifica en [tu-sitio.com](https://cancionero.example.com)
6. ✅ Monitorea en [Google Analytics](https://analytics.google.com)

---

**¿Listo?** 👉 [Abre QUICKSTART.md](./QUICKSTART.md)

---

**Versión**: 1.0  
**Última actualización**: 2026-10-29  
**Estado**: ✅ Producción lista
