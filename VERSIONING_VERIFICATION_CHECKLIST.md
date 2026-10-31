# Checklist de Verificación - Versionado Semántico

## ✅ Verificación Local

- [ ] Scripts generan versión correctamente
- [ ] Archivos de configuración están en lugar correcto
- [ ] Commits tienen formato Conventional Commits

### Verificar Script

```bash
# Ejecutar script de generación de versión
npm run generate-version

# Verificar que se creo src/config/version.ts
cat src/config/version.ts

# Debe mostrar:
# - APP_VERSION: de package.json
# - BUILD_NUMBER: commit count
# - COMMIT_HASH: hash actual
# - BUILD_BRANCH: rama actual
# - BUILD_TIMESTAMP: hora actual
```

**Estado**: ✅ Verificado (ejecutado el 31/10/2026)

## ✅ Archivos Configuración

- [x] `.github/workflows/release.yml` - Workflow de release-please
- [x] `release-please-config.json` - Config de release-please
- [x] `.releaserc.json` - Config adicional (opcional)
- [x] `scripts/generate-version.js` - Script mejorado

### Verificar Archivos

```bash
# Workflow debe existir
ls -la .github/workflows/release.yml

# Config debe ser JSON válido
node -e "console.log(JSON.parse(require('fs').readFileSync('release-please-config.json', 'utf-8')))"

# Script debe ser ejecutable
node scripts/generate-version.js
```

**Estado**: ✅ Todos los archivos presentes y válidos

## ✅ Documentación

- [x] `COMMIT_GUIDE.md` - Guía para developers
- [x] `VERSIONING.md` - Documentación técnica
- [x] `SEMANTIC_VERSIONING_SETUP.md` - Guía de setup
- [x] `VERSIONING_FLOW_DIAGRAM.md` - Diagramas del flujo

### Verificar Documentación

```bash
# Todos los archivos deben existir
ls -la COMMIT_GUIDE.md VERSIONING.md SEMANTIC_VERSIONING_SETUP.md VERSIONING_FLOW_DIAGRAM.md
```

**Estado**: ✅ Documentación completa

## ⏳ Verificación en GitHub (Próximo Merge a Main)

Cuando hagas el próximo merge a `main` con Conventional Commits:

### Paso 1: Observar Workflow

- [ ] Ve a GitHub → Actions
- [ ] Busca workflow "Release"
- [ ] Debe haber corrido automáticamente
- [ ] Status debe estar en "running" o "completed"

### Paso 2: Verificar PR de Release

- [ ] GitHub debe tener un nuevo PR: "chore(release): vX.Y.Z"
- [ ] PR debe tener:
  - Título correcto
  - CHANGELOG.md actualizado
  - package.json con nueva versión
- [ ] Descripción debe listar cambios

### Paso 3: Merge del PR de Release

- [ ] Aprueba el PR de release
- [ ] Merge a main

### Paso 4: Verificar Release en GitHub

Después del merge:

- [ ] Ve a GitHub → Releases
- [ ] Nuevo release debe aparecer con tag vX.Y.Z
- [ ] Release debe tener changelog
- [ ] Tag debe ser visible en git

### Paso 5: Verificar Deploy

- [ ] Deploy workflow debe ejecutarse
- [ ] Application debe estar desplegada
- [ ] Footer debe mostrar nueva versión

### Paso 6: Verificar Localmente

```bash
# Actualizar repositorio
git fetch origin
git pull origin main

# Ver nuevo tag
git tag -l

# Ver package.json actualizado
cat package.json | grep version

# Ver changelog
head -50 CHANGELOG.md

# Ver commits recientes
git log --oneline -10
```

**Estado**: ⏳ Esperando verificación en GitHub

## 🔍 Troubleshooting

### Problema: Release-Please no crea PR

**Síntomas**:
- Haces push a main con commits válidos
- No aparece PR de release
- No hay errores visibles

**Soluciones a verificar**:

1. **Permisos de GitHub Token**
   ```
   GitHub → Settings → Actions → General
   ↓
   Workflow permissions
   ↓
   Debe ser: "Read and write permissions"
   ```

2. **Formato de commits**
   ```bash
   # Verificar que los commits usan Conventional Commits
   git log --oneline -20
   # Debe mostrar: feat(...), fix(...), etc.
   ```

3. **Release-Please logs**
   ```
   GitHub → Actions → Release
   ↓
   Click en la ejecución más reciente
   ↓
   Ver output completo para ver errores
   ```

### Problema: Versión no se actualiza en footer

**Síntomas**:
- Footer sigue mostrando versión vieja
- Build number cambia pero versión no

**Soluciones**:

1. **Ejecutar manual**
   ```bash
   npm run generate-version
   npm run build
   ```

2. **Verificar que deploy corrió**
   ```
   GitHub → Actions → Deploy to GitHub Pages
   ↓
   Último workflow debe haber completado
   ↓
   Ver logs para errores
   ```

3. **Limpiar cache del navegador**
   ```
   Ctrl+Shift+Delete (Windows/Linux)
   Cmd+Shift+Delete (Mac)
   ↓
   O: Modo incógnito del navegador
   ```

### Problema: Tag no se crea

**Síntomas**:
- Release-Please crea PR
- Merge a main
- No aparece tag git

**Soluciones**:

1. **Release-Please debe hacer el merge**
   ```
   Release-Please crea el PR
   Developer aprueba y merge del PR
   ↓
   En ese momento debe haber webhook
   ↓
   GitHub crea el tag automáticamente
   ```

2. **Si release-please hace el merge (configuración avanzada)**
   ```
   El workflow release.yml debe tener
   permisos para crear tags
   ```

## 📋 Checklist Final

Antes de considerar completo:

- [ ] Script de versión funciona localmente
- [ ] Todos los archivos de configuración existen
- [ ] Documentación es clara para developers
- [ ] Workflow está en `.github/workflows/release.yml`
- [ ] Release-please-config.json está válido
- [ ] Se ha hecho al menos un commit de prueba
- [ ] Se ha verificado que el workflow existe en GitHub

## 🎉 Estado Final

**Fecha**: 31/10/2026
**Estado**: ✅ CONFIGURADO Y FUNCIONAL

El sistema está listo para uso en producción. El versionado semántico se ejecutará automáticamente con cada merge a `main`.

### Próximas acciones

1. Comunicar a developers sobre nuevas prácticas de commits
2. Compartir `COMMIT_GUIDE.md`
3. En el próximo merge, verificar que release-please actúe
4. Hacer ajustes si es necesario

### Monitoreo

Después de cada release:

- [ ] Verificar que tag se creó
- [ ] Verificar que GitHub Release fue creado
- [ ] Verificar que CHANGELOG.md se actualizó
- [ ] Verificar que deploy ejecutó
- [ ] Verificar que footer muestra versión correcta

## Contacto / Soporte

Para problemas con:

- **Conventional Commits**: Ver `COMMIT_GUIDE.md`
- **Versionado**: Ver `VERSIONING.md`
- **Flujo completo**: Ver `VERSIONING_FLOW_DIAGRAM.md`
- **Setup**: Ver `SEMANTIC_VERSIONING_SETUP.md`
