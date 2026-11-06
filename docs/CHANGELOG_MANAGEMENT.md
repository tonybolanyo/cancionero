# Changelog Management

Este documento describe cómo el proyecto gestiona automáticamente el changelog a partir de los commits convencionales.

## Visión General

El proyecto utiliza **conventional commits** para generar automáticamente un changelog bien estructurado. El changelog se actualiza en cada release (lanzamiento de versión) como parte del pipeline de CI/CD.

## Tipos de Commits

El generador de changelog reconoce los siguientes tipos de commits:

### 🎉 Características (`feat`)
```
feat(scope): descripción de la nueva característica
```
Se incluyen en la sección "Features" del changelog.

### 🐛 Correcciones (`fix`)
```
fix(scope): descripción de la corrección
```
Se incluyen en la sección "Bug Fixes" del changelog.

### ⚠️ Cambios Incompatibles (`BREAKING CHANGE`)
```
feat(scope): descripción

BREAKING CHANGE: descripción detallada del cambio
```
O usando el prefijo `!`:
```
feat!: descripción del cambio incompatible
```

### Otros Tipos

- **refactor**: Cambios de código que no afectan funcionalidad
- **perf**: Mejoras de rendimiento
- **docs**: Cambios solo de documentación
- **style**: Cambios de formato (sin alterar lógica)
- **test**: Adición o modificación de tests
- **chore**: Cambios de configuración, dependencias, etc.

## Flujo Automático

### 1. Durante el Desarrollo

Realiza commits usando el formato convencional:

```bash
# Características
git commit -m "feat(UI): agregar nuevo componente de usuario"

# Correcciones
git commit -m "fix(parser): corregir error en análisis de métricas"

# Cambios incompatibles
git commit -m "feat!: cambiar API de exportación"
```

### 2. En el Pipeline de Release

Cuando haces push a `main` o `master`:

1. **Análisis de Commits**: El workflow detecta si hay cambios (feat, fix, breaking changes)
2. **Cálculo de Versión**: Determina la nueva versión según semantic versioning
3. **Generación de Changelog**: El script `generate-changelog.js` analiza todos los commits desde la última versión y genera las entradas
4. **Actualización de CHANGELOG.md**: Se agrega la nueva versión al archivo histórico
5. **Creación de Git Tag y Release**: Se crea el tag y la release de GitHub con el changelog formateado

### 3. Generación Manual

También puedes generar el changelog manualmente en cualquier momento:

```bash
# Generar changelog para una versión específica
npm run generate-changelog 1.2.3

# El script lee todos los commits desde la última versión
# y actualiza CHANGELOG.md automáticamente
```

## Estructura del CHANGELOG.md

El archivo CHANGELOG.md mantiene la siguiente estructura:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.3] - 2026-11-15

### ⚠️ Breaking Changes
- Cambio incompatible 1
- Cambio incompatible 2

### 🎉 Features
- Nueva característica 1
- Nueva característica 2

### 🐛 Bug Fixes
- Corrección 1
- Corrección 2

### ⚡ Performance Improvements
- Mejora de rendimiento 1

### ♻️ Code Refactoring
- Refactoring 1

### 📚 Documentation
- Actualización de documentación 1

### 🎨 Styling
- Cambio de estilo 1

### ✅ Tests
- Nuevo test 1

---

## [1.2.2] - 2026-11-14
...
```

### Características del Changelog

- ✅ **Ordenado cronológicamente** (versiones más nuevas primero)
- ✅ **Emojis descriptivos** para identificar rápidamente el tipo de cambio
- ✅ **Enlaces a commits** para ver el código exacto
- ✅ **Información del autor** en cada entrada
- ✅ **Agrupado por tipo** para fácil navegación

## Generador de Changelog (Script Interno)

### Archivo: `scripts/generate-changelog.js`

Este script realiza:

1. **Obtiene commits** desde la última versión taggeada
2. **Parsea commits** según convenciones
3. **Agrupa cambios** por tipo
4. **Formatea changelog** con emojis y enlaces
5. **Actualiza CHANGELOG.md** con la nueva versión
6. **Genera output** para GitHub Release

### Funciones Exportadas

```javascript
// Analizar commits y generar changelog
generateChangelog(version)

// Parsear commits en estructuras
parseCommits(commitLog)

// Formatear para archivo de changelog
formatCommitsForChangelog(commits)

// Formatear para GitHub Release
generateReleaseChangelog(commits)
```

## Integración con GitHub Release

El changelog generado se utiliza automáticamente en la descripción de GitHub Release con:

- Resumen de cambios principales
- Máximo de 5 cambios por tipo (evita releases muy largas)
- Indicador de cambios adicionales si los hay

## Mejores Prácticas

### ✅ DO

- Usar tipos de commits correctamente (`feat`, `fix`, `refactor`, etc.)
- Escribir mensajes de commit descriptivos
- Incluir el scope cuando sea relevante: `feat(auth):`
- Documentar breaking changes explícitamente
- Hacer commits pequeños y enfocados

### ❌ DON'T

- Mezclar múltiples tipos de cambios en un commit
- Escribir mensajes genéricos como "update code"
- Olvidar el scope en commits importantes
- No documentar cambios incompatibles
- Hacer commits enormes con cambios no relacionados

## Ejemplos de Commits Correctos

```bash
# Feature con scope
git commit -m "feat(lyrics): agregar sincronización automática de letras"

# Fix con descripción
git commit -m "fix(parser): corregir análisis de tonalidad en acordes sostenidos"

# Breaking change
git commit -m "feat(api)!: cambiar estructura de respuesta JSON

BREAKING CHANGE: El campo 'data' ahora es un objeto en lugar de array"

# Performance
git commit -m "perf(renderer): optimizar renderizado de lista de canciones"

# Refactoring
git commit -m "refactor(auth): extraer lógica de validación a módulo separado"

# Documentation
git commit -m "docs: agregar guía de integración con Spotify"

# Test
git commit -m "test(meter): agregar tests para detección de métricas"
```

## Archivos Relacionados

- **`.github/workflows/release.yml`**: Pipeline que automatiza el changelog
- **`scripts/generate-changelog.js`**: Generador del changelog
- **`CHANGELOG.md`**: Archivo histórico de cambios (auto-actualizado)
- **`VERSIONING.md`**: Guía de versionamiento semántico

## Preguntas Frecuentes

**P: ¿Qué pasa si cometo un error en el mensaje de commit?**
R: Puedes enmendar el commit con `git commit --amend` antes de hacer push, o crear un nuevo commit que corrija el error.

**P: ¿El changelog se genera automáticamente en cada push?**
R: Solo cuando hay cambios que resulten en un bump de versión (feat, fix, o breaking changes). Los commits de tipo `chore` o `docs` pueden no generar una release según la configuración.

**P: ¿Puedo editar manualmente el CHANGELOG.md?**
R: Sí, pero los cambios serán reemplazados por el siguiente release automático. Es mejor confiar en el sistema automatizado.

**P: ¿Cómo se calcula la versión?**
R: Según semantic versioning: BREAKING CHANGE = MAJOR, feat = MINOR, fix = PATCH.

**P: ¿Puedo ver el changelog antes de hacer release?**
R: Sí, ejecuta `npm run generate-changelog 1.2.3` para ver qué se incluiría en esa versión.

## Soporte y Troubleshooting

Si el changelog no se genera correctamente:

1. Verifica que los commits sigan el formato convencional
2. Asegúrate de que el último push incluya cambios válidos (feat, fix, etc.)
3. Revisa los logs del workflow en GitHub Actions
4. Ejecuta manualmente `node scripts/generate-changelog.js <version>` para debug

Para más información sobre conventional commits, consulta: https://www.conventionalcommits.org/
