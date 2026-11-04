# Especificación Técnica del Sistema de Versionado

## Arquitectura

### Componentes

1. **`release-please-config.json`**: Configuración para GitHub Release Please
2. **`scripts/generate-version.js`**: Script Node.js que genera versiones semánticas
3. **`package.json`**: Almacena versión semántica actual
4. **`src/config/version.ts`**: Archivo autogenerado con metadatos de construcción
5. **Git Tags**: Registro histórico de versiones liberadas

### Flujo de Versionado

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer commits with conventional format              │
│    git commit -m "feat(module): description"               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 2. npm run build (or generate-version)                      │
│    Executes: scripts/generate-version.js                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 3. Analyze Commits                                          │
│    - Get commits since last tag (via: git log <tag>..HEAD)│
│    - Parse commit messages for type (feat, fix, etc)      │
│    - Determine bump type: major/minor/patch/none          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 4. Calculate Next Version                                  │
│    - Current: v0.4.0                                        │
│    - Bump type: feat → minor                               │
│    - Candidate: 0.5.0                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 5. Collision Detection (CRITICAL FEATURE)                  │
│    - Query all git tags: git tag -l --sort=-version:refname│
│    - Check if candidate version (v0.5.0) already exists   │
│    - If EXISTS: increment patch until unique              │
│      • 0.5.0 exists? Try 0.5.1                           │
│      • 0.5.1 exists? Try 0.5.2                           │
│      • etc...                                              │
│    - If NOT EXISTS: use candidate version                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 6. Generate Metadata                                        │
│    - Build Number: git rev-list --count HEAD (total commits)
│    - Commit Hash: git rev-parse --short HEAD              │
│    - Branch: git rev-parse --abbrev-ref HEAD              │
│    - Timestamp: new Date().toISOString()                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 7. Write version.ts                                         │
│    export const APP_VERSION = '0.5.0'                      │
│    export const BUILD_NUMBER = 42                          │
│    export const FULL_VERSION = '0.5.0+42'                 │
│    etc...                                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 8. Build Complete                                           │
│    Version info available throughout the app              │
└─────────────────────────────────────────────────────────────┘
```

## Algoritmo de Detección de Colisiones

### Pseudocódigo

```javascript
function getNextVersion(bump) {
  // 1. Obtener todas las versiones de tags existentes
  const versions = getAllSemanticVersionTagsFromGit();
  // Resultado: ["0.4.0", "0.3.1", "0.3.0", ...]
  
  // 2. Obtener la versión más reciente
  const [major, minor, patch] = getLatestVersion(versions);
  // Resultado: [0, 4, 0]
  
  // 3. Calcular siguiente versión basada en bump type
  let nextVersion = calculateBump(major, minor, patch, bump);
  // feat: [0, 5, 0]
  // fix: [0, 4, 1]
  // major: [1, 0, 0]
  
  // 4. Detección de colisiones iterativa
  let finalVersion = nextVersion;
  let collisionCount = 0;
  const maxAttempts = 1000;
  
  while (versions.contains(finalVersion) && collisionCount < maxAttempts) {
    // Si existe colisión, incrementar patch
    finalVersion.patch++;
    collisionCount++;
  }
  
  if (collisionCount >= maxAttempts) {
    throw new Error("Too many version collision attempts");
  }
  
  return finalVersion;
  // Retorna: [0, 5, 0] si no hay colisión
  //          [0, 5, 2] si 0.5.0 y 0.5.1 existen
}
```

### Ejemplo Real

**Escenario:**

```
Existing tags:  v0.4.0, v0.3.5, v0.3.4
Last commit:    "feat: add new feature"
```

**Ejecución:**

1. Obtener versiones: `["0.4.0", "0.3.5", "0.3.4"]`
2. Última versión: `0.4.0`
3. Bump type: `feat` → `minor`
4. Candidato: `0.5.0`
5. ¿Existe `0.5.0`? → NO
6. **Resultado: `0.5.0`** ✓

**Escenario con Colisión:**

```
Existing tags:  v0.4.0, v0.4.1, v0.4.2
Last commit:    "fix: bug fix"
Manual creation: v0.4.3 (accidental duplicate creation)
```

**Ejecución:**

1. Obtener versiones: `["0.4.2", "0.4.1", "0.4.0"]`
2. Última versión: `0.4.2` (ordena por versión)
3. Bump type: `fix` → `patch`
4. Candidato: `0.4.3`
5. ¿Existe `0.4.3`? → NO
6. **Resultado: `0.4.3`** ✓

Si hubiera existido v0.4.3:

1-3. Mismo proceso
4. Candidato: `0.4.3`
5. ¿Existe `0.4.3`? → **SÍ**
6. Incrementar patch: Candidato = `0.4.4`
7. ¿Existe `0.4.4`? → NO
8. **Resultado: `0.4.4`** ✓

## Formato de Versión Generada

### Semantic Versioning Estándar (SemVer)

```
MAJOR.MINOR.PATCH
0.4.0
│    │    └─ PATCH: incrementa con fix commits
│    └────── MINOR: incrementa con feat commits
└─────────── MAJOR: incrementa con BREAKING CHANGE
```

### Formato Completo Generado

```
APP_VERSION:      0.4.1                    (SemVer)
BUILD_NUMBER:     42                       (Commit count)
FULL_VERSION:     0.4.1+42                 (SemVer + metadata)
DISPLAY_VERSION:  v0.4.1 (build: 42)       (UI-friendly)
```

## Tipos de Commits y Bumps

### Mapeo Oficial

```javascript
const commitTypeToBump = {
  'feat':     'minor',      // Nueva característica
  'fix':      'patch',      // Corrección de bug
  'perf':     'patch',      // Mejora de rendimiento (se incluye, pero es patch)
  'docs':     'none',       // Documentación (no incrementa versión)
  'refactor': 'none',       // Refactorización (no incrementa versión)
  'test':     'none',       // Tests (no incrementa versión)
  'ci':       'none',       // CI/CD (no incrementa versión)
  'chore':    'none',       // Chores (no incrementa versión)
};

// BREAKING CHANGE siempre es MAJOR
if (commitMessage.includes('BREAKING CHANGE')) {
  bump = 'major';
}
```

### Ejemplos de Commits

```bash
# MINOR bump (feature)
git commit -m "feat(parser): add support for alternate tunings"
# Resultado: 0.4.0 → 0.5.0

# PATCH bump (fix)
git commit -m "fix(ui): correct alignment on mobile devices"
# Resultado: 0.4.0 → 0.4.1

# MAJOR bump (breaking)
git commit -m "refactor(api): restructure response format

BREAKING CHANGE: API now returns objects instead of arrays"
# Resultado: 0.4.0 → 1.0.0

# NO bump (chore, docs, etc)
git commit -m "docs: update README with new screenshots"
# Resultado: 0.4.0 → 0.4.0 (sin cambio)
```

## Almacenamiento de Metadatos

### Archivo src/config/version.ts

```typescript
export const APP_VERSION = '0.4.1';                              // String semántico
export const BUILD_NUMBER = 42;                                 // Número entero
export const COMMIT_HASH = '3a7f2b9';                           // String hex
export const BUILD_BRANCH = 'main';                             // String nombre rama
export const BUILD_TIMESTAMP = '2026-11-04T21:06:04.295Z';      // ISO 8601

export const FULL_VERSION = `${APP_VERSION}+${BUILD_NUMBER}`;   // "0.4.1+42"
export const DISPLAY_VERSION = `v${APP_VERSION} (build: ${BUILD_NUMBER})`;  // "v0.4.1 (build: 42)"
```

### Propósito de Cada Campo

| Campo | Tipo | Propósito | Ejemplo |
|-------|------|----------|---------|
| `APP_VERSION` | string | Versión semántica para distribución | "0.4.1" |
| `BUILD_NUMBER` | number | Número incremental único por build | 42 |
| `COMMIT_HASH` | string | Referencia al commit que generó esta versión | "3a7f2b9" |
| `BUILD_BRANCH` | string | Rama de git donde se construyó | "main" |
| `BUILD_TIMESTAMP` | string | Cuándo se generó esta versión | "2026-11-04T21:06:04.295Z" |
| `FULL_VERSION` | string | Version + metadata (SemVer + metadata format) | "0.4.1+42" |
| `DISPLAY_VERSION` | string | Formato amigable para mostrar en UI | "v0.4.1 (build: 42)" |

## Manejo de Errores

### Casos Edge

```javascript
// 1. No hay commits en el repo
if (commits.length === 0) {
  return '0.0.1';
}

// 2. No hay tags, pero hay commits
if (tags.length === 0) {
  return '0.1.0';  // o la versión inicial
}

// 3. Git no está disponible
try {
  execSync('git tag -l');
} catch (error) {
  console.error('Git not available');
  return fallbackVersion;
}

// 4. Demasiadas colisiones (bucle infinito protección)
if (collisionCount > 1000) {
  throw new Error('Too many version collision attempts');
}
```

## Integración con CI/CD

### GitHub Actions (Recomendado)

El proyecto usa **release-please** que automáticamente:

1. Analiza PRs para detectar tipos de cambios
2. Crea PRs de release con cambios de versión
3. Cuando se mergea, crea tags automáticamente

### Flujo Manual

```bash
# 1. Hacer commits con conventional format
git commit -m "feat: nueva característica"

# 2. Generar versión (opcional, se ejecuta en build)
npm run generate-version

# 3. Build normal
npm run build
```

## Performance

### Complejidad Computacional

```
Obtener tags:              O(n) donde n = número de tags
Ordenar versiones:         O(n log n)
Detección de colisiones:   O(1) en promedio (rarísimo que haya colisiones)
Generar archivo:           O(1)

Total: O(n log n) con n típicamente < 100
```

### Tiempo Real

```
Típico:     < 100ms
Con muchos tags (1000+): < 500ms
```

## Seguridad

### Garantías

✅ **Versión Única**: Cada build tiene versión única garantizada  
✅ **Inmutable**: Una vez creado el tag, la versión no cambia  
✅ **Reproducible**: Mismo commit = misma versión siempre  
✅ **Auditrable**: Cada versión vinculada a commit específico  

### Riesgos Mitigados

| Riesgo | Mitigación |
|--------|-----------|
| Versión duplicada | Detección de colisiones iterativa |
| Versión saltada | Análisis de commits para bump correcto |
| Versión fija | Script genera nueva versión cada build |
| Sin rastreo | BUILD_TIMESTAMP + COMMIT_HASH vinculan versión a cambio |

## Troubleshooting para Developers

### "La versión sigue siendo 0.0.1"

**Causa**: Script no se ejecuta o git no está inicializado

**Solución**:
```bash
git status  # Verificar que es un repo git
npm run generate-version  # Ejecutar script manualmente
cat src/config/version.ts  # Verificar que se generó
```

### "Versión no incrementa aunque cambié el código"

**Causa**: Commits no siguen conventional format

**Solución**:
```bash
git log --oneline -5
# Debe mostrar "feat:", "fix:", etc.

# Revisar: ¿comienza con "feat:", "fix:", etc?
# Si no: ver próximo build con commit correcto
```

### "Colisión de versión detectada manualmente"

**No es problema**: El sistema la maneja automáticamente

```bash
# Si v0.4.1 existe accidentalmente y el sistema calcula v0.4.1
# El siguiente build usará v0.4.2, v0.4.3, etc hasta encontrar única
```

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/)
- [SemVer in JavaScript](https://github.com/npm/node-semver)
- [Release Please](https://github.com/googleapis/release-please)
