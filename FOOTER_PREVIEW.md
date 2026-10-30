# Vista Previa - Footer con Versionado

## Cómo se verá en la aplicación

### Desktop
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  🎵 Cancionero                  [Dashboard] [Git Sync] [About] │
│  Tu catálogo personal de canciones                [Auth] [Contact]
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                    [Contenido de la Aplicación]                │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎵 v0.0.0 (build: 2)  [psychic-eureka]                        │
│  © 2024 Cancionero. All rights reserved.                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile
```
┌───────────────────────────────┐
│                               │
│  🎵 Cancionero                │
│  Tu catálogo personal...      │
│                               │
│  [Dashboard]                  │
│  [Git Sync]                   │
│  [About]                      │
│  [Contact]                    │
│                               │
├───────────────────────────────┤
│                               │
│   [Contenido Responsive]      │
│                               │
├───────────────────────────────┤
│                               │
│  🎵 v0.0.0 (build: 2)         │
│  [psychic-eureka]             │
│                               │
│  © 2024 Cancionero.           │
│  All rights reserved.         │
│                               │
└───────────────────────────────┘
```

## Variables Mostradas

### Componentes del Footer

1. **Versión Principal**
   - Formato: `v{MAJOR}.{MINOR}.{PATCH} (build: {BUILD_NUMBER})`
   - Ejemplo: `v1.2.3 (build: 1042)`
   - Incluye icono de música 🎵

2. **Rama (si aplica)**
   - Solo se muestra si no es `master`, `main` o `unknown`
   - Ejemplo: `[psychic-eureka]`, `[develop]`, `[feature/x]`

3. **Copyright**
   - Año dinámico: `© {YEAR}`
   - Nombre del proyecto: `Cancionero`

## Ejemplo Real

### Después de varios commits

```
Commit 1: build 1
Commit 2: build 2
...
Commit 1042: build 1042
```

**Footer mostrará:**
```
🎵 v1.2.3 (build: 1042) [main]
© 2024 Cancionero. All rights reserved.
```

### Sin rama de desarrollo

Si se despliega en `main` o `master`:
```
🎵 v1.2.3 (build: 1042)
© 2024 Cancionero. All rights reserved.
```

### Con rama de desarrollo

Si se despliega en rama `develop`:
```
🎵 v1.2.3 (build: 1042) [develop]
© 2024 Cancionero. All rights reserved.
```

## Información Disponible

### En el archivo `src/config/version.ts`

```typescript
// Valores automáticamente generados en cada build

APP_VERSION = '1.2.3'              // Versión semántica
BUILD_NUMBER = 1042                 // Número incremental (total commits)
COMMIT_HASH = 'a1b2c3d4'           // Hash corto del commit actual
BUILD_BRANCH = 'main'               // Rama actual
BUILD_TIMESTAMP = '2026-10-30...'  // ISO timestamp del build

// Formatos listos para usar:
FULL_VERSION = '1.2.3+1042'        // Semver + build metadata
DISPLAY_VERSION = 'v1.2.3 (build: 1042)'  // Para mostrar en UI
```

## Cómo Incrementa Automáticamente

### En cada Push a main/master

```
GitHub Actions Workflow:
├─ Checkout (fetch-depth: 0)
├─ npm run generate-version
│  └─ git rev-list --count HEAD → BUILD_NUMBER = N
│  └─ Genera src/config/version.ts
├─ npm run build
│  └─ Incluye DISPLAY_VERSION en el bundle
└─ Deploy a GitHub Pages
   └─ Footer muestra versión actualizada
```

### Ejemplo de Incremento

```
Primer push:       Commit 1 → Build 1
Segundo push:      Commit 2 → Build 2
Tercer push:       Commit 3 → Build 3
...
Commit 1042:       Total commits → Build 1042
```

## Styling

El footer usa:
- **Tailwind CSS** para estilos responsivos
- **Variables de tema** para colores dinámicos
- **Transiciones suaves** entre cambios de tema
- **Iconos Lucide** para visual coherente

### Clases aplicadas

- Texto muted: `text-[var(--text-muted)]`
- Fondo: `bg-[var(--bg-surface)]`
- Borde superior: `border-[var(--border-subtle)]`
- Color de acento: `text-[var(--accent-primary)]`
- Tamaño: responsive con `gap-6` y espaciado `py-10`
