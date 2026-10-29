# 🚀 Quick Start: GitHub Pages + Cloudflare + SEO

Resumen rápido para configurar todo en 15 minutos.

---

## ✅ Checklist Rápido

### Paso 1: Cloudflare Setup (5 min)
- [ ] Crea cuenta en [cloudflare.com](https://cloudflare.com)
- [ ] Agrega dominio: `example.com`
- [ ] Copia nameservers de Cloudflare
- [ ] Ve a tu registrador (Namecheap, GoDaddy, etc.)
- [ ] Reemplaza nameservers con los de Cloudflare

### Paso 2: GitHub Secrets (5 min)
Ve a: `tu-repo` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Agrega estos 3 secrets:

```
CLOUDFLARE_ZONE_ID
↓
Cloudflare Dashboard → Overview → Zone ID (abajo a la derecha)

CLOUDFLARE_API_TOKEN  
↓
Cloudflare → My Profile → API Tokens → Create Token (Zone.Cache.Purge)

GOOGLE_ANALYTICS_ID (Opcional)
↓
Google Analytics → Propiedad → ID de propiedad (G-XXXXXXXXXX)
```

### Paso 3: GitHub Pages Setup (3 min)
- [ ] Ve a `Settings` → **Pages**
- [ ] **Custom domain**: `cancionero.example.com`
- [ ] GitHub creará automáticamente `CNAME` file
- [ ] Espera propagación DNS (5-10 min)

### Paso 4: Cloudflare DNS Records (2 min)
En Cloudflare Dashboard → **DNS**, agrega:

```
Tipo   | Nombre       | Valor                          | Proxy ✅
-------|--------------|--------------------------------|--------
CNAME  | cancionero   | tonybolanyo.github.io          | ✅
A      | example.com  | 185.199.108.153                | ✅
A      | example.com  | 185.199.109.153                | ✅
A      | example.com  | 185.199.110.153                | ✅
A      | example.com  | 185.199.111.153                | ✅
```

---

## 📁 Archivos Creados Automáticamente

En este repositorio ya están listos para usar:

| Archivo | Descripción |
|---------|------------|
| `.github/workflows/purge-cloudflare-cache.yml` | GitHub Action que: construye, genera SEO, publica y purga caché |
| `scripts/generate-seo-files.js` | Genera `robots.txt`, `sitemap.xml`, inyecta Google Analytics |
| `src/hooks/useGoogleAnalytics.ts` | Hook React para GA en desarrollo |
| `GITHUB_PAGES_CLOUDFLARE_SETUP.md` | Guía detallada (7 fases) |
| `SECRETS_CONFIGURATION.md` | Cómo configurar secrets y variables |

---

## 🧪 Verificar que todo funciona

### En GitHub
1. Ve a tu repo → **Actions**
2. Espera a que termine el workflow `Deploy to Pages & Purge Cloudflare Cache`
3. Verifica logs (deben aparecer ✅):
   ```
   ✅ robots.txt generado
   ✅ sitemap.xml generado (X URLs)
   ✅ Google Analytics inyectado
   ✅ Caché purgado exitosamente
   ```

### En Producción
```bash
# Verifica robots.txt
curl https://cancionero.example.com/robots.txt

# Verifica sitemap.xml
curl https://cancionero.example.com/sitemap.xml

# Verifica Google Analytics (busca "gtag" en el HTML)
curl https://cancionero.example.com | grep "gtag"

# Verifica caché activo (busca cf-cache-status: HIT)
curl -I https://cancionero.example.com | grep cf-cache
```

---

## 🔧 Configuración Local (Opcional para desarrollo)

Crea `.env.local` en la raíz:
```bash
VITE_GOOGLE_ANALYTICS_ID=G-ABCDEFGHIJ
VITE_ANALYTICS_EVENTS_ENABLED=true
```

Luego en tu React App:
```tsx
import { useGoogleAnalytics, useGAEvent } from './hooks/useGoogleAnalytics';

export default function App() {
  useGoogleAnalytics();
  const trackEvent = useGAEvent();

  return (
    <button onClick={() => trackEvent('click', { page: 'home' })}>
      Track me
    </button>
  );
}
```

---

## 🎯 Flujo Diario

```
1. Editas canciones
   ↓
2. Haces commit a main
   ↓
3. GitHub Actions automáticamente:
   • Construye el sitio (npm run build)
   • Genera robots.txt + sitemap.xml
   • Inyecta Google Analytics
   • Publica en Pages
   • Purga caché Cloudflare
   ↓
4. ✅ Sitio actualizado en 30-60 segundos
```

---

## ⚡ Reglas de Caché (Recomendadas)

En Cloudflare: **Caching** → **Cache Rules**

| Contenido | TTL | Razón |
|-----------|-----|-------|
| `/songs/*` | 24h | Actualizas diariamente |
| `/schedule/*` | 7d | Cambia menos |
| `*.js, *.css` | 30d | No cambia |
| `index.html` | 5min | Meta tags frescos |
| `sitemap.xml, robots.txt` | 24h | Buscadores cachean |

**Click en Cloudflare:** Settings → Caching → Browser Expiration: 1 hour

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Cloudflare error" en workflow | Verifica `CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_API_TOKEN` en Secrets |
| Sitio no carga | Espera 48h para propagación DNS, verifica CNAME en GitHub Pages |
| Cambios no aparecen | Limpia caché: Cloudflare → Caching → Purge Cache |
| GA no funciona | Agrega `GOOGLE_ANALYTICS_ID` en Secrets (es opcional) |

---

## 📚 Documentación Completa

- 📖 `GITHUB_PAGES_CLOUDFLARE_SETUP.md` - Setup detallado (7 fases)
- 🔐 `SECRETS_CONFIGURATION.md` - Secrets y variables
- 📝 `.env.example` - Variables de entorno

---

## 🚀 Siguiente Paso

1. **Ahora**: Configura los 3 secrets en GitHub
2. **Espera 5 min**: DNS se propague
3. **Verifica**: `https://cancionero.example.com` carga
4. **Monitorea**: Google Analytics → Real-time

---

**¿Problemas?** Ver `SECRETS_CONFIGURATION.md` sección "Solución de Problemas"

**Última actualización**: 2026-10-29
