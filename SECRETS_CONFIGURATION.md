# Configuración de Secrets y Variables de GitHub

Guía para configurar las variables de entorno necesarias en GitHub Actions y desarrollo local.

---

## 🔐 Secrets de GitHub (Información sensible)

Los secrets se usan en GitHub Actions y NO se exponen en el código.

### 1. Acceder a Secrets en GitHub
1. Ve a tu repositorio → **Settings**
2. En la barra izquierda → **Secrets and variables** → **Actions**
3. Haz clic en **New repository secret**

### 2. Secrets Requeridos

#### `CLOUDFLARE_ZONE_ID`
**Descripción**: ID de tu zona en Cloudflare  
**Dónde obtenerlo**: Cloudflare Dashboard → ejemplo.com → Overview → Zone ID (abajo a la derecha)  
**Ejemplo**: `1234567890abcdef1234567890abcdef`

#### `CLOUDFLARE_API_TOKEN`
**Descripción**: Token de API para purgar caché  
**Dónde obtenerlo**: 
1. Cloudflare Dashboard → Tu perfil (esquina superior derecha)
2. **My Profile** → **API Tokens**
3. **Create Token** → Template "Edit Cloudflare Workers"
4. **Permissions**: `Zone.Cache.Purge` → Zone: `example.com`
5. Copiar el token generado

**Ejemplo**: `v1.0abcdefghijklmnopqrstuvwxyz0123456789...`

⚠️ **Guardar en lugar seguro**: Una vez cerrada la ventana, no puedes verlo nuevamente.

#### `GOOGLE_ANALYTICS_ID` (Opcional)
**Descripción**: ID de Google Analytics (G-XXXXXXXXXX)  
**Dónde obtenerlo**: 
1. [Google Analytics](https://analytics.google.com/)
2. Crear propiedad para `cancionero.example.com`
3. Admin → Configuración de propiedad → ID de propiedad (formato: G-XXXXXXXXXX)

**Ejemplo**: `G-ABCDEFGHIJ`

#### `PAGES_DOMAIN` (Opcional, recomendado)
**Descripción**: Tu dominio custom en GitHub Pages  
**Ejemplo**: `cancionero.example.com`  
**Valor por defecto**: `cancionero.example.com` (si no está configurado)

---

## 📦 Variables de Entorno (No sensibles)

Las variables se pueden ver públicamente en el código. Se usan para configuración general.

### Acceder a Variables
1. Ve a tu repositorio → **Settings**
2. **Secrets and variables** → **Actions** → **Variables**
3. **New repository variable**

### Variables Recomendadas

#### `ANALYTICS_EVENTS_ENABLED`
**Valor**: `true` o `false`  
**Uso**: Habilitar/deshabilitar tracking de eventos  
**En código**: `import.meta.env.VITE_ANALYTICS_EVENTS_ENABLED`

#### `SEO_SITEMAP_LIMIT`
**Valor**: `50000` (máximo de URLs en sitemap)  
**Uso**: Script de generación de sitemap  

---

## 🛠️ Configuración Local (.env.local)

Para desarrollo local, crea un archivo `.env.local` en la raíz del proyecto:

```bash
# .env.local
VITE_GOOGLE_ANALYTICS_ID=G-ABCDEFGHIJ
VITE_ANALYTICS_EVENTS_ENABLED=true
```

**Nota**: Este archivo NO se debe comitear. Está en `.gitignore`.

---

## 🚀 Workflow Completo

### Diagrama de flujo
```
┌─────────────────────────────────┐
│  Push a main                    │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  GitHub Actions Workflow        │
│  (purge-cloudflare-cache.yml)   │
└─────────────┬───────────────────┘
              │
              ├─► Build (npm run build)
              │
              ├─► Generate SEO Files
              │   - robots.txt
              │   - sitemap.xml
              │   - Inyectar GA en index.html
              │   (Usa: GOOGLE_ANALYTICS_ID)
              │
              ├─► Upload to Pages
              │
              ├─► Deploy to Pages
              │
              └─► Purge Cloudflare Cache
                  (Usa: CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN)
```

### Paso a paso del workflow
1. **Build**: `npm run build` genera archivos en `dist/`
2. **Generate SEO Files**: Script Node.js (`.js`) genera:
   - `dist/robots.txt`
   - `dist/sitemap.xml`
   - Inyecta Google Analytics en `dist/index.html`
3. **Deploy**: GitHub Pages publica el contenido
4. **Purge Cache**: Cloudflare limpia su caché

---

## 🧪 Validación

### Verificar Secrets están configurados
En GitHub Actions logs, verifica:
```
✅ robots.txt generado
✅ sitemap.xml generado (X URLs)
✅ Google Analytics inyectado (ID: G-ABCDEFGHIJ)
✅ Caché purgado exitosamente
```

### Verificar archivos en producción
```bash
curl https://cancionero.example.com/robots.txt
curl https://cancionero.example.com/sitemap.xml
curl https://cancionero.example.com/index.html | grep "googletagmanager"
```

### Ver logs de Google Analytics
1. [Google Analytics](https://analytics.google.com/)
2. Real-time → Ahora mismo (debe mostrar sesiones activas después del deploy)

---

## 🐛 Solución de Problemas

### "Error: CLOUDFLARE_ZONE_ID is not set"
**Causa**: Secret no configurado  
**Solución**: Ve a Settings → Secrets → Agrega `CLOUDFLARE_ZONE_ID`

### "❌ Error purgando caché" en logs
**Causa**: Token expirado o permisos insuficientes  
**Solución**: Regenera el token de Cloudflare con permiso `Zone.Cache.Purge`

### "Google Analytics: No configurado" en logs
**Causa**: Normal - `GOOGLE_ANALYTICS_ID` es opcional  
**Solución**: Agrega secret `GOOGLE_ANALYTICS_ID` si quieres GA

### robots.txt o sitemap.xml no aparecen en producción
**Causa**: Script no se ejecutó o distrib está mal configurada  
**Solución**: 
1. Verifica logs en GitHub Actions
2. Asegura que `scripts/generate-seo-files.js` se ejecuta antes de upload

### Sitemap tiene menos URLs de lo esperado
**Causa**: Script solo scanea directorios específicos  
**Solución**: Edita `scripts/generate-seo-files.js` y agrega más palabras clave a:
```javascript
if (['index.html', 'songs', 'schedule', 'programming', 'tu-nueva-ruta'].some(keyword => ...))
```

---

## 📝 Ejemplo: Configuración Completa

### 1. Secrets en GitHub
```
CLOUDFLARE_ZONE_ID = 1234567890abcdef1234567890abcdef
CLOUDFLARE_API_TOKEN = v1.0abcdefghijklmnopqrstuvwxyz0123456789...
GOOGLE_ANALYTICS_ID = G-ABCDEFGHIJ
PAGES_DOMAIN = cancionero.example.com
```

### 2. .env.local (local development)
```
VITE_GOOGLE_ANALYTICS_ID=G-ABCDEFGHIJ
VITE_ANALYTICS_EVENTS_ENABLED=true
```

### 3. Uso en React
```tsx
import { useGoogleAnalytics, useGAEvent } from './hooks/useGoogleAnalytics';

export default function App() {
  useGoogleAnalytics(); // Inicializa GA en el navegador
  const trackEvent = useGAEvent();

  return (
    <button onClick={() => trackEvent('button_clicked', { page: 'home' })}>
      Click me
    </button>
  );
}
```

### 4. En GitHub Actions
```yaml
- name: Generate SEO files
  run: node scripts/generate-seo-files.js
  env:
    DOMAIN: ${{ secrets.PAGES_DOMAIN }}
    GOOGLE_ANALYTICS_ID: ${{ secrets.GOOGLE_ANALYTICS_ID }}
```

---

## 🔄 Mantenimiento

### Regenerar/Rotar Secrets
**Cada 6 meses**, regenera:
1. `CLOUDFLARE_API_TOKEN` (en Cloudflare)
2. Actualiza en GitHub Secrets

### Monitorear Usos
- **Google Analytics**: [Analytics Dashboard](https://analytics.google.com/)
- **Cloudflare**: Dashboard → Analytics
- **GitHub Pages**: Actions → Ver logs de deployment

---

## 📚 Referencias
- [GitHub Secrets Documentation](https://docs.github.com/es/actions/security-guides/encrypted-secrets)
- [Cloudflare API Tokens](https://developers.cloudflare.com/api/tokens/create/)
- [Google Analytics Setup](https://support.google.com/analytics/answer/10089681)
- [GitHub Pages Custom Domain](https://docs.github.com/es/pages/configuring-a-custom-domain-for-your-site)

---

**Última actualización**: 2026-10-29
