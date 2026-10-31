# Versionado Semántico Automático

## Descripción General

El proyecto implementa un sistema de **versionado semántico completamente automático** usando **release-please** que se dispara en cada push a `main`. Este sistema:

- ✅ Analiza commits usando **Conventional Commits**
- ✅ Calcula automáticamente la versión MAJOR.MINOR.PATCH
- ✅ Crea tags semánticos en git automáticamente
- ✅ Genera changelog automáticamente
- ✅ Crea releases en GitHub
- ✅ No requiere intervención manual

## Flujo de Trabajo

### 1. Developer escribe commits con Conventional Commits

```bash
# Feature
git commit -m "feat: agregar soporte para acordes de 7ma"

# Bugfix
git commit -m "fix: corregir cálculo de tonalidad"

# Breaking change (MAJOR bump)
git commit -m "feat!: cambiar formato de API"
git commit -m "feat: nuevo sistema\nBREAKING CHANGE: API cambió"
```

### 2. Push a main/master

```bash
git push origin main
```

### 3. Release-Please en GitHub Actions

- 🔍 Analiza nuevos commits
- 📊 Determina versión (MAJOR.MINOR.PATCH)
- 📝 Crea Pull Request de release con:
  - `package.json` actualizado
  - `CHANGELOG.md` generado
  - Descripción del release
- 🏷️ Crea git tag automáticamente
- 🎉 Crea GitHub Release

### 4. Deploy a GitHub Pages

- El workflow `deploy-pages.yml` se ejecuta
- Genera versión con build number
- Despliega aplicación

## Convenciones de Commits

### Tipos de commits (Conventional Commits)

| Tipo | Semver | Ejemplo |
|------|--------|---------|
| `feat` | MINOR | `feat: agregar búsqueda de canciones` |
| `fix` | PATCH | `fix: corregir bug en cálculo de ritmo` |
| `BREAKING CHANGE` | MAJOR | `feat!: cambiar API de respuesta` |
| `docs` | No version | `docs: actualizar README` |
| `refactor` | No version | `refactor: reorganizar componentes` |
| `perf` | PATCH | `perf: optimizar búsqueda` |
| `test` | No version | `test: agregar tests para tonalidad` |
| `ci` | No version | `ci: actualizar workflows` |
| `chore` | No version | `chore: actualizar dependencias` |

### Ejemplos completos

```bash
# Bump MINOR version
git commit -m "feat: agregar análisis de acordes

- Detecta todos los acordes en una canción
- Sugiere acordes alternos"

# Bump PATCH version
git commit -m "fix: corregir pitch detection

Fixes #123"

# Bump MAJOR version
git commit -m "feat: reescribir API de análisis

BREAKING CHANGE: El endpoint /api/analyze cambia de POST a GET"
```

## Automático = Sin Etiquetas Manuales

**NO hagas esto manualmente:**
- ❌ `git tag v1.2.3`
- ❌ Editar `package.json` manualmente para cambiar versión
- ❌ Crear releases manualmente en GitHub

**Release-Please lo hace automáticamente.**

## Archivo de Configuración

**Ubicación**: `release-please-config.json`

```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "version-file": "package.json",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

## Componentes del Sistema

### 1. Workflow Release (`.github/workflows/release.yml`)

Se ejecuta en cada push a main:

```yaml
- googleapis/release-please-action: Analiza commits
- Crea PR de release
- Genera changelog
- Crea git tag
- Crea GitHub Release
```

### 2. Script de Versión (`scripts/generate-version.js`)

Se ejecuta antes del build:

```bash
npm run generate-version
```

Genera `src/config/version.ts` con:
- Versión semántica (de `package.json`)
- Build number (commit count)
- Commit hash
- Branch name
- Timestamp

### 3. Información en la Aplicación

Se muestra en el Footer:

```
Cancionero v1.2.3 (build: 1042) [main]
```

## Ejemplo de Ciclo Completo

### Paso 1: Developer escribe código

```bash
cd cancionero
git checkout -b feature/new-feature
# ... cambios de código ...
git commit -m "feat: agregar nueva funcionalidad"
git push origin feature/new-feature
```

### Paso 2: Merge a main (PR)

```bash
# En GitHub: Merge PR to main
# o en CLI:
git checkout main
git merge feature/new-feature
git push origin main
```

### Paso 3: Release-Please actúa automáticamente

GitHub Actions ejecuta:

```
push to main
  ↓
Release-Please workflow
  ├─ Analiza commits desde último tag
  ├─ Detecta: 1 feature = MINOR bump
  ├─ Calcula: 0.1.0 → 0.2.0
  ├─ Crea PR: "chore(release): v0.2.0"
  └─ Cuando se merge: Crea tag v0.2.0
      ↓
Deploy-Pages workflow
  └─ Despliega v0.2.0
```

### Paso 4: Ver release

```bash
# Localmente
git pull
git tag  # Ver nuevo tag v0.2.0
git log  # Ver nuevo commit de release
cat CHANGELOG.md  # Ver changelog generado
```

En GitHub:
- ✅ Nuevo tag `v0.2.0`
- ✅ Nuevo Release con changelog
- ✅ `package.json` actualizado a 0.2.0

## Ventajas

✅ **Completamente Automático**: Sin intervención manual
✅ **Determinista**: Basado en análisis real de commits
✅ **Transparent**: Todos ven qué cambios generaron qué versión
✅ **No Errores Manuales**: No hay riesgo de etiquetas incorrectas
✅ **Changelog Automático**: Generado a partir de commits
✅ **Integración GitHub**: Crea releases officieles
✅ **Estándar Industrial**: Usado por Google, npm, etc.
✅ **Cero Configuración**: Una vez setup, funciona solo

## Flujos Adicionales

### Si quieres trigger manualmente

```bash
# En GitHub: Actions → Release → Run workflow
```

### Ver próxima versión que se creará

Release-Please crea un PR antes de hacer el release. En ese PR puedes:
- Ver qué versión se creará
- Ver changelog generado
- Editar changelog si es necesario
- Mergear para hacer el release oficial

### Recuperarse de un error

Si hay un error:

1. Release-Please crea un PR
2. No lo mergees, haces cambios
3. Cierras el PR
4. Release-Please crea uno nuevo en el siguiente push

## Recursos Relacionados

- [Conventional Commits](https://www.conventionalcommits.org/)
- [release-please GitHub](https://github.com/googleapis/release-please)
- [Semantic Versioning](https://semver.org/)
- [Release Please Action](https://github.com/googleapis/release-please-action)

