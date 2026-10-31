# Guía de Commits - Conventional Commits

Este proyecto usa **Conventional Commits** para automatizar el versionado semántico. Cada commit determina automáticamente si la versión sube en MAJOR, MINOR o PATCH.

## Formato Básico

```
<tipo>[scope]: <descripción>

[cuerpo opcional]

[pie de página opcional]
```

## Tipos de Commits

### 🚀 `feat` (Feature) - Sube MINOR

Cuando agregues una **nueva funcionalidad**:

```bash
git commit -m "feat: agregar análisis de acordes"
git commit -m "feat(ui): mejorar interfaz de búsqueda"
git commit -m "feat: soporte para acordes alterados"
```

### 🐛 `fix` (Fix) - Sube PATCH

Cuando corrijas un **bug**:

```bash
git commit -m "fix: corregir cálculo de tonalidad"
git commit -m "fix(pitch): mejorar detección de frecuencia"
git commit -m "fix: resolver crash al abrir canciones"
```

### ⚠️ `BREAKING CHANGE` - Sube MAJOR

Cuando hagas un **cambio que rompe compatibilidad**:

```bash
# Opción 1: Usar feat! o fix!
git commit -m "feat!: cambiar formato de API de respuesta"

# Opción 2: Agregar BREAKING CHANGE en el cuerpo
git commit -m "refactor: reescribir analizador de ritmo

BREAKING CHANGE: El formato del JSON cambió de array a objeto"
```

### Otros tipos (No generan versión)

- **`docs`**: Cambios en documentación
  ```bash
  git commit -m "docs: actualizar README con instrucciones"
  ```

- **`refactor`**: Reorganizar código sin cambiar funcionalidad
  ```bash
  git commit -m "refactor: extraer componente de búsqueda"
  ```

- **`perf`**: Mejoras de rendimiento
  ```bash
  git commit -m "perf: optimizar búsqueda de canciones"
  ```

- **`test`**: Cambios en tests
  ```bash
  git commit -m "test: agregar tests para tonalidad"
  ```

- **`ci`**: Cambios en workflows de CI/CD
  ```bash
  git commit -m "ci: agregar nuevo job de lint"
  ```

- **`chore`**: Mantenimiento general (deps, etc)
  ```bash
  git commit -m "chore: actualizar dependencias"
  ```

## Ejemplos Completos

### Ejemplo 1: Feature Simple

```bash
git commit -m "feat: agregar búsqueda por tonalidad"
```

**Resultado**: Versión sube MINOR (0.1.0 → 0.2.0)

### Ejemplo 2: Feature con Scope

```bash
git commit -m "feat(ui): agregar tema oscuro"
```

**Scope** es opcional (la parte entre corchetes). Ayuda a categorizar.

### Ejemplo 3: Fix con Descripción Larga

```bash
git commit -m "fix: corregir bug en cálculo de ritmo

- Ahora detecta correctamente ritmos compuestos
- Reduce falsos positivos en 50%
- Fixes #123"
```

**Resultado**: Versión sube PATCH (0.1.0 → 0.1.1)

### Ejemplo 4: Breaking Change

```bash
git commit -m "feat!: cambiar API de análisis

BREAKING CHANGE: El endpoint /analyze ahora devuelve 
un objeto en lugar de un array"
```

**Resultado**: Versión sube MAJOR (0.1.0 → 1.0.0)

## Reglas Importantes

✅ **Siempre usa minúsculas en el tipo**
```bash
# ✅ Correcto
git commit -m "feat: nueva función"

# ❌ Incorrecto
git commit -m "Feat: nueva función"
```

✅ **Sin punto al final de la descripción**
```bash
# ✅ Correcto
git commit -m "feat: agregar análisis"

# ❌ Incorrecto
git commit -m "feat: agregar análisis."
```

✅ **Descripciones cortas y claras**
```bash
# ✅ Correcto (descriptivo)
git commit -m "feat: agregar detección de acordes menores"

# ❌ Incorrecto (muy vago)
git commit -m "feat: cosas nuevas"
```

✅ **Usa imperative en la descripción**
```bash
# ✅ Correcto (imperativo)
git commit -m "feat: agregar soporte para acordes"

# ⚠️ Menos común (pasado)
git commit -m "feat: agregué soporte para acordes"
```

## Cómo Afecta a la Versión

| Commits | Versión Anterior | Versión Nueva | Por qué |
|---------|-----------------|---------------|----|
| `feat: ...` | 1.0.0 | 1.1.0 | MINOR |
| `fix: ...` | 1.0.0 | 1.0.1 | PATCH |
| `feat!: ...` | 1.0.0 | 2.0.0 | MAJOR |
| `docs: ...` | 1.0.0 | 1.0.0 | Sin cambio |
| `feat: ...` + `fix: ...` | 1.0.0 | 1.1.0 | Sube MINOR |

## No Hagas Esto ❌

```bash
# ❌ No hagas commits genéricos
git commit -m "update"
git commit -m "cambios"
git commit -m "wip"

# ❌ No cambies manualmente la versión
git tag v1.2.3  # ← No, release-please lo hace
npm version 1.2.3  # ← No, release-please lo hace

# ❌ No mezcles varios tipos en un commit
git commit -m "feat: agregar búsqueda, fix: corregir crash"
# Mejor: dos commits separados
```

## Proceso Completo

1. **Haz cambios de código**
   ```bash
   # Editar archivos...
   ```

2. **Prepara cambios**
   ```bash
   git add .
   ```

3. **Commit con Conventional Format**
   ```bash
   git commit -m "feat: descripción clara de qué agregaste"
   ```

4. **Push a tu rama**
   ```bash
   git push origin mi-rama
   ```

5. **Merge a main**
   ```bash
   # Crear PR en GitHub
   # Reviewer aprueba
   # GitHub merge a main
   ```

6. **Release-Please actúa automáticamente**
   - Analiza commits
   - Calcula nueva versión
   - Crea PR de release
   - Crea tag y release cuando se merge
   - Despliega aplicación

## Tips

💡 **Si no estás seguro del tipo**, usa `chore`
```bash
git commit -m "chore: pequeño cambio"
```

💡 **Para cambios rápidos en desarrollo**, usa `git commit --amend`
```bash
git commit -m "feat: agregar búsqueda"
git add archivo-faltante.ts
git commit --amend --no-edit
```

💡 **Para ver tus commits antes de push**
```bash
git log --oneline -5
```

💡 **Para cambiar el mensaje del último commit**
```bash
git commit --amend -m "feat: descripción corregida"
```

## Recursos

- [Conventional Commits](https://www.conventionalcommits.org/)
- [VERSIONING.md](./VERSIONING.md) - Guía técnica
- [release-please](https://github.com/googleapis/release-please)
