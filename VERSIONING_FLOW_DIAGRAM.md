# Diagrama del Flujo de Versionado Automático

## 1. Flujo Básico

```
┌─────────────────────────────────────────────────────────────┐
│ Developer                                                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 1. Escribir código                                   │   │
│ │ 2. git commit -m "feat: agregar función X"           │   │
│ │ 3. git push origin rama                              │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub (Pull Request)                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 1. Crear Pull Request                                │   │
│ │ 2. Reviewer aprueba                                  │   │
│ │ 3. Merge a main/master                               │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Dispara: push a main
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions: Release Workflow                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Release-Please actúa:                                │   │
│ │ 1. Analiza commits desde último tag                  │   │
│ │ 2. Identifica tipos: feat, fix, breaking change      │   │
│ │ 3. Calcula nueva versión (MAJOR.MINOR.PATCH)         │   │
│ │ 4. Crea PR: "chore(release): v1.2.0"                │   │
│ │ 5. Actualiza CHANGELOG.md                            │   │
│ │ 6. Actualiza package.json                            │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub (Pull Request de Release)                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ PR Automático de Release-Please                       │   │
│ │ ┌────────────────────────────────────────────────┐   │   │
│ │ │ Título: chore(release): v1.2.0                 │   │   │
│ │ │ Body: Changelog automático generado             │   │   │
│ │ │ Cambios:                                         │   │   │
│ │ │  - package.json: 1.1.0 → 1.2.0                 │   │   │
│ │ │  - CHANGELOG.md: Nuevas entradas               │   │   │
│ │ └────────────────────────────────────────────────┘   │   │
│ │ Developer/Reviewer: Aprueba y Merge                  │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Dispara: push de PR de release
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions: Release-Please Finalization                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Cuando se merge el PR de release:                    │   │
│ │ 1. Crea git tag: v1.2.0                              │   │
│ │ 2. Crea GitHub Release con changelog                │   │
│ │ 3. Dispara workflows posteriores                     │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Dispara: push de tag
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions: Deploy Workflow                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 1. Checkout con historial completo                   │   │
│ │ 2. npm run generate-version                          │   │
│ │    ├─ Lee package.json (1.2.0)                       │   │
│ │    ├─ Cuenta commits (ej: 1042)                      │   │
│ │    └─ Genera src/config/version.ts                  │   │
│ │ 3. npm run build                                     │   │
│ │ 4. Deploy a GitHub Pages                            │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Resultado Final                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ✅ Tag git: v1.2.0                                   │   │
│ │ ✅ GitHub Release: v1.2.0 (con changelog)           │   │
│ │ ✅ package.json: 1.2.0                               │   │
│ │ ✅ CHANGELOG.md: Actualizado                         │   │
│ │ ✅ Aplicación desplegada en GitHub Pages             │   │
│ │ ✅ Footer muestra: v1.2.0 (build: 1042)            │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. Tipos de Commits y Versión

```
COMMITS EN UNA SEMANA:
├─ fix: corregir bug A
├─ fix: corregir bug B
├─ feat: agregar búsqueda
├─ feat: agregar filtros
└─ docs: actualizar README

ANÁLISIS:
├─ feat (2×) → MINOR
├─ fix  (2×) → PATCH  (menor que MINOR)
└─ docs (1×) → Ignorado

RESULTADO: MINOR version bump
┌────────────────┐
│ Versión: 0.1.0 │ ← MINOR sube (la más alta)
│ Build:   1050  │
└────────────────┘
```

## 3. Cambio BREAKING CHANGE

```
COMMITS:
├─ feat!: cambiar formato de API
├─ fix: corregir validación
└─ feat: agregar endpoint nuevo

ANÁLISIS:
├─ BREAKING CHANGE → MAJOR
├─ feat → MINOR (ignorado, MAJOR es más grande)
└─ fix → PATCH (ignorado)

RESULTADO: MAJOR version bump
┌─────────────────────────────┐
│ Versión: 0.1.0 → 1.0.0      │ ← MAJOR
│ Build:           1052       │
└─────────────────────────────┘
```

## 4. Sin Cambios de Funcionalidad

```
COMMITS:
├─ docs: mejorar documentación
├─ refactor: reorganizar componentes
└─ ci: actualizar GitHub Actions

ANÁLISIS:
├─ docs → Ignorado
├─ refactor → Ignorado
└─ ci → Ignorado

RESULTADO: Sin cambio de versión
┌─────────────────────────────┐
│ Versión: 1.2.3 (sin cambio) │
│ Build:   1053               │
└─────────────────────────────┘
```

## 5. Información Disponible en Aplicación

```
┌──────────────────────────────────────┐
│ Footer de Aplicación                 │
│ ┌────────────────────────────────────┤
│ │ Cancionero v1.2.3 (build: 1042)   │
│ │ [main]                             │
│ │ © 2024 Cancionero                  │
│ └────────────────────────────────────┤
│                                      │
│ Donde:                               │
│ • 1.2.3 = Versión semántica          │
│           (de release-please)        │
│ • 1042 = Build number                │
│          (commit count)              │
│ • [main] = Branch actual             │
└──────────────────────────────────────┘
```

## 6. Timeline Completo Ejemplo

```
Día 1:
├─ 09:00 Developer: git commit -m "feat: agregar búsqueda"
├─ 09:05 Developer: git push origin main
├─ 09:06 GitHub Actions: Release-Please analiza (versión 1.1.0)
├─ 09:07 GitHub: PR de release creado automáticamente
└─ 09:10 Developer: Aprueba y merge del PR

Día 1 (continuación):
├─ 09:11 GitHub Actions: Crea tag v1.1.0
├─ 09:12 GitHub: Release v1.1.0 creado
├─ 09:13 GitHub Actions: Deploy workflow inicia
├─ 09:14 Deploy: Genera versión (1.1.0)
├─ 09:15 Deploy: Build y subida a GitHub Pages
└─ 09:16 ✅ Aplicación en vivo v1.1.0 (build: N)

Usuario ve en footer:
  v1.1.0 (build: N)
```

## 7. Flujo de Trabajo Diario (Checklist)

```
PARA DEVELOPERS:

1. ✅ Escribir código como de costumbre
2. ✅ Hacer commits con Conventional Commits:
   • feat: nueva funcionalidad
   • fix: corrección de bug
   • feat!: breaking change
3. ✅ Push a rama y crear PR
4. ✅ Merge a main (o el bot hace merge automático)

---

PARA DEVOPS/RELEASE MANAGER:

Release-Please maneja TODO automáticamente:
1. ✅ Analizar commits
2. ✅ Calcular versión
3. ✅ Crear PR de release
4. ✅ Crear tags
5. ✅ Crear releases en GitHub
6. ✅ Generar changelog

---

PARA USUARIOS:

Simplemente ven:
  v1.2.3 (build: 1042)
```

## 8. Recuperación de Errores

```
Error: Commit sin Conventional Commits
└─ Solución: Release-Please crea PR igual
             Developer puede editar changelog
             o cerrar PR y hacer commit correcto

Error: Breaking change olvidado
└─ Solución: Release-Please crea PR primero
             Developer revisa, ve el changelog
             Puede editar antes de merge

Error: Rollback de version
└─ Solución: 1. Cierra PR de release (sin merge)
             2. Siguiente commit dispara nuevo PR
             3. Developer tiene oportunidad de corregir
```

## Recursos Visuales

- [Conventional Commits](https://www.conventionalcommits.org/)
- [release-please Workflow](https://github.com/googleapis/release-please)
- [Semantic Versioning](https://semver.org/)
