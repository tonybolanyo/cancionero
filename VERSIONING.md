# Versionado Semántico Automático

## Descripción General

El proyecto implementa un sistema de **versionado semántico automático** que se ejecuta en cada despliegue en GitHub Pages. Este sistema calcula automáticamente la versión y el número de build, mostrándolos en el pie de página de la aplicación.

## Componentes

### 1. Script de Generación de Versión
**Ubicación**: `scripts/generate-version.js`

El script ejecuta automáticamente antes de cada build y:

- Extrae información del repositorio Git
- Calcula la versión semántica (MAJOR.MINOR.PATCH)
- Genera un **número de build incremental**
- Crea el archivo `src/config/version.ts` con la información

### 2. Fórmula de Número de Build

**Fórmula estándar usada**: `Commit Count (git rev-list --count HEAD)`

Esta es la fórmula más ampliamente usada en la industria del software:

- **Maven/Java**: Utiliza el commit count como build number
- **Jenkins**: Proporciona `BUILD_NUMBER` basado en ejecuciones (similar al commit count)
- **GitHub Actions**: Se puede usar commit count en workflows
- **npm**: Comunidad usa commit count como número de build
- **Linux Kernel**: Usa commit count en versiones de desarrollo

**Ventajas**:
- ✅ Incrementa automáticamente con cada commit
- ✅ Es determinista (mismo repositorio = mismo número)
- ✅ Funciona sin configuración adicional
- ✅ Ampliamente reconocido en la industria

**Formato**: `v1.2.3+1042` (semver + build metadata)

### 3. Componente Footer

**Ubicación**: `src/components/Footer.tsx`

Muestra en el pie de página:
- Versión completa: `v1.2.3 (build: 1042)`
- Rama actual (si no es master/main)
- Copyright del año

### 4. Workflow de CI/CD

**Ubicación**: `.github/workflows/deploy-pages.yml`

Cambios realizados:
- Se agregó `fetch-depth: 0` para obtener el histórico de commits
- Se agrega un paso "Generate version info" antes del build
- Se actualiza el build script en package.json

## Cómo Funciona

### Flujo de Despliegue

```
Push a main/master
    ↓
GitHub Actions: Checkout (fetch-depth: 0)
    ↓
npm run generate-version
    ├─ Lee git history (todos los commits)
    ├─ Cuenta commits totales
    ├─ Obtiene últimas tags semver
    ├─ Genera src/config/version.ts
    ↓
npm run build
    ├─ Incluye version.ts en el bundle
    ├─ Importa Footer con versión
    ↓
Despliegue en GitHub Pages
    ↓
Pie de página muestra: v1.2.3 (build: 1042)
```

### Incremento Automático

Cada nuevo commit incrementa automáticamente el número de build:

```
Commit 1: build 1
Commit 2: build 2
...
Commit 1042: build 1042
```

## Configuración del Versionado Semántico

### Usando Git Tags

Para crear una nueva versión semántica, crea un tag:

```bash
# Crear versión 1.0.0
git tag v1.0.0
git push origin v1.0.0

# Crear versión 2.1.3
git tag v2.1.3
git push origin v2.1.3
```

El script automáticamente detectará el tag más reciente y lo usará como base.

### Configuración en package.json

La versión en `package.json` sirve como valor por defecto:

```json
{
  "version": "0.1.0"
}
```

El script busca:
1. Tags git más recientes (ej: v1.2.3)
2. Si no hay tags, usa la versión de package.json
3. Si no hay info, por defecto es 0.0.0

## Ejemplo de Salida

### Archivo generado: `src/config/version.ts`

```typescript
export const APP_VERSION = '1.2.3';
export const BUILD_NUMBER = 1042;
export const COMMIT_HASH = 'a1b2c3d4';
export const BUILD_BRANCH = 'main';
export const BUILD_TIMESTAMP = '2024-10-30T20:22:45.917Z';

// Formato completo con build metadata
export const FULL_VERSION = '1.2.3+1042';

// Para mostrar en UI
export const DISPLAY_VERSION = 'v1.2.3 (build: 1042)';
```

### En el Footer

```
Cancionero v1.2.3 (build: 1042) [main]
© 2024 Cancionero. All rights reserved.
```

## Scripts Disponibles

```bash
# Generar versión manualmente
npm run generate-version

# Build completo (genera versión + build)
npm run build
```

## Ventajas del Sistema

✅ **Automático**: No requiere intervención manual
✅ **Reproducible**: Mismo resultado siempre con mismo repositorio
✅ **Estándar**: Usa prácticas de la industria
✅ **Transparent**: Versión visible en la UI
✅ **Escalable**: Funciona para proyectos de cualquier tamaño
✅ **Git-native**: Sin dependencias externas

## Recursos Relacionados

- [Semantic Versioning](https://semver.org/)
- [Build Numbering - Maven](https://maven.apache.org/plugins/maven-assembly-plugin/)
- [GitHub Actions Versioning](https://github.com/actions/release-please)
- [Conventional Commits](https://www.conventionalcommits.org/)
