# Implementación de Versionado Semántico Automático

## ✅ Resumen de Cambios

Se ha implementado un sistema completo de **versionado semántico automático** con números de build incrementales que se ejecuta en cada despliegue.

### Archivos Nuevos

1. **`scripts/generate-version.js`** (152 líneas)
   - Script Node.js que genera versión automáticamente
   - Calcula build number usando: **commit count** (estándar de la industria)
   - Detecta tags semver (v1.2.3) del repositorio
   - Genera `src/config/version.ts` con variables exportadas

2. **`src/config/version.ts`** (AUTO-GENERATED)
   - Archivo autogenerado en cada build
   - Exporta: `APP_VERSION`, `BUILD_NUMBER`, `COMMIT_HASH`, `BUILD_BRANCH`, `BUILD_TIMESTAMP`
   - Exporta formato UI: `DISPLAY_VERSION` (ej: "v1.2.3 (build: 1042)")

3. **`src/components/Footer.tsx`** (89 líneas)
   - Componente React refactorizado que muestra versión en pie de página
   - Importa y usa `DISPLAY_VERSION` y `BUILD_BRANCH`
   - Muestra rama actual si no es master/main
   - Props pasadas desde App.tsx para callbacks

4. **`VERSIONING.md`** (Documentación completa)
   - Explica el sistema de versioning
   - Fórmula de build number (commit count)
   - Cómo usar git tags para versioning semántico
   - Ejemplos y ventajas del sistema

### Archivos Modificados

1. **`package.json`**
   ```json
   "generate-version": "node scripts/generate-version.js",
   "build": "npm run generate-version && vite build"
   ```
   - Nuevo script `generate-version`
   - El build ahora ejecuta la generación de versión primero

2. **`.github/workflows/deploy-pages.yml`**
   - Agregado `fetch-depth: 0` para obtener todo el histórico de commits
   - Paso "Generate version info" antes del build
   - Asegura que la versión se genere en CI/CD

3. **`src/App.tsx`**
   - Importado componente `Footer` nuevo
   - Reemplazado footer inline por componente `<Footer />`
   - Agregadas importaciones de iconos: `Music2`, `BarChart3`

## 📊 Fórmula de Número de Build

**Método**: `git rev-list --count HEAD`

Esta es una práctica estándar en la industria:
- **Maven**: build-number-maven-plugin usa commit count
- **Jenkins**: BUILD_NUMBER basado en ejecuciones
- **npm**: Comunidad usa commit count
- **Linux Kernel**: Versiones de desarrollo

**Ventajas**:
- ✅ Incrementa automáticamente con cada commit
- ✅ Determinista y reproducible
- ✅ Sin dependencias externas
- ✅ Funciona en cualquier entorno

**Formato**: `v1.2.3+1042` (semver + build metadata)

## 🔄 Flujo Automático

```
1. Push a main/master
   ↓
2. GitHub Actions:
   - Checkout con fetch-depth: 0
   - npm run generate-version
     - Lee git history
     - Cuenta commits totales
     - Detecta tags semver
     - Crea src/config/version.ts
   ↓
3. npm run build
   - Incluye version.ts en bundle
   - Importa Footer con versión
   ↓
4. Deploy en GitHub Pages
   - Pie de página muestra: v1.2.3 (build: 1042)
```

## 🏷️ Uso de Git Tags

Para crear nuevas versiones semánticas:

```bash
# Versión 1.0.0
git tag v1.0.0
git push origin v1.0.0

# Versión 2.1.3
git tag v2.1.3
git push origin v2.1.3
```

El script automáticamente detectará el tag más reciente.

## 📦 Mostrado en UI

### Pie de Página
```
🎵 v1.2.3 (build: 1042) [psychic-eureka]
© 2024 Cancionero. All rights reserved.
```

### Variables Disponibles
```typescript
// src/config/version.ts (auto-generado)
export const APP_VERSION = '1.2.3';
export const BUILD_NUMBER = 1042;
export const COMMIT_HASH = 'a1b2c3d4';
export const BUILD_BRANCH = 'main';
export const FULL_VERSION = '1.2.3+1042'; // Semver + build
export const DISPLAY_VERSION = 'v1.2.3 (build: 1042)'; // Para UI
```

## ✨ Características

- ✅ Versionado completamente automático
- ✅ Número de build incremental estándar
- ✅ Funciona sin configuración extra
- ✅ Git-native (usa solo git info)
- ✅ CI/CD friendly (GitHub Actions optimizado)
- ✅ Visible en UI (pie de página)
- ✅ Reproducible (mismo repo = mismo número)
- ✅ Escalable (funciona en cualquier proyecto)

## 📖 Documentación

Ver `VERSIONING.md` para documentación completa del sistema.
