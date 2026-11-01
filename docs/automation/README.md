# 🤖 Automation

Automatización, flujos de trabajo y GitHub Actions.

## 📖 Contenidos

Esta sección documenta los flujos automáticos del proyecto.

## 🔄 Flujos GitHub Actions

### 1. Deploy to GitHub Pages
**Archivo**: `.github/workflows/deploy-pages.yml`

Triggered: En cada push a `main` o `master`

Ejecuta:
```
1. Checkout código
2. Setup Node.js
3. Instalar dependencias
4. Construir con Vite
5. Deploy a GitHub Pages
```

Configuración: `VITE_BASE_URL` se obtiene automáticamente de `actions/configure-pages`

### 2. Purge Cloudflare Cache
**Archivo**: `.github/workflows/purge-cloudflare-cache.yml`

Triggered: En cada push a `main` o `master`

Ejecuta:
```
1. Purga caché de Cloudflare
2. Invalida todas las URLs
```

Requisitos: Variables `CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_API_TOKEN` configuradas

### 3. Release Please
**Archivo**: Configuración en `.releaserc.json` y `release-please-config.json`

Triggered: En cada commit

Ejecuta:
```
1. Analiza commits según convención
2. Crea PR con changelog sugerido
3. Al mergear: crea release + tag automático
```

## 📋 Variables de Entorno (Secrets & Variables)

### Publicic Variables (repository variables)
```
VITE_GITHUB_ALLOWED_USER = tu-usuario-github
```

### Secrets
```
GEMINI_API_KEY         # Para análisis de audio (opcional)
CLOUDFLARE_ZONE_ID     # Para purge (opcional)
CLOUDFLARE_API_TOKEN   # Para purge (opcional)
```

## 🔗 Configuración

### vite.config.ts
```typescript
export default {
  base: process.env.VITE_BASE_URL || '/cancionero/'
}
```

### .releaserc.json
Define convenciones de commits y generación de changelog.

### release-please-config.json
Configuración de Release Please para monorepo y branches.

## 📞 Véase también

- [../deployment/README.md](../deployment/README.md) - Despliegue manual
- [../changelog/](../changelog/) - Versionado y releases
- [../development/](../development/) - Variables de desarrollo
