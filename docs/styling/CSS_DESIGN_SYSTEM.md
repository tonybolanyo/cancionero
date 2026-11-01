# 🎨 Sistema de Diseño CSS - Cancionero

Guía completa de variables CSS disponibles para temas claro y oscuro.

## Índice
1. [Tipografías](#tipografías)
2. [Colores Básicos](#colores-básicos)
3. [Componentes Específicos](#componentes-específicos)
4. [Espaciamientos](#espaciamientos)
5. [Border Radius](#border-radius)
6. [Sombras](#sombras)
7. [Estados](#estados)
8. [Cómo Usar](#cómo-usar)

---

## Tipografías

### Familias de Fuentes

```css
/* Familias base */
--font-sans      /* Plus Jakarta Sans - UI principal, versátil */
--font-serif     /* Fraunces - Titulares, marcas estilizadas */
--font-mono      /* JetBrains Mono - Código, valores técnicos */
```

### Tamaños de Fuente

| Variable | Tamaño |
|----------|--------|
| `--font-size-xs` | 0.75rem (12px) |
| `--font-size-sm` | 0.875rem (14px) |
| `--font-size-base` | 1rem (16px) |
| `--font-size-lg` | 1.125rem (18px) |
| `--font-size-xl` | 1.25rem (20px) |
| `--font-size-2xl` | 1.5rem (24px) |
| `--font-size-3xl` | 1.875rem (30px) |
| `--font-size-4xl` | 2.25rem (36px) |

### Pesos de Fuente

| Variable | Peso |
|----------|------|
| `--font-weight-light` | 300 |
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |
| `--font-weight-extrabold` | 800 |

### Alturas de Línea

| Variable | Valor |
|----------|-------|
| `--line-height-tight` | 1.25 |
| `--line-height-snug` | 1.375 |
| `--line-height-normal` | 1.5 |
| `--line-height-relaxed` | 1.625 |
| `--line-height-loose` | 2 |

### Letter Spacing

| Variable | Valor |
|----------|-------|
| `--letter-spacing-tighter` | -0.05em |
| `--letter-spacing-tight` | -0.025em |
| `--letter-spacing-normal` | 0em |
| `--letter-spacing-wide` | 0.025em |
| `--letter-spacing-wider` | 0.05em |
| `--letter-spacing-widest` | 0.1em |

**Ejemplo:**
```css
.heading {
  font-family: var(--font-serif);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-wide);
}
```

---

## Colores Básicos

### Fondos (Backgrounds)

#### Modo Claro
```css
--bg-canvas: #f8f6f0;           /* Fondo de página principal */
--bg-surface: #ffffff;           /* Superficies elevadas */
--bg-surface-elevated: #ffffff;  /* Elementos más elevados */
--bg-surface-subtle: #f1ede4;    /* Áreas sutiles, paneles */
--bg-surface-muted: #e7e3d8;     /* Áreas silenciadas */
--bg-input: #ffffff;             /* Campos de formulario */
--bg-header: rgba(248, 246, 240, 0.92); /* Header translúcido */
--bg-modal: #ffffff;             /* Modales y diálogos */
--bg-code: #f2ede1;              /* Bloques de código */
--bg-hover: #f5f1e8;             /* Estado hover */
--bg-active: #ede5d8;            /* Estado activo */
--bg-disabled: #d7d1c6;          /* Estado deshabilitado */
```

#### Modo Oscuro
```css
--bg-canvas: #0c0d10;            /* Fondo de página principal */
--bg-surface: #14151b;           /* Superficies elevadas */
--bg-surface-elevated: #191a22;  /* Elementos más elevados */
--bg-surface-subtle: #181920;    /* Áreas sutiles, paneles */
--bg-surface-muted: #20222c;     /* Áreas silenciadas */
--bg-input: #121319;             /* Campos de formulario */
--bg-header: rgba(12, 13, 16, 0.94); /* Header translúcido */
--bg-modal: #111216;             /* Modales y diálogos */
--bg-code: #07070a;              /* Bloques de código */
--bg-hover: #1a1b24;             /* Estado hover */
--bg-active: #1e1f2b;            /* Estado activo */
--bg-disabled: #2a2b35;          /* Estado deshabilitado */
```

### Bordes (Borders)

```css
--border-subtle: rgba(...)        /* Bordes sutiles, divisores suaves */
--border-medium: rgba(...)        /* Bordes normales, elementos moderados */
--border-strong: rgba(...)        /* Bordes visibles, énfasis */
--border-focus: #d97706 | #fbbf24 /* Color de enfoque */
```

### Texto (Text)

#### Modo Claro
```css
--text-primary: #1c1917;    /* Texto principal, legible */
--text-secondary: #57534e;  /* Texto secundario */
--text-tertiary: #78716c;   /* Texto terciario */
--text-muted: #9a9490;      /* Texto silenciado */
--text-inverse: #ffffff;    /* Texto sobre fondos oscuros */
--text-disabled: #b8ada3;   /* Texto deshabilitado */
```

#### Modo Oscuro
```css
--text-primary: #f3f4f6;    /* Texto principal, legible */
--text-secondary: #a1a1aa;  /* Texto secundario */
--text-tertiary: #71717a;   /* Texto terciario */
--text-muted: #52525b;      /* Texto silenciado */
--text-inverse: #1c1917;    /* Texto sobre fondos claros */
--text-disabled: #3f3f46;   /* Texto deshabilitado */
```

### Acento Primario

El color de marca cambio dinámicamente entre temas.

#### Modo Claro (Naranja)
```css
--accent-primary: #d97706;         /* Color principal: Naranja */
--accent-hover: #b45309;           /* Estado hover */
--accent-active: #92400e;          /* Estado activo */
--accent-text: #ffffff;            /* Texto sobre acento */
--accent-subtle: rgba(217, 119, 6, 0.12);  /* Fondo sutil */
--accent-border: rgba(217, 119, 6, 0.28);  /* Borde con acento */
--accent-muted: rgba(217, 119, 6, 0.08);   /* Acento silenciado */
```

#### Modo Oscuro (Ámbar)
```css
--accent-primary: #fbbf24;         /* Color principal: Ámbar dorado */
--accent-hover: #f59e0b;           /* Estado hover */
--accent-active: #d97706;          /* Estado activo */
--accent-text: #0c0d10;            /* Texto sobre acento */
--accent-subtle: rgba(251, 191, 36, 0.12);  /* Fondo sutil */
--accent-border: rgba(251, 191, 36, 0.25);  /* Borde con acento */
--accent-muted: rgba(251, 191, 36, 0.08);   /* Acento silenciado */
```

### Estados de Validación

```css
--state-success-bg
--state-success-text
--state-success-border

--state-warning-bg
--state-warning-text
--state-warning-border

--state-error-bg
--state-error-text
--state-error-border

--state-info-bg
--state-info-text
--state-info-border
```

---

## Componentes Específicos

### Botones

#### Botón Primario
```css
--button-primary-bg: #d97706 | #fbbf24
--button-primary-text: #ffffff | #0c0d10
--button-primary-border: transparent
--button-primary-hover-bg
--button-primary-active-bg
--button-primary-disabled-bg
--button-primary-disabled-text
```

**Uso:**
```html
<button class="px-4 py-2 bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)] disabled:bg-[var(--button-primary-disabled-bg)]">
  Acción
</button>
```

#### Botón Secundario
```css
--button-secondary-bg
--button-secondary-text
--button-secondary-border
--button-secondary-hover-bg
--button-secondary-active-bg
--button-secondary-disabled-bg
--button-secondary-disabled-text
```

#### Botón Terciario (Outline)
```css
--button-tertiary-bg: transparent
--button-tertiary-text
--button-tertiary-border
--button-tertiary-hover-bg
--button-tertiary-active-bg
--button-tertiary-disabled-text
```

### Inputs & Forms

```css
--input-bg              /* Fondo del input */
--input-text            /* Color del texto */
--input-border          /* Borde normal */
--input-border-hover    /* Borde al pasar el ratón */
--input-border-focus    /* Borde al enfocar */
--input-placeholder     /* Color del placeholder */
--input-disabled-bg     /* Fondo deshabilitado */
--input-disabled-text   /* Texto deshabilitado */
```

**Uso:**
```html
<input 
  type="text"
  placeholder="Escribe aquí"
  class="px-3 py-2 bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] placeholder-[var(--input-placeholder)] focus:border-[var(--input-border-focus)]"
/>
```

### Cards

```css
--card-bg              /* Fondo de la tarjeta */
--card-border          /* Borde normal */
--card-hover-border    /* Borde al pasar el ratón */
--card-shadow          /* Sombra normal */
```

**Uso:**
```html
<div class="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 shadow-[var(--card-shadow)]">
  <!-- Contenido -->
</div>
```

### Badges

```css
--badge-primary-bg
--badge-primary-text
--badge-primary-border

--badge-secondary-bg
--badge-secondary-text
--badge-secondary-border
```

### Modales

```css
--modal-bg              /* Fondo del modal */
--modal-backdrop        /* Fondo oscuro detrás */
--modal-border          /* Borde del modal */
--modal-shadow          /* Sombra del modal */
```

### Código y Bloques

```css
--code-bg              /* Fondo de código */
--code-text            /* Texto de código */
--code-border          /* Borde de bloques */
--code-highlight       /* Color de highlight */
```

### Tooltips

```css
--tooltip-bg           /* Fondo del tooltip */
--tooltip-text         /* Texto del tooltip */
--tooltip-border       /* Borde del tooltip */
```

---

## Espaciamientos

Escala de espaciamientos basada en múltiplos de 0.25rem (4px):

```css
--space-0:   0           /* 0px */
--space-1:   0.25rem     /* 4px */
--space-2:   0.5rem      /* 8px */
--space-3:   0.75rem     /* 12px */
--space-4:   1rem        /* 16px */
--space-5:   1.25rem     /* 20px */
--space-6:   1.5rem      /* 24px */
--space-8:   2rem        /* 32px */
--space-10:  2.5rem      /* 40px */
--space-12:  3rem        /* 48px */
--space-16:  4rem        /* 64px */
--space-20:  5rem        /* 80px */
```

**Uso:**
```css
.element {
  padding: var(--space-4);        /* 16px */
  margin-bottom: var(--space-6);  /* 24px */
  gap: var(--space-3);            /* 12px */
}
```

---

## Border Radius

Escala de redondeamientos:

```css
--radius-none:   0          /* Sin redondeo */
--radius-xs:     0.125rem   /* 2px */
--radius-sm:     0.25rem    /* 4px */
--radius-base:   0.375rem   /* 6px */
--radius-md:     0.5rem     /* 8px */
--radius-lg:     0.75rem    /* 12px */
--radius-xl:     1rem       /* 16px */
--radius-2xl:    1.5rem     /* 24px */
--radius-full:   9999px     /* Completamente redondeado */
```

**Uso:**
```css
.element {
  border-radius: var(--radius-lg);      /* Esquinas redondeadas moderadas */
  border-top-left-radius: var(--radius-xl);
  border-bottom-right-radius: var(--radius-md);
}
```

---

## Sombras

Escala de sombras con progresión de profundidad:

```css
--shadow-xs:         0 1px 2px 0 rgba(...)         /* Muy sutil */
--shadow-sm:         0 1px 3px 0 rgba(...)         /* Sutil */
--shadow-base:       0 4px 6px -1px rgba(...)      /* Normal */
--shadow-md:         0 10px 15px -3px rgba(...)    /* Medio */
--shadow-lg:         0 20px 25px -5px rgba(...)    /* Grande */
--shadow-xl:         0 25px 50px -12px rgba(...)   /* Extra grande */
--shadow-card:       0 4px 20px -2px rgba(...)     /* Sombra de tarjeta */
--shadow-card-hover: 0 20px 25px -5px rgba(...)    /* Hover de tarjeta */
```

**Uso:**
```css
.card:hover {
  box-shadow: var(--shadow-card-hover);
}

.floating-element {
  box-shadow: var(--shadow-lg);
}
```

---

## Estados

### Colores de Validación

**Success (Éxito)**
```css
--state-success-bg:     #d1fae5 | #064e3b
--state-success-text:   #065f46 | #86efac
--state-success-border: #6ee7b7 | #22c55e
```

**Warning (Advertencia)**
```css
--state-warning-bg:     #fef3c7 | #78350f
--state-warning-text:   #92400e | #fef3c7
--state-warning-border: #fcd34d | #fbbf24
```

**Error (Error)**
```css
--state-error-bg:     #fee2e2 | #7f1d1d
--state-error-text:   #991b1b | #fca5a5
--state-error-border: #fca5a5 | #ef4444
```

**Info (Información)**
```css
--state-info-bg:     #dbeafe | #0c2340
--state-info-text:   #0c2340 | #bfdbfe
--state-info-border: #93c5fd | #3b82f6
```

---

## Scrollbar

Barras de desplazamiento personalizadas:

```css
--scrollbar-thumb:       /* Color del thumb */
--scrollbar-thumb-hover: /* Color del thumb al pasar el ratón */
```

Los estilos personalizados ya están aplicados en `index.css`:
```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

---

## Cómo Usar

### En Tailwind + HTML

```html
<!-- Fondos -->
<div class="bg-[var(--bg-surface)]">...</div>

<!-- Texto -->
<p class="text-[var(--text-primary)]">...</p>

<!-- Bordes -->
<input class="border border-[var(--input-border)] focus:border-[var(--input-border-focus)]" />

<!-- Sombras -->
<div class="shadow-[var(--shadow-card)]">...</div>

<!-- Espaciamientos -->
<div class="p-[var(--space-4)] mb-[var(--space-6)]">...</div>

<!-- Border Radius -->
<button class="rounded-[var(--radius-lg)]">...</button>
```

### En Componentes React

```jsx
export function MyButton() {
  return (
    <button
      className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)] transition-colors"
    >
      Enviar
    </button>
  );
}
```

### En CSS Personalizado

```css
.my-component {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}

.my-component:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-medium);
  box-shadow: var(--shadow-lg);
}

.my-component:disabled {
  background-color: var(--bg-disabled);
  color: var(--text-disabled);
  cursor: not-allowed;
}
```

### Cambiar Tema

El tema se controla automáticamente mediante `data-theme` en el elemento `<html>`:

```javascript
// En TypeScript/React
const root = document.documentElement;

// Cambiar a tema oscuro
root.setAttribute('data-theme', 'dark');
root.classList.add('dark');

// Cambiar a tema claro
root.setAttribute('data-theme', 'light');
root.classList.remove('dark');
```

El `ThemeContext` en la aplicación maneja esto automáticamente.

---

## Mantenimiento

Para mantener consistencia:

1. **No hardcodear colores** - Siempre usa variables CSS
2. **Agrupa variables relacionadas** - Como los botones primarios con sus estados
3. **Añade comentarios** - Documenta nuevas variables
4. **Prueba en ambos temas** - Verifica que todo se vea bien en claro y oscuro
5. **Actualiza este documento** - Cuando agregues nuevas variables

---

## Ejemplos Prácticos

### Tarjeta Interactive

```html
<div class="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-lg)] p-[var(--space-6)] shadow-[var(--card-shadow)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--card-hover-border)] transition-all">
  <h3 class="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)] mb-[var(--space-2)]">
    Título
  </h3>
  <p class="text-[var(--text-secondary)] mb-[var(--space-4)]">
    Descripción
  </p>
  <button class="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] rounded-[var(--radius-md)] hover:bg-[var(--button-primary-hover-bg)] transition-colors">
    Acción
  </button>
</div>
```

### Formulario Accesible

```html
<form class="space-y-[var(--space-4)]">
  <div>
    <label for="name" class="block text-[var(--text-primary)] font-[var(--font-weight-semibold)] mb-[var(--space-2)]">
      Nombre
    </label>
    <input 
      id="name"
      type="text"
      placeholder="Tu nombre"
      class="w-full px-[var(--space-3)] py-[var(--space-2)] bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] rounded-[var(--radius-md)] placeholder-[var(--input-placeholder)] focus:border-[var(--input-border-focus)] focus:outline-none transition-colors"
    />
  </div>
</form>
```

### Mensaje de Estado

```html
<!-- Éxito -->
<div class="bg-[var(--state-success-bg)] border border-[var(--state-success-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
  <p class="text-[var(--state-success-text)] font-[var(--font-weight-semibold)]">
    ¡Operación completada!
  </p>
</div>

<!-- Error -->
<div class="bg-[var(--state-error-bg)] border border-[var(--state-error-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
  <p class="text-[var(--state-error-text)] font-[var(--font-weight-semibold)]">
    Error: Algo salió mal
  </p>
</div>
```

---

## Soporte

Para preguntas o sugerencias sobre el sistema de variables CSS, revisa:
- `src/index.css` - Definiciones de variables
- Componentes en `src/components/` - Ejemplos de uso
- TypeScript en `src/` - Lógica de temas

