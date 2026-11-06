# Quick Reference: Commits & Changelog

Guía rápida para escribir commits que generen automáticamente un changelog bien estructurado.

## Tipos de Commits

| Tipo | Prefix | Ejemplo | Efecto |
|------|--------|---------|--------|
| 🎉 Característica | `feat:` | `feat(auth): agregar login` | MINOR version |
| 🐛 Corrección | `fix:` | `fix(parser): corregir error` | PATCH version |
| ⚠️ Cambio incompatible | `feat!:` o `BREAKING CHANGE:` | `feat!: cambiar API` | MAJOR version |
| ⚡ Performance | `perf:` | `perf(render): optimizar` | No genera release |
| ♻️ Refactoring | `refactor:` | `refactor(auth): limpiar código` | No genera release |
| 📚 Documentación | `docs:` | `docs: agregar guía` | No genera release |
| 🎨 Estilo | `style:` | `style: ajustar indentación` | No genera release |
| ✅ Tests | `test:` | `test(parser): agregar test` | No genera release |
| 🔧 Configuración | `chore:` | `chore(deps): actualizar` | No genera release |

## Ejemplos de Commits

### ✅ Bien

```bash
# Característica con scope
git commit -m "feat(lyrics): agregar sincronización automática"

# Corrección con scope
git commit -m "fix(parser): corregir análisis de acordes sostenidos"

# Breaking change explícito
git commit -m "feat(api)!: cambiar estructura de respuesta

BREAKING CHANGE: El campo 'data' ahora es objeto en lugar de array"

# Performance
git commit -m "perf(renderer): optimizar lista de canciones con virtualización"

# Refactoring
git commit -m "refactor(auth): extraer validación a módulo separado"

# Documentation
git commit -m "docs: agregar guía de integración con Spotify"
```

### ❌ Mal

```bash
# Sin tipo
git commit -m "actualizar código"

# Tipo incorrecto
git commit -m "updated auth module"

# Muy genérico
git commit -m "feat: cambios"

# Sin scope importante
git commit -m "fix: error"

# Múltiples cambios
git commit -m "feat: agregar login Y refactor: limpiar código"
```

## Estructura Recomendada

```
type(scope): descripción concisa en imperativo

Descripción detallada si es necesario.
Puede ser multi-línea.

Resolves #123
Co-authored-by: Name <email>
```

Ejemplo completo:
```
feat(auth): agregar autenticación con Google

- Implementar flujo OAuth 2.0
- Agregar botón de login a la UI
- Crear integración con Firebase Auth

Resolves #45
```

## Scripts Útiles

```bash
# Generar changelog manualmente para una versión
npm run generate-changelog 1.2.3

# Esto actualiza CHANGELOG.md y muestra el resultado para GitHub Release
```

## Workflow Automático

1. **Push a main/master** → Workflow detecta commits
2. **Calcula versión** → Análisis de feat/fix/breaking
3. **Genera changelog** → Script parsea commits
4. **Actualiza CHANGELOG.md** → Agrega nueva versión
5. **Crea tag y release** → Push automático a GitHub

## Versionamiento

- `BREAKING CHANGE` → X.0.0 (MAJOR)
- `feat:` → x.X.0 (MINOR)  
- `fix:` → x.x.X (PATCH)
- `chore:`, `docs:`, etc. → Sin release automática

## Convenciones del Proyecto

- Commits en **imperativo**: "agregar", "corregir", "actualizar"
- Minúsculas en descripción
- Scope siempre entre paréntesis: `feat(scope):`
- Máximo 72 caracteres en primera línea
- Commits pequeños y enfocados

## Para Más Información

- Convencional Commits: https://www.conventionalcommits.org/
- Keep a Changelog: https://keepachangelog.com/
- Semantic Versioning: https://semver.org/
- Proyecto Docs: `/docs/CHANGELOG_MANAGEMENT.md`
