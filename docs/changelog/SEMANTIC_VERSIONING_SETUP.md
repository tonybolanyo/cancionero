# Configuración de Versionado Semántico - Setup Completado ✅

## Qué se implementó

Se ha automatizado completamente el **versionado semántico** del proyecto usando **release-please**. El sistema ahora:

### ✅ Características

- **Versionado Automático**: Analiza commits según Conventional Commits
- **Cálculo de Versión**: MAJOR.MINOR.PATCH se calcula automáticamente
- **Tags Automáticos**: Crea git tags sin intervención manual
- **Changelog Automático**: Genera CHANGELOG.md en cada release
- **Releases en GitHub**: Crea official releases con descripción
- **Sin Intervención Manual**: Todo ocurre automáticamente en GitHub Actions

### 📝 Archivos Creados/Modificados

```
.github/workflows/release.yml          ← Workflow de release-please
release-please-config.json             ← Config de release-please
COMMIT_GUIDE.md                        ← Guía para developers
VERSIONING.md                          ← Documentación actualizada
scripts/generate-version.js            ← Script mejorado
.releaserc.json                        ← Config adicional
```

## Cómo Usar

### Para Developers (día a día)

**Solo necesitas hacer commits con Conventional Commits:**

```bash
# Feature = MINOR version bump
git commit -m "feat: agregar búsqueda de canciones"

# Fix = PATCH version bump
git commit -m "fix: corregir cálculo de tonalidad"

# Breaking change = MAJOR version bump
git commit -m "feat!: cambiar formato de API"
```

Ver más: [COMMIT_GUIDE.md](./COMMIT_GUIDE.md)

### Flujo Automático

1. Developer hace commit con Conventional Commits
2. Developer hace push a `main` o crea PR
3. Cuando se merge a `main`:
   - GitHub Actions ejecuta release-please
   - Release-Please analiza nuevos commits
   - Release-Please detecta versión (MAJOR/MINOR/PATCH)
   - Release-Please crea PR de release
   - Developer/reviewer aprueba el PR
   - Release-Please crea git tag automáticamente
   - Release-Please crea GitHub Release
   - Deploy workflow se ejecuta y despliega

### Ejemplo Paso a Paso

```bash
# 1. Trabajar en feature
git checkout -b feat/new-feature
git commit -m "feat: agregar análisis de acordes"
git push origin feat/new-feature

# 2. Crear PR y merge a main (en GitHub)
# Merges a main...

# 3. Release-Please actúa automáticamente (GitHub Actions)
# - Crea PR de release: "chore(release): v1.2.0"
# - Actualiza CHANGELOG.md
# - Actualiza package.json

# 4. Merge del PR de release
# - Automáticamente crea tag v1.2.0
# - Crea GitHub Release
# - Deploy workflow se ejecuta
```

## Próximos Pasos Recomendados

### 1. ✅ Verificar que el workflow funcione

En la próxima vez que hagas merge a `main` con Conventional Commits:
- Ve a GitHub → Actions
- Verás un workflow "Release" ejecutándose
- Crea PR de release automáticamente

### 2. Crear tag inicial (Opcional)

Si quieres establecer una versión inicial explícita:

```bash
git tag v0.1.0
git push origin v0.1.0
```

O dejar que release-please lo haga en el primer release.

### 3. Comunicar a tu equipo

Comparte:
- [COMMIT_GUIDE.md](./COMMIT_GUIDE.md) - Guía de commits
- [VERSIONING.md](./VERSIONING.md) - Documentación técnica
- Este archivo

### 4. Integración con Deploy

El workflow `deploy-pages.yml` ya está configurado para:
- Generar versión semántica
- Mostrar versión en el footer
- Mostrar build number (commit count)

## Referencia Rápida

### Tipos de Commits que Generan Versión

| Commit | Resultado | Ejemplo |
|--------|-----------|---------|
| `feat:` | MINOR ↑ | `feat: agregar búsqueda` |
| `fix:` | PATCH ↑ | `fix: corregir bug` |
| `feat!:` | MAJOR ↑ | `feat!: cambiar API` |
| `docs:` | - | `docs: actualizar README` |
| `refactor:` | - | `refactor: organizar código` |

### Versión en Aplicación

Se muestra en el footer:
```
v1.2.3 (build: 1042) [main]
```

- `1.2.3` = Versión semántica (de release-please)
- `1042` = Build number (commit count)

## Archivos Configuración

### release-please-config.json
Configuración principal de release-please:
- Release type: `node` (npm)
- Archivo de versión: `package.json`
- Changelog: `CHANGELOG.md`

### .github/workflows/release.yml
GitHub Actions workflow que:
- Ejecuta release-please
- Crea PR de release
- Genera changelog
- Crea tags

## Solución de Problemas

### Release-Please no crea PR

**Posibles causas**:
1. Permiso de token insuficiente (GitHub Actions tiene permisos limitados por defecto)
2. Commits no tienen formato Conventional Commits
3. Configuración incorrecta

**Solución**:
1. Ve a Settings → Actions → General
2. Verifica que "Workflow permissions" esté en "Read and write permissions"
3. Verifica que los commits usen formato correcto

### Versión no se actualiza en footer

**Solución**:
- Ejecuta manualmente: `npm run generate-version`
- Verifica que `src/config/version.ts` se haya actualizado

### Quiero deshacer un release

Release-Please crea un PR primero. Si no quieres continuar:
1. Cierra el PR
2. No lo mergees
3. Release-Please crea uno nuevo en el siguiente commit

## Recursos

- [COMMIT_GUIDE.md](./COMMIT_GUIDE.md) - Cómo hacer commits
- [VERSIONING.md](./VERSIONING.md) - Documentación técnica
- [release-please](https://github.com/googleapis/release-please)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## Estado Actual

✅ Workflow de release configurado
✅ Configuración de release-please
✅ Script de generación de versión mejorado
✅ Documentación de developers
✅ Integración con deploy workflow

**Estado**: Listo para usar. El siguiente commit que use Conventional Commits disparará el workflow automáticamente.
