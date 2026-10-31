# 🎯 Guía para Contribuidores: Accesibilidad y Atajos de Teclado

Este documento describe cómo mantener y extender las características de accesibilidad en el Cancionero.

## 📚 Estructura Actual

### Hooks de Accesibilidad

```
src/hooks/
├── useKeyboardShortcuts.ts      # Gestión central de atajos
├── useAccessibility.ts          # Utilidades de accesibilidad (focus, ARIA)
```

### Componentes de Accesibilidad

```
src/components/
├── KeyboardShortcutsModal.tsx   # Modal que muestra todos los atajos
├── SkipLink.tsx                 # Link para saltar al contenido
```

### Estilos

```
src/index.css  # Nuevas utilidades CSS de accesibilidad
```

## 🔧 Cómo Agregar Nuevos Atajos de Teclado

### 1. Definir el Atajo en `GLOBAL_SHORTCUTS`

```typescript
// src/hooks/useKeyboardShortcuts.ts
export const GLOBAL_SHORTCUTS = {
  // ... atajos existentes
  miNuevoAtajo: {
    key: 'f',
    ctrlKey: true,
    description: 'Descripción del atajo',
  },
};
```

### 2. Registrar el Atajo en App.tsx

```typescript
// src/App.tsx
useEffect(() => {
  register('mi-nuevo-atajo', {
    ...GLOBAL_SHORTCUTS.miNuevoAtajo,
    callback: () => {
      // Tu función aquí
    },
    description: GLOBAL_SHORTCUTS.miNuevoAtajo.description,
  });

  return () => {
    unregister('mi-nuevo-atajo');
  };
}, [register, unregister, /* otras dependencias */]);
```

### 3. Probar el Atajo

1. Ejecuta `npm run dev`
2. Presiona `Shift + ?` para abrir el modal de atajos
3. Verifica que tu nuevo atajo aparece en la lista correcta
4. Prueba presionando la combinación de teclas

## 🎨 Cómo Mejorar la Accesibilidad de Componentes

### Agregar Focus Visible

```css
button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### Agregar ARIA Labels

```typescript
<button 
  aria-label="Descripción accesible"
  aria-pressed={isPressed}
>
  Botón
</button>
```

### Crear Diálogos Accesibles

```typescript
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
>
  <h2 id="dialog-title">Título del Diálogo</h2>
  {/* Contenido */}
</div>
```

### Screen Reader Announcements

```typescript
const { setAriaLive } = useAccessibility();

// Más adelante en el código
setAriaLive(element, 'Cambio completado', 'polite');
```

## 🧪 Pruebas de Accesibilidad

### Pruebas Manuales

1. **Navegación por Teclado**
   - Presiona Tab repetidamente
   - Verifica que el foco sea visible siempre
   - Prueba Shift+Tab para ir hacia atrás

2. **Atajos de Teclado**
   - Prueba cada atajo presionando la combinación
   - Verifica que realiza la acción esperada
   - Abre el modal de ayuda (Shift+?)

3. **Lectores de Pantalla**
   - Usa NVDA (Windows) o VoiceOver (Mac)
   - Navega por todos los elementos
   - Verifica que todo se anuncia correctamente

### Validación Automática

```bash
# Usa estas herramientas en el navegador:
# - Axe DevTools
# - WAVE
# - Lighthouse
```

## 📋 Checklist para Nuevas Características

Cuando agregues nuevas funcionalidades, asegúrate de:

- [ ] Todos los elementos interactivos tienen estilos de focus-visible
- [ ] Todos los botones sin texto visible tienen `aria-label`
- [ ] Los diálogos tienen `role="dialog"` y `aria-modal="true"`
- [ ] Los diálogos tienen un título accesible con `aria-labelledby`
- [ ] Las formas tienen labels semánticas (`<label>`)
- [ ] Los errores se anuncian con `role="alert"` si son importantes
- [ ] Los cambios dinámicos se anuncian con `aria-live`
- [ ] La navegación por teclado completa funciona
- [ ] El código pasa `npm run lint`

## 🎓 Referencias y Recursos

### WCAG 2.1
- [Guías Oficiales](https://www.w3.org/WAI/WCAG21/quickref/)
- [Nivel A (Requerido)](https://www.w3.org/WAI/WCAG21/quickref/#perspective-videos)
- [Nivel AA (Recomendado)](https://www.w3.org/WAI/WCAG21/quickref/#principle2)

### React Accessibility
- [React Documentación](https://react.dev/learn/accessibility)
- [Patrones de Componentes](https://www.w3.org/WAI/ARIA/apg/)

### WebAIM
- [Artículos y Tutoriales](https://webaim.org/)
- [Testing Tools](https://webaim.org/resources/)

### Documentación del Proyecto
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - Guía técnica completa
- [KEYBOARD_SHORTCUTS_GUIDE.md](./KEYBOARD_SHORTCUTS_GUIDE.md) - Guía para usuarios
- [TESTING_ACCESSIBILITY.md](./TESTING_ACCESSIBILITY.md) - Guía de pruebas

## 🚀 Prácticas Recomendadas

### DO's ✅

- ✅ Usa roles ARIA semánticamente correctos
- ✅ Proporciona siempre una forma alternativa sin JavaScript
- ✅ Prueba con herramientas reales (no solo automatizadas)
- ✅ Documenta características de accesibilidad
- ✅ Considera diferentes dispositivos y navegadores
- ✅ Respeta las preferencias del usuario del SO
- ✅ Usa colores con suficiente contraste

### DON'Ts ❌

- ❌ No suprimas outlines de focus predeterminados sin reemplazarlos
- ❌ No uses JavaScript para interactividad sin alternativas accesibles
- ❌ No confíes solo en color para transmitir información
- ❌ No olvides las labels de form inputs
- ❌ No crees trampas de foco accidental
- ❌ No ignores las preferencias de accesibilidad del usuario

## 📞 Preguntas Frecuentes

### ¿Cómo agrego un atajo que conflicta con el navegador?

Los atajos actuales están diseñados para no conflictar. Si necesitas uno que lo haga, considera:
1. Cambiar la combinación de teclas
2. Hacer que el atajo se pueda personalizar
3. Documentar claramente el conflicto

### ¿Qué hago si un cambio rompe la accesibilidad?

1. Revierte el cambio inmediatamente
2. Prueba la accesibilidad manualmente antes de mergear
3. Agrega una prueba automatizada si es posible
4. Documenta la lección aprendida

### ¿Cómo optimizo el rendimiento sin sacrificar accesibilidad?

- Los atajos de teclado son muy eficientes
- Los ARIA attributes no impactan rendimiento
- Las animaciones con `prefers-reduced-motion` pueden ayudar al rendimiento
- Usa `React.memo` para componentes que no cambian a menudo

## 🤝 Contribuciones

Las contribuciones de accesibilidad son muy bienvenidas:

1. Reporta problemas de accesibilidad
2. Sugiere mejoras
3. Contribuye código que mejore la accesibilidad
4. Ayuda a documentar patrones
5. Prueba en diferentes navegadores y dispositivos

---

**Gracias por ayudar a hacer el Cancionero más accesible para todos. ♿💙**
