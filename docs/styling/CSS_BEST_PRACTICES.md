# 🎯 CSS Variables Best Practices & Patterns

Patrones recomendados y mejores prácticas para usar el sistema de variables CSS en Cancionero.

## Tabla de Contenidos
1. [Patrones Básicos](#patrones-básicos)
2. [Patrones Avanzados](#patrones-avanzados)
3. [Casos de Uso Específicos](#casos-de-uso-específicos)
4. [Anti-Patrones (Qué Evitar)](#anti-patrones-qué-evitar)
5. [Checklist para Componentes](#checklist-para-componentes)
6. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Patrones Básicos

### 1. Componente Simple (Botón)

```jsx
// ✅ BIEN - Usa variables para todos los aspectos visuales
function Button({ children, variant = 'primary', disabled = false, ...props }) {
  const baseStyles = "px-[var(--space-4)] py-[var(--space-2)] rounded-[var(--radius-md)] font-[var(--font-weight-semibold)] text-[var(--font-size-sm)] transition-colors cursor-pointer";
  
  const variantStyles = {
    primary: `bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)] active:bg-[var(--button-primary-active-bg)]`,
    secondary: `bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] hover:bg-[var(--button-secondary-hover-bg)] active:bg-[var(--button-secondary-active-bg)]`,
    tertiary: `bg-[var(--button-tertiary-bg)] text-[var(--button-tertiary-text)] border border-[var(--button-tertiary-border)] hover:bg-[var(--button-tertiary-hover-bg)]`
  };

  const disabledStyles = disabled ? `bg-[var(--button-primary-disabled-bg)] text-[var(--button-primary-disabled-text)] cursor-not-allowed` : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${disabledStyles}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

// Uso:
<Button variant="primary">Enviar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="tertiary">Más opciones</Button>
<Button disabled>Deshabilitado</Button>
```

### 2. Card con Contenido

```jsx
// ✅ BIEN - Card reutilizable con estilos consistentes
function Card({ title, description, icon, action, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-lg)] p-[var(--space-6)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--card-hover-border)] transition-all cursor-pointer group"
    >
      {icon && (
        <div className="w-12 h-12 bg-[var(--accent-subtle)] rounded-[var(--radius-lg)] flex items-center justify-center mb-[var(--space-4)] group-hover:bg-[var(--accent-subtle)]/80 transition-colors">
          {icon}
        </div>
      )}
      
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)] mb-[var(--space-2)]">
        {title}
      </h3>
      
      <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)] leading-[var(--line-height-relaxed)] mb-[var(--space-4)]">
        {description}
      </p>

      {action && (
        <button className="text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}
```

### 3. Input con Label y Error

```jsx
// ✅ BIEN - Input completo con estados
function FormInput({ label, placeholder, error, required = false, ...props }) {
  return (
    <div className="space-y-[var(--space-2)]">
      {label && (
        <label className="block text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
          {label}
          {required && <span className="text-[var(--state-error-text)]">*</span>}
        </label>
      )}
      
      <input
        placeholder={placeholder}
        className={`w-full px-[var(--space-3)] py-[var(--space-2)] bg-[var(--input-bg)] text-[var(--input-text)] border rounded-[var(--radius-md)] placeholder-[var(--input-placeholder)] focus:outline-none transition-colors ${
          error
            ? 'border-[var(--state-error-border)] focus:border-[var(--state-error-text)]'
            : 'border-[var(--input-border)] focus:border-[var(--input-border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/20'
        }`}
        {...props}
      />
      
      {error && (
        <p className="text-[var(--font-size-xs)] text-[var(--state-error-text)] font-[var(--font-weight-medium)]">
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Patrones Avanzados

### 1. Componente con Estados Múltiples

```jsx
// ✅ BIEN - Estados dinámicos usando variables
function StatusBadge({ status, label }) {
  const statusStyles = {
    success: {
      bg: 'bg-[var(--state-success-bg)]',
      text: 'text-[var(--state-success-text)]',
      border: 'border-[var(--state-success-border)]',
      icon: '✓'
    },
    warning: {
      bg: 'bg-[var(--state-warning-bg)]',
      text: 'text-[var(--state-warning-text)]',
      border: 'border-[var(--state-warning-border)]',
      icon: '⚠'
    },
    error: {
      bg: 'bg-[var(--state-error-bg)]',
      text: 'text-[var(--state-error-text)]',
      border: 'border-[var(--state-error-border)]',
      icon: '✗'
    },
    info: {
      bg: 'bg-[var(--state-info-bg)]',
      text: 'text-[var(--state-info-text)]',
      border: 'border-[var(--state-info-border)]',
      icon: 'ℹ'
    }
  };

  const style = statusStyles[status] || statusStyles.info;

  return (
    <span className={`inline-flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-[var(--space-1)] ${style.bg} ${style.text} border ${style.border} rounded-[var(--radius-md)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]`}>
      <span>{style.icon}</span>
      <span>{label}</span>
    </span>
  );
}

// Uso:
<StatusBadge status="success" label="Publicado" />
<StatusBadge status="error" label="Error" />
<StatusBadge status="warning" label="Borrador" />
```

### 2. Componente Responsive

```jsx
// ✅ BIEN - Responsive con spacing variables
function SongGrid({ songs }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--space-6)] p-[var(--space-6)] bg-[var(--bg-canvas)]">
      {songs.map(song => (
        <div
          key={song.id}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all"
        >
          {song.image && (
            <img 
              src={song.image} 
              alt={song.title}
              className="w-full h-40 object-cover"
            />
          )}
          
          <div className="p-[var(--space-4)]">
            <h3 className="text-[var(--font-size-base)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
              {song.title}
            </h3>
            <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)] mt-[var(--space-1)]">
              {song.artist}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3. Composición de Estilos Base + Variantes

```jsx
// ✅ BIEN - Estilo base reutilizable + variantes
const baseInputStyles = "px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] focus:outline-none transition-colors";

const inputVariants = {
  primary: "bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] focus:border-[var(--input-border-focus)] placeholder-[var(--input-placeholder)]",
  success: "bg-[var(--state-success-bg)] text-[var(--state-success-text)] border border-[var(--state-success-border)]",
  error: "bg-[var(--state-error-bg)] text-[var(--state-error-text)] border border-[var(--state-error-border)]",
  disabled: "bg-[var(--input-disabled-bg)] text-[var(--input-disabled-text)] border border-[var(--border-subtle)] cursor-not-allowed"
};

function CustomInput({ variant = 'primary', ...props }) {
  return (
    <input
      className={`${baseInputStyles} ${inputVariants[variant]}`}
      {...props}
    />
  );
}
```

---

## Casos de Uso Específicos

### Tablas de Datos

```jsx
function DataTable({ columns, data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[var(--border-medium)]">
            {columns.map(col => (
              <th
                key={col.key}
                className="px-[var(--space-4)] py-[var(--space-3)] text-left text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--font-size-sm)] text-[var(--text-secondary)]"
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Acordeón / Collapsible

```jsx
function Accordion({ items }) {
  const [open, setOpen] = React.useState(null);

  return (
    <div className="space-y-[var(--space-2)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden">
      {items.map((item, idx) => (
        <div key={idx}>
          <button
            onClick={() => setOpen(open === idx ? null : idx)}
            className="w-full px-[var(--space-6)] py-[var(--space-4)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)] text-left transition-colors flex justify-between items-center"
          >
            <span className="text-[var(--font-size-base)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
              {item.title}
            </span>
            <span className="text-[var(--accent-primary)]">
              {open === idx ? '−' : '+'}
            </span>
          </button>
          
          {open === idx && (
            <div className="px-[var(--space-6)] py-[var(--space-4)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Notificación Toast

```jsx
function Toast({ type = 'info', message, onClose }) {
  const toastStyles = {
    success: {
      bg: 'bg-[var(--state-success-bg)]',
      border: 'border-[var(--state-success-border)]',
      text: 'text-[var(--state-success-text)]'
    },
    error: {
      bg: 'bg-[var(--state-error-bg)]',
      border: 'border-[var(--state-error-border)]',
      text: 'text-[var(--state-error-text)]'
    },
    warning: {
      bg: 'bg-[var(--state-warning-bg)]',
      border: 'border-[var(--state-warning-border)]',
      text: 'text-[var(--state-warning-text)]'
    },
    info: {
      bg: 'bg-[var(--state-info-bg)]',
      border: 'border-[var(--state-info-border)]',
      text: 'text-[var(--state-info-text)]'
    }
  };

  const style = toastStyles[type];

  return (
    <div className={`${style.bg} ${style.border} ${style.text} border-l-4 rounded-[var(--radius-lg)] p-[var(--space-4)] shadow-[var(--shadow-lg)] max-w-sm animate-in slide-in-from-bottom-5 duration-300`}>
      <div className="flex items-center justify-between">
        <p className="text-[var(--font-size-sm)] font-[var(--font-weight-medium)]">
          {message}
        </p>
        <button
          onClick={onClose}
          className="ml-[var(--space-4)] text-[inherit] opacity-75 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

---

## Anti-Patrones (Qué Evitar)

### ❌ ANTI-PATRÓN 1: Hardcodear Colores

```jsx
// ❌ MAL - Hardcodea colores, no respeta temas
function BadButton() {
  return (
    <button className="bg-orange-600 text-white hover:bg-orange-700">
      Enviar
    </button>
  );
}

// ✅ BIEN - Usa variables CSS
function GoodButton() {
  return (
    <button className="bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)]">
      Enviar
    </button>
  );
}
```

### ❌ ANTI-PATRÓN 2: Valores de Espaciado Inconsistentes

```jsx
// ❌ MAL - Espaciado inconsistente
function BadCard() {
  return (
    <div className="p-3 m-5 gap-2">
      <h3 className="mb-8">Título</h3>
      <p className="mb-7">Contenido</p>
    </div>
  );
}

// ✅ BIEN - Usa escala de espaciado consistente
function GoodCard() {
  return (
    <div className="p-[var(--space-4)] m-[var(--space-4)] gap-[var(--space-4)]">
      <h3 className="mb-[var(--space-4)]">Título</h3>
      <p className="mb-[var(--space-4)]">Contenido</p>
    </div>
  );
}
```

### ❌ ANTI-PATRÓN 3: Mezclar Variables y Hardcodes

```jsx
// ❌ MAL - Mezcla inconsistente
function BadForm() {
  return (
    <input
      className="bg-[var(--input-bg)] border border-gray-300 text-[var(--input-text)] px-3 py-[var(--space-2)]"
    />
  );
}

// ✅ BIEN - Consistencia completa
function GoodForm() {
  return (
    <input
      className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] px-[var(--space-3)] py-[var(--space-2)]"
    />
  );
}
```

### ❌ ANTI-PATRÓN 4: Crear Variables Innecesarias

```jsx
// ❌ MAL - Crea una variable nueva sin necesidad
// En index.css:
// --my-custom-orange: #d97706;

// ✅ BIEN - Usa la variable existente
// bg-[var(--accent-primary)]
```

### ❌ ANTI-PATRÓN 5: No Probar en Ambos Temas

```jsx
// ❌ MAL - Solo prueba en tema oscuro
// El componente se ve mal en tema claro

// ✅ BIEN - Siempre verifica en ambos temas
// 1. Cambiar a tema claro
// 2. Verificar que todo se vea bien
// 3. Cambiar a tema oscuro
// 4. Verificar que todo se vea bien
```

---

## Checklist para Componentes

Antes de hacer un commit con un nuevo componente, verifica:

```markdown
- [ ] Todos los colores usan variables CSS (`var(--...)`)
- [ ] Espaciamientos usan escala de variables (`--space-*`)
- [ ] Border radius usa escala de variables (`--radius-*`)
- [ ] Sombras usan variables CSS (`--shadow-*`)
- [ ] Tipografía usa variables (tamaños, pesos, familias)
- [ ] Estados (hover, active, disabled) están definidos
- [ ] Probé en tema claro y oscuro
- [ ] Sin hardcodes de colores (excepto imágenes/contenido)
- [ ] Responsive en mobile, tablet, desktop
- [ ] Accesibilidad verificada (contraste, focus-visible)
- [ ] Sin valores arbitrarios de Tailwind (a menos que sea necesario)
- [ ] Documenté casos de uso específicos si es complejo
```

---

## FAQ & Troubleshooting

### P: ¿Qué hago si necesito un color que no existe?

**A:** Primero, verifica si existe una variable similar. Si realmente necesitas un color nuevo:

1. Edita `src/index.css`
2. Agrega la variable en `:root` (tema claro)
3. Agrega la variable en `[data-theme="dark"]` (tema oscuro)
4. Actualiza documentación

```css
/* En src/index.css */
:root {
  --my-new-color: #your-color;
}

[data-theme="dark"],
.dark {
  --my-new-color: #your-dark-color;
}
```

### P: Las variables no se aplican en mi componente

**A:** Verifica:

1. ¿Estás dentro de `<html data-theme="...">` o `<html class="dark">`?
2. ¿Estás importando `src/index.css` en `main.tsx`?
3. ¿Usas `var(--nombre)` correcto sin espacios?
4. Abre DevTools → Elements → selecciona elemento → Styles

### P: ¿Cómo cambio los colores del tema globalmente?

**A:** Solo edita `src/index.css`:

```css
:root {
  /* Cambiar acento primario en tema claro */
  --accent-primary: #tu-nuevo-color;
}

[data-theme="dark"],
.dark {
  /* Cambiar acento primario en tema oscuro */
  --accent-primary: #tu-nuevo-color-oscuro;
}
```

Todos los componentes se actualizarán automáticamente.

### P: ¿Puedo usar variables CSS en inline styles?

**A:** Sí, completamente:

```jsx
<div style={{ backgroundColor: 'var(--bg-surface)' }}>
  {/* Contenido */}
</div>
```

Pero mejor es usar Tailwind con variables.

### P: ¿Las variables funcionan en CSS importado?

**A:** Sí, siempre que ese CSS se cargue después de `src/index.css`:

```css
/* En tu archivo.css */
.my-element {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}
```

---

## Recursos

- 📖 Documentación completa: `CSS_DESIGN_SYSTEM.md`
- 🏗️ Arquitectura del sistema: `CSS_ARCHITECTURE.md`
- 🚀 Quick start: `CSS_VARIABLES_QUICK_START.md`
- 📝 Ejemplos de código: `src/components/CSSVariablesExamples.tsx`
- 📦 Definición de variables: `src/index.css`

