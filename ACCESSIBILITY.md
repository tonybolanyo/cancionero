# Accesibilidad y Atajos de Teclado - Cancionero

## Resumen de Mejoras

Se han implementado mejoras significativas en accesibilidad (WCAG) y se han agregado atajos de teclado para mejorar la experiencia del usuario, especialmente para usuarios de navegación por teclado.

## 📋 Atajos de Teclado Globales

### Gestión de Canciones
- **Ctrl+N**: Crear nueva canción (solo para autores)
- **Ctrl+S**: Guardar cambios
- **Ctrl+Shift+P**: Publicar canción

### Navegación
- **/**: Abrir búsqueda (disponible en próximas versiones)
- **Esc**: Cerrar modal o diálogo

### Apariencia
- **Ctrl+T**: Cambiar tema (claro/oscuro)

### Sincronización
- **Ctrl+G**: Sincronizar con Git

### Edición
- **Ctrl+Z**: Deshacer
- **Ctrl+Shift+Z**: Rehacer

### Ayuda
- **Shift+?**: Mostrar este panel de atajos de teclado

## 🎯 Características de Accesibilidad

### 1. Skip Links
- Se agregó un "Skip Link" invisible que solo aparece con Tab
- Permite saltar al contenido principal sin navegar por toda la navegación
- Accesible presionando Tab al cargar la página

### 2. Focus Management
- Todos los elementos interactivos tienen estilos de focus-visible claros
- Outline de 2px en color primario del acento
- Offset de 2px para mejor visibilidad

### 3. ARIA Labels y Roles
- Se han agregado etiquetas `aria-label` en componentes sin texto visible
- Roles ARIA apropiados para diálogos y alertas
- Atributos `aria-live` para anuncios dinámicos

### 4. Modo de Contraste Alto
- Soporte para preferencia de contraste alto del sistema
- Bordes más visibles en modo de alto contraste

### 5. Reducción de Movimiento
- Respeta la preferencia `prefers-reduced-motion` del usuario
- Desactiva animaciones para usuarios sensibles

### 6. Screen Reader Support
- Clase `.sr-only` para contenido solo para lectores de pantalla
- Focus management dentro de modales
- Diálogos modales con `role="dialog"` y `aria-modal="true"`

## 📁 Archivos Nuevos

### Hooks
- **`src/hooks/useKeyboardShortcuts.ts`**: Hook central para gestionar atajos de teclado
  - Registro/desregistro dinámico de atajos
  - Manejo global de eventos de teclado
  - Definición centralizada de atajos

- **`src/hooks/useAccessibility.ts`**: Utilidades de accesibilidad
  - Gestión de foco (focus trap)
  - Anuncios ARIA Live
  - Funciones helper para botones accesibles

### Componentes
- **`src/components/KeyboardShortcutsModal.tsx`**: Modal que muestra todos los atajos
  - Organizado por categorías
  - Muestra combinaciones de teclas formateadas
  - Se abre con Shift+?

- **`src/components/SkipLink.tsx`**: Link para saltar al contenido principal
  - Invisible por defecto
  - Visible con focus
  - Acceso inmediato al contenido principal

### Estilos
- **`src/index.css`**: Nuevas utilidades de accesibilidad
  - Clases `.sr-only` y `.focus:not-sr-only`
  - Estilos de focus-visible mejorados
  - Media queries para `prefers-reduced-motion`
  - Media queries para `prefers-contrast`

## 🔧 Cambios en Componentes Existentes

### `src/App.tsx`
- Integración de hooks de accesibilidad
- Registro de atajos de teclado globales
- Adición de Skip Link al inicio
- Adición del KeyboardShortcutsModal

### `src/index.css`
- Nuevas utilidades CSS para accesibilidad
- Estilos mejorados de focus
- Soporte para preferencias del sistema

## 🧪 Pruebas de Accesibilidad Recomendadas

1. **Navegación por Teclado**
   - Presiona Tab para navegar por todos los elementos
   - Verifica que el foco sea visible en todo momento
   - Prueba los atajos de teclado listados

2. **Lector de Pantalla**
   - Prueba con NVDA (Windows) o VoiceOver (Mac)
   - Verifica que todos los botones tengan etiquetas accesibles
   - Comprueba que los diálogos sean anunciados correctamente

3. **Herramientas de Validación**
   - Axe DevTools
   - Lighthouse
   - WAVE (WebAIM)

4. **Preferencias del Sistema**
   - Habilita "Reducir movimiento" en OS y verifica que las animaciones se desactiven
   - Habilita "Contraste alto" y verifica la visibilidad

## 📦 Cambios en Dependencias

El archivo `package-lock.json` ha sido actualizado para asegurar que todas las dependencias estén correctamente instaladas y que el despliegue a GitHub Pages sea consistente.

## 🚀 Próximas Mejoras Sugeridas

1. Agregar labels semánticas a todos los inputs de formularios
2. Implementar live regions para notificaciones en tiempo real
3. Mejorar la navegación del teclado en tablas de datos
4. Agregar pruebas automáticas de accesibilidad con jest-axe
5. Crear documentación de patrones de accesibilidad para futuros componentes

## 📚 Referencias

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility](https://react.dev/learn/accessibility)
