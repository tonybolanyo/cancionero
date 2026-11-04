# Sistema de Versionado Semántico

Este proyecto utiliza **Semantic Versioning (SemVer)** con **Conventional Commits** para el control automático de versiones.

## Versión Actual

**v0.4.0** - Versión base establecida manualmente

## Cómo Funciona

### 1. Conventional Commits

Todos los commits deben seguir el formato de [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

**Tipos Soportados:**

- **`feat`** - Nueva característica → Incrementa **MINOR** version
- **`fix`** - Corrección de bug → Incrementa **PATCH** version  
- **`BREAKING CHANGE`** - Cambio que rompe compatibilidad → Incrementa **MAJOR** version
- `perf` - Mejora de rendimiento → Se incluye en changelog
- `docs` - Cambios en documentación → Se incluye en changelog
- `refactor` - Refactorización → Se incluye en changelog
- `test` - Cambios en tests → Se incluye en changelog
- `ci` - Cambios en CI/CD → Se incluye en changelog
- `chore` - Cambios no relacionados con código → Se incluye en changelog

**Ejemplos:**

```bash
# Nueva característica (minor bump: 0.4.0 → 0.5.0)
git commit -m "feat(lyrics): add chord stripping utility"

# Corrección (patch bump: 0.4.0 → 0.4.1)
git commit -m "fix(parser): handle empty chord sequences"

# Cambio que rompe compatibilidad (major bump: 0.4.0 → 1.0.0)
git commit -m "refactor(api)!: change return format

BREAKING CHANGE: API response format changed from array to object"
```

### 2. Generación Automática de Versiones

El script `scripts/generate-version.js` se ejecuta automáticamente durante el build:

```bash
npm run generate-version
```

**Características:**

- ✅ Analiza todos los commits desde la última etiqueta (tag)
- ✅ Determina el tipo de bump (major/minor/patch) basado en conventional commits
- ✅ Detecta **colisiones de versión** con tags existentes
- ✅ Si hay colisión, incrementa automáticamente el patch
- ✅ **Garantiza siempre un incremento de versión**
- ✅ Genera archivo `src/config/version.ts` con información de construcción

**Proceso:**

1. Se analiza el tipo de cambio desde el último tag (feat → minor, fix → patch, BREAKING → major)
2. Se calcula la siguiente versión semántica
3. Se verifica si esa versión ya existe como tag
4. Si existe colisión, se incrementa el patch automáticamente
5. Se genera el archivo de versión con metadatos de construcción

### 3. Archivo de Versión Generado

Ubicación: `src/config/version.ts`

```typescript
export const APP_VERSION = '0.4.1';              // Versión semántica
export const BUILD_NUMBER = 1;                  // Número de construcción (commit count)
export const COMMIT_HASH = '2943f90';           // Hash corto del commit actual
export const BUILD_BRANCH = 'main';             // Rama actual
export const BUILD_TIMESTAMP = '2026-11-04...'; // Timestamp de construcción

export const FULL_VERSION = '0.4.1+1';          // Versión + build metadata
export const DISPLAY_VERSION = 'v0.4.1 (build: 1)'; // Para mostrar en UI
```

## Flujo de Trabajo

### Para Desarrolladores

1. Realiza tus cambios
2. Haz commits con formato conventional:
   ```bash
   git commit -m "feat(module): descripción del cambio"
   ```
3. Los tags se crean automáticamente en el CI
4. El script de versioning se ejecuta en cada build

### Para Release

1. Los cambios se lanzan automáticamente en `main` vía GitHub Actions
2. Se crea automáticamente un tag de versión (e.g., `v0.5.0`)
3. Se actualiza `package.json` con la nueva versión
4. Se actualiza `CHANGELOG.md` automáticamente
5. Se genera la versión en `src/config/version.ts`

## Ejemplos de Versionado

| Evento | Última Versión | Commits | Nueva Versión |
|--------|---|---------|---|
| Feature agregada | 0.4.0 | `feat(...)` | 0.5.0 |
| Bug fix | 0.4.0 | `fix(...)` | 0.4.1 |
| BREAKING CHANGE | 0.4.0 | `feat!: ...` | 1.0.0 |
| Múltiples features | 0.4.0 | `feat(...) + feat(...)` | 0.5.0 |
| Feature + fixes | 0.4.0 | `feat(...) + fix(...)` | 0.5.0 |
| Solo chores | 0.4.0 | `chore: ...` | 0.4.0 (sin cambio) |

**Nota:** Si hay colisión (v0.4.1 ya existe), automáticamente se usa v0.4.2, v0.4.3, etc.

## Deteção de Colisiones

El sistema de versionado detecta y previene colisiones:

```javascript
// Si v0.4.1 ya existe como tag...
// El siguiente fix automáticamente será v0.4.2
```

Esto garantiza que cada compilación tenga una versión única.

## Configuración

### release-please-config.json

Define cómo se comporta el versionado automático:

- `initial-version`: Versión inicial (0.4.0)
- `release-type`: Tipo de proyecto ("node")
- `version-file`: Archivo a actualizar (package.json)
- `changelog-sections`: Estructura del changelog

### scripts/generate-version.js

Script que genera la versión real basado en:

1. Análisis de conventional commits
2. Detección de tags existentes
3. Cálculo de siguiente versión semántica
4. Generación del archivo de versión

## Integración con CI/CD

El archivo `package.json` contiene en la sección `scripts`:

```json
{
  "scripts": {
    "generate-version": "node scripts/generate-version.js",
    "build": "npm run generate-version && npm run generate-catalog && vite build"
  }
}
```

El build siempre regenera la versión antes de compilar.

## Consultar Versión en Código

En cualquier lugar del proyecto puedes importar la versión:

```typescript
import { APP_VERSION, FULL_VERSION, DISPLAY_VERSION } from '@/config/version';

console.log(`App v${APP_VERSION}`);
console.log(`Full: ${FULL_VERSION}`); // v0.4.1+1
console.log(`Display: ${DISPLAY_VERSION}`); // v0.4.1 (build: 1)
```

## Troubleshooting

### "Siempre muestra 0.0.1"

**Solución:** El script ahora analiza tags reales en git. Asegúrate de:

1. Tener un tag válido: `git tag v0.4.0`
2. Ejecutar: `node scripts/generate-version.js`
3. El archivo debe generarse en `src/config/version.ts`

### Versión no se incrementa

**Razones comunes:**

1. El commit no sigue formato conventional (debe ser `feat:`, `fix:`, etc.)
2. Solo cambios en docs/chores (no incrementan versión)
3. No hay commits nuevos desde el último tag

**Solución:** Verifica con:

```bash
git log --oneline <last-tag>..HEAD
# Los commits deben mostrar "feat:", "fix:", etc.
```

### Colisión de versión

El sistema la detecta automáticamente e incrementa el patch.

Ejemplo:
- Último tag: v0.4.0
- Siguiente sería: v0.4.1
- Si v0.4.1 existe: usa v0.4.2
- Si v0.4.2 existe: usa v0.4.3
- Y así sucesivamente...

## Referencias

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Release Please](https://github.com/googleapis/release-please)
