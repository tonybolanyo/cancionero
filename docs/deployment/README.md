# 🚀 Deployment

Guías para despliegue en GitHub Pages, configuración de Cloudflare y optimización SEO.

## 📖 Contenidos

- **[README_DEPLOYMENT.md](README_DEPLOYMENT.md)** - Guía completa de despliegue en GitHub Pages
- **[GITHUB_PAGES_CLOUDFLARE_SETUP.md](GITHUB_PAGES_CLOUDFLARE_SETUP.md)** - Integración con Cloudflare
- **[SEO_QUICKSTART.md](SEO_QUICKSTART.md)** - Inicio rápido en SEO
- **[SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md)** - Implementación SEO detallada
- **[SEO_INDEX.md](SEO_INDEX.md)** - Índice de prácticas SEO

## 🎯 Empieza por Aquí

### Primera vez desplegando
1. Sigue [README_DEPLOYMENT.md](README_DEPLOYMENT.md) paso a paso
2. Verifica que el workflow en `.github/workflows/deploy-pages.yml` se ejecute correctamente

### Con Cloudflare
1. Lee [GITHUB_PAGES_CLOUDFLARE_SETUP.md](GITHUB_PAGES_CLOUDFLARE_SETUP.md)
2. Configura los DNS según las instrucciones

### Optimización SEO
1. Comienza con [SEO_QUICKSTART.md](SEO_QUICKSTART.md)
2. Implenta recomendaciones de [SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md)
3. Revisa [SEO_INDEX.md](SEO_INDEX.md) como referencia

## ⚙️ Configuración de Variables

El despliegue usa variables de GitHub Actions:

```
VITE_GITHUB_ALLOWED_USER = tu-usuario-github
VITE_BASE_URL = /cancionero/ (automático con configure-pages)
GEMINI_API_KEY = secreto para análisis de audio (opcional)
```

## 🔄 Flujos Automáticos

Dos workflows se ejecutan en cada push a main/master:

1. **deploy-pages.yml** - Compila y despliega a GitHub Pages
2. **purge-cloudflare-cache.yml** - Limpia caché de Cloudflare (si está configurado)

## 📊 URLs Resultantes

Después del despliegue:
- Web: `https://tu-usuario.github.io/cancionero/`
- Con dominio personalizado: `https://tu-dominio.com/`
