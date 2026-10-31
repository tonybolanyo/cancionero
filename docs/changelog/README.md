# 📝 Changelog & Automation

Versionado semántico, historial de cambios y automatización de releases.

## 📖 Contenidos

- **[VERSIONING.md](VERSIONING.md)** - Guía de versionado semántico
- **[SEMANTIC_VERSIONING_SETUP.md](SEMANTIC_VERSIONING_SETUP.md)** - Configuración del sistema
- **[VERSIONING_FLOW_DIAGRAM.md](VERSIONING_FLOW_DIAGRAM.md)** - Diagrama del flujo
- **[VERSIONING_VERIFICATION_CHECKLIST.md](VERSIONING_VERIFICATION_CHECKLIST.md)** - Checklist de verificación
- **[CHANGES.md](CHANGES.md)** - Historial de cambios del proyecto

## 🎯 Empieza por Aquí

### Entender Versionado
1. Lee [VERSIONING.md](VERSIONING.md) para conceptos
2. Revisa [SEMANTIC_VERSIONING_SETUP.md](SEMANTIC_VERSIONING_SETUP.md) para la configuración

### Antes de Hacer un Release
1. Consulta [VERSIONING_FLOW_DIAGRAM.md](VERSIONING_FLOW_DIAGRAM.md) para entender el flujo
2. Sigue [VERSIONING_VERIFICATION_CHECKLIST.md](VERSIONING_VERIFICATION_CHECKLIST.md)
3. Lee [../development/COMMIT_GUIDE.md](../development/COMMIT_GUIDE.md) para convenciones de commits

### Historial
- Revisa [CHANGES.md](CHANGES.md) para ver cambios previos

## 🤖 Automatización

El proyecto usa **Release Please** para automatizar:
- Generación de changelog automático
- Bump de versión según commits
- Creación de releases en GitHub
- Tags automáticos en Git

Configuración en `.releaserc.json` y `release-please-config.json`.

## 📋 Flujo Simplificado

```
1. Hacer commits con convención (feat:, fix:, docs:, etc.)
   ↓
2. Push a main/master
   ↓
3. Release Please crea PR con cambios sugeridos
   ↓
4. Mergear PR (automáticamente hace release)
   ↓
5. Nueva versión + tag + changelog
```

## 📞 Véase también

- [../development/COMMIT_GUIDE.md](../development/COMMIT_GUIDE.md) - Convenciones de commits
- [../deployment/](../deployment/) - Despliegue automático
