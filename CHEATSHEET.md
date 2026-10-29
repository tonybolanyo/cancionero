# 🎯 Cancionero Deployment - Cheat Sheet

Referencia rápida para configuración y troubleshooting.

---

## ⚡ 3 Pasos Clave (5 minutos)

### 1. Agregar Secrets a GitHub
```bash
# Ve a: Settings → Secrets and variables → Actions → New secret

CLOUDFLARE_ZONE_ID = [tu-zone-id]
CLOUDFLARE_API_TOKEN = [tu-api-token]
GOOGLE_ANALYTICS_ID = G-XXXXXXXXXX  # opcional
```

**Dónde obtenerlos:**
- Zone ID: Cloudflare Dashboard → Overview → abajo a la derecha
- API Token: Cloudflare → My Profile → API Tokens → Create Token (Zone.Cache.Purge)
- GA ID: Google Analytics → Admin → Propiedad

### 2. Configurar Cloudflare DNS
```bash
# Ve a: Cloudflare Dashboard → DNS

Tipo  | Nombre       | Valor                    | Proxy ✅
------|--------------|--------------------------|--------
CNAME | cancionero   | tonybolanyo.github.io    | ✅
A     | example.com  | 185.199.108.153          | ✅
A     | example.com  | 185.199.109.153          | ✅
A     | example.com  | 185.199.110.153          | ✅
A     | example.com  | 185.199.111.153          | ✅
```

### 3. Haz Push
```bash
git push origin main
# GitHub Actions ejecutará automáticamente
# Esperara 30-60 segundos
# ✅ Listo!
```

---

## 🧪 Verificación Rápida

```bash
# ¿Carga el sitio?
curl https://cancionero.example.com

# ¿robots.txt existe?
curl https://cancionero.example.com/robots.txt | head -3

# ¿sitemap.xml existe?
curl https://cancionero.example.com/sitemap.xml | grep -c "<loc>"

# ¿Google Analytics inyectado?
curl https://cancionero.example.com | grep "googletagmanager"

# ¿Caché funciona? (2ª petición debe decir HIT)
curl -I https://cancionero.example.com | grep cf-cache
```

---

## 🚨 Problemas Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Error 522 Bad Gateway` | CNAME incorrecto | Ve a GitHub Pages → verifica CNAME file |
| `❌ Error purgando caché` | API Token expirado | Regenera en Cloudflare → My Profile → API Tokens |
| `❌ GA no aparece` | No configurado | Agrega `GOOGLE_ANALYTICS_ID` en Secrets |
| Cambios no se ven | Caché navegador | Ctrl+Shift+Delete y recarga (o espera TTL) |
| DNS no resuelve | Propagación lenta | Espera 24-48 horas después de cambiar nameservers |

---

## 📊 Caché Rules (Cloudflare)

Si quieres customizar, ve a: **Caching** → **Cache Rules**

```
Canciones (/songs/*)          → 24 horas
Programación (/schedule/*)    → 7 días
Assets (*.js, *.css)          → 30 días
HTML Index                    → 5 minutos
Sitemaps & Robots             → 24 horas
```

---

## 🔍 Monitorear

```
GitHub Actions    → Repo → Actions tab
Google Analytics  → https://analytics.google.com
Cloudflare        → Dashboard → Analytics
```

---

## 📝 Archivos Importantes

```
.github/workflows/purge-cloudflare-cache.yml  → Workflow automation
scripts/generate-seo-files.js                 → Genera robots + sitemap
src/hooks/useGoogleAnalytics.ts               → Hook React para GA
.env.example                                  → Variables de entorno
```

---

## 🔐 Variables Entorno Local

Crear `.env.local`:
```
VITE_GOOGLE_ANALYTICS_ID=G-ABCDEFGHIJ
VITE_ANALYTICS_EVENTS_ENABLED=true
```

En React:
```tsx
import { useGoogleAnalytics } from './hooks/useGoogleAnalytics';

export default function App() {
  useGoogleAnalytics();
  return <YourApp />;
}
```

---

## 📚 Documentación Completa

- `README_DEPLOYMENT.md` → Índice
- `QUICKSTART.md` → Setup paso a paso
- `SECRETS_CONFIGURATION.md` → Secrets y variables
- `GITHUB_PAGES_CLOUDFLARE_SETUP.md` → Detalles técnicos
- `IMPLEMENTATION_SUMMARY.md` → Resumen de implementación

---

## ✅ Checklist Final

- [ ] Cloudflare Zone ID agregado como secret
- [ ] Cloudflare API Token agregado como secret
- [ ] Google Analytics ID agregado (opcional)
- [ ] DNS records en Cloudflare configurados
- [ ] GitHub Pages con dominio custom
- [ ] `.github/workflows/purge-cloudflare-cache.yml` existe
- [ ] `scripts/generate-seo-files.js` existe
- [ ] `src/hooks/useGoogleAnalytics.ts` existe
- [ ] `git push origin main` ejecutado
- [ ] GitHub Actions workflow completó exitosamente
- [ ] Sitio carga en `https://cancionero.example.com`
- [ ] `robots.txt` visible
- [ ] `sitemap.xml` visible
- [ ] Google Analytics aparece en source HTML

---

**¿Necesitas ayuda?** Ver `SECRETS_CONFIGURATION.md` → Solución de Problemas

---

**Versión**: 1.0 | **Última actualización**: 2026-10-29
