# 📊 CSS Variables Architecture Overview

Visualización de la estructura y jerarquía del sistema de variables CSS en Cancionero.

## 🎨 Estructura General

```
CSS Variables System (src/index.css)
│
├── :root (Modo Claro - Light Theme)
│   └── Variables definidas con colores claros
│
└── [data-theme="dark"], .dark (Modo Oscuro - Dark Theme)
    └── Variables definidas con colores oscuros
```

## 📚 Categorías de Variables

### 1. TIPOGRAFÍAS (Typography)

```
Familias de Fuentes
├── --font-sans (Plus Jakarta Sans)
├── --font-serif (Fraunces)
└── --font-mono (JetBrains Mono)

Tamaños (Font Sizes)
├── --font-size-xs (0.75rem / 12px)
├── --font-size-sm (0.875rem / 14px)
├── --font-size-base (1rem / 16px)
├── --font-size-lg (1.125rem / 18px)
├── --font-size-xl (1.25rem / 20px)
├── --font-size-2xl (1.5rem / 24px)
├── --font-size-3xl (1.875rem / 30px)
└── --font-size-4xl (2.25rem / 36px)

Pesos (Font Weights)
├── --font-weight-light (300)
├── --font-weight-normal (400)
├── --font-weight-medium (500)
├── --font-weight-semibold (600)
├── --font-weight-bold (700)
└── --font-weight-extrabold (800)

Alturas de Línea (Line Heights)
├── --line-height-tight (1.25)
├── --line-height-snug (1.375)
├── --line-height-normal (1.5)
├── --line-height-relaxed (1.625)
└── --line-height-loose (2)

Espaciado de Letras (Letter Spacing)
├── --letter-spacing-tighter (-0.05em)
├── --letter-spacing-tight (-0.025em)
├── --letter-spacing-normal (0em)
├── --letter-spacing-wide (0.025em)
├── --letter-spacing-wider (0.05em)
└── --letter-spacing-widest (0.1em)
```

### 2. COLORES DE FONDO (Background Colors)

```
Jerarquía de Superficies
├── --bg-canvas ........... Fondo principal de página
├── --bg-surface .......... Superficie base, cards
├── --bg-surface-elevated . Elementos más elevados
├── --bg-surface-subtle ... Paneles sutiles
├── --bg-surface-muted .... Áreas silenciadas
├── --bg-input ............ Campos de formulario
├── --bg-header ........... Header translúcido
├── --bg-modal ............ Modales y diálogos
├── --bg-code ............ Bloques de código
├── --bg-hover ........... Estado hover
├── --bg-active .......... Estado activo
└── --bg-disabled ........ Estado deshabilitado

MODO CLARO                  MODO OSCURO
├── #f8f6f0 (canvas)       ├── #0c0d10 (canvas)
├── #ffffff (surface)      ├── #14151b (surface)
├── #f1ede4 (subtle)       └── #181920 (subtle)
└── ...                     └── ...
```

### 3. BORDES (Borders)

```
Niveles de Énfasis
├── --border-subtle ... Divisores sutiles, poco énfasis
├── --border-medium ... Bordes normales, énfasis moderado
├── --border-strong ... Bordes visibles, énfasis máximo
└── --border-focus .... Enfoque de elementos

MODO CLARO                          MODO OSCURO
├── rgba(40, 30, 20, 0.1) subtle   ├── rgba(255, 255, 255, 0.08) subtle
├── rgba(40, 30, 20, 0.18) medium  ├── rgba(255, 255, 255, 0.16) medium
├── rgba(40, 30, 20, 0.28) strong  ├── rgba(255, 255, 255, 0.25) strong
└── #d97706 focus                   └── #fbbf24 focus
```

### 4. TEXTO (Text Colors)

```
Jerarquía de Importancia
├── --text-primary .... Texto principal, máximo contraste
├── --text-secondary .. Texto secundario, menos énfasis
├── --text-tertiary ... Texto terciario
├── --text-muted ..... Texto silenciado, baja importancia
├── --text-inverse ... Texto sobre fondos opuestos
└── --text-disabled .. Texto deshabilitado

MODO CLARO                  MODO OSCURO
├── #1c1917 primary        ├── #f3f4f6 primary
├── #57534e secondary      ├── #a1a1aa secondary
├── #78716c tertiary       ├── #71717a tertiary
└── #b8ada3 disabled       └── #3f3f46 disabled
```

### 5. ACENTO PRIMARIO (Primary Accent)

```
Paleta de Acento - Cambio Dinámico
├── --accent-primary ... Color principal
├── --accent-hover ..... Estado hover
├── --accent-active .... Estado activo
├── --accent-text ...... Texto sobre acento
├── --accent-subtle .... Fondo sutil con acento
├── --accent-border .... Borde con acento
└── --accent-muted .... Acento silenciado

MODO CLARO              MODO OSCURO
├── #d97706 primary     ├── #fbbf24 primary
├── #b45309 hover       ├── #f59e0b hover
├── #92400e active      ├── #d97706 active
└── ...                 └── ...
```

### 6. COMPONENTES ESPECÍFICOS (Component-Specific)

#### Botones (Buttons)

```
Botón Primario
├── --button-primary-bg
├── --button-primary-text
├── --button-primary-border
├── --button-primary-hover-bg
├── --button-primary-active-bg
├── --button-primary-disabled-bg
└── --button-primary-disabled-text

Botón Secundario
├── --button-secondary-bg
├── --button-secondary-text
├── --button-secondary-border
├── --button-secondary-hover-bg
├── --button-secondary-active-bg
├── --button-secondary-disabled-bg
└── --button-secondary-disabled-text

Botón Terciario (Outline)
├── --button-tertiary-bg (transparent)
├── --button-tertiary-text
├── --button-tertiary-border
├── --button-tertiary-hover-bg
├── --button-tertiary-active-bg
└── --button-tertiary-disabled-text
```

#### Inputs & Forms

```
--input-bg .................. Fondo del input
--input-text ............... Color del texto
--input-border ............. Borde normal
--input-border-hover ....... Borde al hover
--input-border-focus ....... Borde al enfocar
--input-placeholder ........ Color del placeholder
--input-disabled-bg ........ Fondo deshabilitado
--input-disabled-text ...... Texto deshabilitado
```

#### Cards

```
--card-bg ..................... Fondo de la tarjeta
--card-border ................. Borde normal
--card-hover-border ........... Borde al hover
--card-shadow ................. Sombra normal
```

#### Badges

```
Badge Primario
├── --badge-primary-bg
├── --badge-primary-text
└── --badge-primary-border

Badge Secundario
├── --badge-secondary-bg
├── --badge-secondary-text
└── --badge-secondary-border
```

#### Modales

```
--modal-bg .................... Fondo del modal
--modal-backdrop .............. Overlay oscuro
--modal-border ................ Borde
--modal-shadow ................ Sombra
```

#### Código & Bloques

```
--code-bg .................... Fondo de código
--code-text .................. Texto de código
--code-border ................ Borde
--code-highlight ............ Highlight de sintaxis
```

### 7. ESPACIAMIENTOS (Spacing)

```
Escala de Espacios (Base: 4px / 0.25rem)
├── --space-0 ......... 0px
├── --space-1 ......... 4px (0.25rem)
├── --space-2 ......... 8px (0.5rem)
├── --space-3 ......... 12px (0.75rem)
├── --space-4 ......... 16px (1rem)
├── --space-5 ......... 20px (1.25rem)
├── --space-6 ......... 24px (1.5rem)
├── --space-8 ......... 32px (2rem)
├── --space-10 ........ 40px (2.5rem)
├── --space-12 ........ 48px (3rem)
├── --space-16 ........ 64px (4rem)
└── --space-20 ........ 80px (5rem)

APLICACIONES:
├── Padding: p-[var(--space-4)]
├── Margin: mb-[var(--space-6)]
├── Gap (flex/grid): gap-[var(--space-3)]
└── Combine: p-[var(--space-4)] m-[var(--space-2)]
```

### 8. BORDER RADIUS

```
Escala de Redondeamientos
├── --radius-none ....... 0px
├── --radius-xs ......... 2px (0.125rem)
├── --radius-sm ......... 4px (0.25rem)
├── --radius-base ....... 6px (0.375rem)
├── --radius-md ......... 8px (0.5rem)
├── --radius-lg ......... 12px (0.75rem)
├── --radius-xl ......... 16px (1rem)
├── --radius-2xl ........ 24px (1.5rem)
└── --radius-full ....... 9999px (completamente redondo)

CASOS DE USO:
├── --radius-md .... Botones, inputs pequeños
├── --radius-lg .... Cards, contenedores
└── --radius-full .. Avatares, badges
```

### 9. SOMBRAS (Shadows)

```
Jerarquía de Profundidad
├── --shadow-xs ............... Muy sutil (1px)
├── --shadow-sm ............... Sutil (2px)
├── --shadow-base ............ Normal (4px)
├── --shadow-md .............. Medio (10px)
├── --shadow-lg .............. Grande (20px)
├── --shadow-xl .............. Extra grande (25px)
├── --shadow-card ............ Sombra específica de cards
└── --shadow-card-hover ...... Sombra al hover

MODO CLARO vs OSCURO:
- Claro: Sombras más sutiles (menos contraste)
- Oscuro: Sombras más pronunciadas (más contraste)

CASOS DE USO:
├── --shadow-sm ..... Elementos levemente elevados
├── --shadow-card ... Cards normales
└── --shadow-xl ..... Modales, dropdowns
```

### 10. ESTADOS DE VALIDACIÓN (State Colors)

```
Success ✓
├── --state-success-bg
├── --state-success-text
└── --state-success-border

Warning ⚠
├── --state-warning-bg
├── --state-warning-text
└── --state-warning-border

Error ✗
├── --state-error-bg
├── --state-error-text
└── --state-error-border

Info ℹ
├── --state-info-bg
├── --state-info-text
└── --state-info-border
```

### 11. SCROLLBAR

```
--scrollbar-thumb ......... Color del scroll thumb
--scrollbar-thumb-hover .. Color al hacer hover

Estilos aplicados automáticamente:
├── Ancho: 6px
├── Radio: 9999px (completamente redondo)
└── Fondo de track: transparente
```

## 🔄 Flujo de Cambio de Tema

```
Usuario hace click en toggle
         ↓
ThemeContext.toggleTheme()
         ↓
document.documentElement.setAttribute('data-theme', 'dark' | 'light')
document.documentElement.classList.toggle('dark')
         ↓
localStorage.setItem('tony_cancionero_theme_mode', theme)
         ↓
CSS procesa [data-theme="dark"] o :root
         ↓
Todas las variables CSS se actualizan automáticamente
         ↓
Componentes usando var(--...) se renderizan con nuevos colores
```

## 📐 Relaciones Entre Variables

```
Colores Base
├─ Backgrounds ────────────── Valores RGB/Hex
│   └─ Componentes específicos (button-primary-bg, etc)
│
├─ Borders ─────────────────── Valores RGBA
│   └─ Componentes específicos (input-border, etc)
│
└─ Text ───────────────────── Valores RGB/Hex
    └─ Componentes específicos (button-primary-text, etc)

Tipografía
├─ Familias ──────── Fuentes
├─ Tamaños ──────── px/rem
├─ Pesos ────────── 300-800
└─ Espaciado ────── em

Espacios
├─ Padding ──── p-[var(--space-X)]
├─ Margin ───── m-[var(--space-X)]
└─ Gap ──────── gap-[var(--space-X)]

Geometría
├─ Border Radius ──── rounded-[var(--radius-X)]
└─ Sombras ────────── shadow-[var(--shadow-X)]
```

## 🎯 Decisiones de Diseño

### Por qué separadas por modo?
- Las variables CSS que dependen de `:root` se heredan a todos los elementos
- Con `[data-theme="dark"]`, el navegador solo reemplaza variables en el contexto oscuro
- Permite fallback automático y mejor control

### Por qué tantas variables de componentes?
- **Consistencia**: Los botones primarios siempre usan `--button-primary-*`
- **Escalabilidad**: Fácil agregar nuevos componentes
- **Mantenibilidad**: Cambios centralizados en CSS

### Por qué múltiples niveles de texto?
- **Jerarquía**: primary > secondary > tertiary > muted > disabled
- **Accesibilidad**: Contraste suficiente en todos los niveles
- **Flexibilidad**: Opciones para cada caso de uso

## 📊 Estadísticas

```
Total de Variables CSS: ~130+

Distribución:
├── Tipografías .................. 23 variables
├── Colores de Fondo ............. 12 variables
├── Bordes ....................... 4 variables
├── Texto ........................ 6 variables
├── Acento Primario .............. 7 variables
├── Validaciones ................. 12 variables
├── Componentes Específicos ....... 40+ variables
├── Espaciamientos ............... 11 variables
├── Border Radius ................ 8 variables
├── Sombras ...................... 8 variables
└── Scrollbar .................... 2 variables

Por Tema:
├── :root (Claro) ............... ~130 variables
└── [data-theme="dark"] (Oscuro) . ~130 variables
```

## ✨ Casos de Uso Comunes

```
Crear un botón consistente:
  bg-[var(--button-primary-bg)]
  text-[var(--button-primary-text)]
  hover:bg-[var(--button-primary-hover-bg)]

Crear una card elegante:
  bg-[var(--card-bg)]
  border border-[var(--card-border)]
  shadow-[var(--shadow-card)]
  hover:shadow-[var(--shadow-card-hover)]

Input con validación:
  border-[var(--input-border)]
  focus:border-[var(--input-border-focus)]
  disabled:bg-[var(--input-disabled-bg)]

Mensaje de error:
  bg-[var(--state-error-bg)]
  text-[var(--state-error-text)]
  border border-[var(--state-error-border)]
```

## 🔍 Debugueo

Para ver qué variable está siendo usada:

```javascript
// En DevTools Console:
const styles = getComputedStyle(document.documentElement);
console.log(styles.getPropertyValue('--accent-primary')); // Muestra el valor actual

// Para todas las variables:
const allVars = Array.from(document.styleSheets)
  .flatMap(sheet => Array.from(sheet.cssRules))
  .filter(rule => rule.style)
  .map(rule => rule.style.cssText);
```

---

**Última actualización**: Octubre 2026
**Sistema de variables**: Completamente refactorizado
**Compatibilidad**: Todos los navegadores modernos
