# 🎨 CSS Variables Quick Start Guide

Guía rápida para usar el nuevo sistema de variables CSS en Cancionero.

## Inicio Rápido

Todas las variables CSS están disponibles en `src/index.css`. El sistema soporta automáticamente temas claro y oscuro.

### Cambiar de Tema

El cambio de tema es automático mediante el componente `ThemeContext` en la aplicación. El usuario puede cambiar entre temas claro y oscuro usando el botón de toggle en el header.

## Colores Principales

### Modo Claro 🌞
- **Acento**: Naranja (`#d97706`)
- **Texto**: Marrón oscuro (`#1c1917`)
- **Fondo**: Crema (`#f8f6f0`)

### Modo Oscuro 🌙
- **Acento**: Ámbar dorado (`#fbbf24`)
- **Texto**: Blanco cremoso (`#f3f4f6`)
- **Fondo**: Carbón (`#0c0d10`)

## Usando Variables en Componentes

### Fondos y Superficies

```jsx
// Fondo de página
<div className="bg-[var(--bg-canvas)]">...</div>

// Superficie elevada
<div className="bg-[var(--bg-surface)]">...</div>

// Superficie con hover
<div className="bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-hover)]">...</div>
```

### Texto

```jsx
// Texto principal (máximo contraste)
<p className="text-[var(--text-primary)]">Importante</p>

// Texto secundario (menos énfasis)
<p className="text-[var(--text-secondary)]">Información</p>

// Texto silenciado (baja importancia)
<p className="text-[var(--text-muted)]">Detalles</p>
```

### Bordes

```jsx
// Borde sutil (divisores suaves)
<div className="border border-[var(--border-subtle)]">...</div>

// Borde normal (énfasis moderado)
<input className="border border-[var(--input-border)] focus:border-[var(--input-border-focus)]" />

// Borde fuerte (énfasis máximo)
<div className="border-2 border-[var(--border-strong)]">...</div>
```

## Botones

### Botón Primario

```jsx
<button className="px-4 py-2 bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)] active:bg-[var(--button-primary-active-bg)] rounded-lg transition-colors">
  Enviar
</button>
```

### Botón Secundario

```jsx
<button className="px-4 py-2 bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] hover:bg-[var(--button-secondary-hover-bg)] rounded-lg transition-colors">
  Cancelar
</button>
```

### Botón Deshabilitado

```jsx
<button disabled className="px-4 py-2 bg-[var(--button-primary-disabled-bg)] text-[var(--button-primary-disabled-text)] cursor-not-allowed rounded-lg">
  Deshabilitado
</button>
```

## Formularios

### Input

```jsx
<input
  className="px-3 py-2 bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] placeholder-[var(--input-placeholder)] rounded-lg focus:outline-none focus:border-[var(--input-border-focus)]"
  placeholder="Escribe aquí"
/>
```

### Textarea

```jsx
<textarea
  className="px-3 py-2 bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] rounded-lg resize-none focus:outline-none focus:border-[var(--input-border-focus)]"
  placeholder="Mensaje..."
/>
```

## Cards & Componentes

### Card Base

```jsx
<div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 shadow-[var(--shadow-card)]">
  {/* Contenido */}
</div>
```

### Card Interactive (con hover)

```jsx
<div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--card-hover-border)] transition-all cursor-pointer">
  {/* Contenido */}
</div>
```

## Badges

### Badge Primario

```jsx
<span className="inline-block px-3 py-1 bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] border border-[var(--badge-primary-border)] rounded-full text-xs font-semibold">
  Featured
</span>
```

## Mensajes de Estado

### Éxito ✓

```jsx
<div className="bg-[var(--state-success-bg)] border-l-4 border-[var(--state-success-border)] rounded p-4">
  <p className="text-[var(--state-success-text)] font-semibold">✓ Operación exitosa</p>
</div>
```

### Error ✗

```jsx
<div className="bg-[var(--state-error-bg)] border-l-4 border-[var(--state-error-border)] rounded p-4">
  <p className="text-[var(--state-error-text)] font-semibold">✗ Error: Algo salió mal</p>
</div>
```

### Advertencia ⚠

```jsx
<div className="bg-[var(--state-warning-bg)] border-l-4 border-[var(--state-warning-border)] rounded p-4">
  <p className="text-[var(--state-warning-text)] font-semibold">⚠ Advertencia importante</p>
</div>
```

### Información ℹ

```jsx
<div className="bg-[var(--state-info-bg)] border-l-4 border-[var(--state-info-border)] rounded p-4">
  <p className="text-[var(--state-info-text)] font-semibold">ℹ Nueva información</p>
</div>
```

## Tipografía

### Tamaños

```jsx
// Extra pequeño
<span className="text-[var(--font-size-xs)]">xs</span>

// Pequeño
<p className="text-[var(--font-size-sm)]">sm</p>

// Base (16px)
<p className="text-[var(--font-size-base)]">base</p>

// Grande
<h3 className="text-[var(--font-size-lg)]">lg</h3>

// Muy grande
<h2 className="text-[var(--font-size-2xl)]">2xl</h2>

// Enorme
<h1 className="text-[var(--font-size-4xl)]">4xl</h1>
```

### Pesos

```jsx
<span className="font-[var(--font-weight-light)]">Luz</span>
<span className="font-[var(--font-weight-normal)]">Normal</span>
<span className="font-[var(--font-weight-semibold)]">Semibold</span>
<span className="font-[var(--font-weight-bold)]">Bold</span>
```

### Familias

```jsx
// Sans serif (UI, texto general)
<div className="font-[var(--font-sans)]">Contenido general</div>

// Serif (Títulos, marca)
<h1 className="font-[var(--font-serif)]">Título Editorial</h1>

// Monospace (Código)
<code className="font-[var(--font-mono)]">const x = 10;</code>
```

## Espaciamientos

```jsx
// Padding
<div className="p-[var(--space-4)]">16px padding</div>

// Margin
<div className="mb-[var(--space-6)]">24px margin-bottom</div>

// Gap (flex/grid)
<div className="flex gap-[var(--space-2)]">...</div>

// Combine espacios
<div className="p-[var(--space-6)] mb-[var(--space-4)]">...</div>
```

## Border Radius

```jsx
// Pequeño redondeo (botones, inputs pequeños)
<button className="rounded-[var(--radius-md)]">Botón</button>

// Redondeo moderado (cards)
<div className="rounded-[var(--radius-lg)]">Card</div>

// Redondeo máximo (avatares, badges)
<span className="rounded-[var(--radius-full)]">●</span>
```

## Sombras

```jsx
// Sombra mínima
<div className="shadow-[var(--shadow-xs)]">...</div>

// Sombra de card normal
<div className="shadow-[var(--shadow-card)]">Card</div>

// Sombra al hacer hover
<div className="hover:shadow-[var(--shadow-card-hover)]">Interactive</div>

// Sombra de modal/dropdown
<div className="shadow-[var(--shadow-xl)]">Modal</div>
```

## Ejemplos Reales

### Componente de Song Card

```jsx
function SongCard({ title, artist }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-lg)] p-[var(--space-6)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--card-hover-border)] transition-all">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)] font-[var(--font-serif)]">
        {title}
      </h3>
      <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)] mt-[var(--space-1)]">
        {artist}
      </p>
      <div className="flex gap-[var(--space-2)] mt-[var(--space-4)]">
        <button className="flex-1 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover-bg)] rounded-[var(--radius-md)] transition-colors text-[var(--font-size-sm)] font-[var(--font-weight-semibold)]">
          Play
        </button>
      </div>
    </div>
  );
}
```

### Componente de Search Input

```jsx
function SearchInput() {
  return (
    <input
      type="text"
      placeholder="Buscar canciones..."
      className="w-full px-[var(--space-4)] py-[var(--space-3)] bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] rounded-[var(--radius-lg)] placeholder-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-colors text-[var(--font-size-base)]"
    />
  );
}
```

## Verificar Variables en DevTools

Para ver las variables CSS en el navegador:

1. Abre DevTools (F12)
2. Selecciona un elemento
3. Ve a la sección Styles
4. Busca `--bg-surface`, `--text-primary`, etc.
5. Los valores mostrados dependerán del tema actual

## Mejores Prácticas

1. **Usa variables, no hardcodees colores**
   ```jsx
   // ✅ Bien
   className="text-[var(--text-primary)]"
   
   // ❌ Evitar
   className="text-gray-900 dark:text-gray-100"
   ```

2. **Agrupa estados de componentes**
   ```jsx
   // ✅ Bien - Estados relacionados juntos
   bg-[var(--button-primary-bg)]
   hover:bg-[var(--button-primary-hover-bg)]
   active:bg-[var(--button-primary-active-bg)]
   
   // ❌ Evitar - Sin relación clara
   bg-orange-600 hover:bg-orange-700
   ```

3. **Usa spacing variables para consistencia**
   ```jsx
   // ✅ Bien - Espaciado consistente
   gap-[var(--space-4)] p-[var(--space-6)]
   
   // ❌ Evitar - Valores arbitrarios
   gap-5 p-7
   ```

4. **Prueba en ambos temas**
   - Siempre verifica que tus cambios se vean bien en modo claro y oscuro
   - Usa el toggle de tema en el header para probar

## Troubleshooting

### Las variables no se aplican
- Verifica que el elemento está dentro del `<html data-theme="...">` o `<html class="dark">`
- Asegúrate de que `src/index.css` está importado en `src/main.tsx`

### El color no cambia al cambiar tema
- Comprueba que estés usando variables CSS (`var(--...)`) y no hardcodes
- Recarga la página después de cambiar el tema
- Abre DevTools y verifica que la variable está definida

### Las sombras no se ven
- Las sombras pueden ser más sutiles en modo claro
- En modo oscuro son más pronunciadas para profundidad
- Esto es intencional para el diseño visual

## Archivo de Documentación Completa

Para una referencia completa con todas las variables disponibles, ver:
- `CSS_DESIGN_SYSTEM.md` - Documentación exhaustiva
- `src/components/CSSVariablesExamples.tsx` - Ejemplos de código

## Preguntas Frecuentes

**P: ¿Cómo agrego una nueva variable CSS?**
A: Edita `src/index.css` en las secciones `:root` (claro) y `[data-theme="dark"]` (oscuro).

**P: ¿Puedo cambiar los colores del tema?**
A: Sí, edita los valores en `src/index.css`. Los cambios se aplicarán automáticamente a toda la aplicación.

**P: ¿Cómo creo un color consistente para mi nuevo componente?**
A: Si necesitas un nuevo color, agrégalo en ambas secciones (claro y oscuro) de `src/index.css`.

**P: ¿Las variables CSS funcionan en CSS personalizado?**
A: Sí, totalmente. Puedes usar `var(--variable-name)` en cualquier archivo CSS.
