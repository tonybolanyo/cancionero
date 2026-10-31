# 🎯 Índice de Accesibilidad - Cancionero

**Última actualización**: Octubre 2026  
**Versión**: 1.0.0  
**Estado**: ✅ En Producción

---

## 📖 Documentación de Accesibilidad

Esta es tu puerta de entrada a toda la información sobre accesibilidad en el Cancionero.

### Para Usuarios 👥

Si eres un usuario y quieres saber qué atajos de teclado están disponibles:

**→ Comienza con** [`KEYBOARD_SHORTCUTS_GUIDE.md`](./KEYBOARD_SHORTCUTS_GUIDE.md)
- Guía rápida de atajos
- Tips para navegación por teclado
- Información de compatibilidad con lectores de pantalla
- Ejemplos de flujos de trabajo

### Para Desarrolladores 👨‍💻

Si eres un desarrollador que quiere entender cómo funciona la accesibilidad:

**→ Nivel 1: Fundamentos** → [`ACCESSIBILITY.md`](./ACCESSIBILITY.md)
- Descripción general de características
- Cómo funcionan los atajos de teclado
- Arquitectura de componentes
- Mejoras WCAG implementadas

**→ Nivel 2: Contribución** → [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md)
- Cómo agregar nuevos atajos
- Patrones para componentes accesibles
- Checklist para nuevas características
- Prácticas recomendadas

### Para Testers 🧪

Si necesitas probar la accesibilidad:

**→ Pruebas** → [`TESTING_ACCESSIBILITY.md`](./TESTING_ACCESSIBILITY.md)
- Casos de prueba paso a paso
- Herramientas recomendadas
- Criterios de éxito
- Tips de debugging

---

## 🗂️ Estructura de Archivos

```
Documentación de Accesibilidad
├── ACCESSIBILITY_INDEX.md (este archivo)
│   └─ Guía de navegación
│
├── KEYBOARD_SHORTCUTS_GUIDE.md ⭐ COMIENZA AQUÍ
│   └─ Guía de usuario
│
├── ACCESSIBILITY.md
│   └─ Guía técnica completa
│
├── CONTRIBUTING_ACCESSIBILITY.md
│   └─ Guía para desarrolladores
│
└── TESTING_ACCESSIBILITY.md
    └─ Guía de pruebas

Código Fuente de Accesibilidad
├── src/hooks/
│   ├── useKeyboardShortcuts.ts
│   └── useAccessibility.ts
│
├── src/components/
│   ├── KeyboardShortcutsModal.tsx
│   └── SkipLink.tsx
│
└── src/index.css
    └─ Utilidades de accesibilidad CSS
```

---

## 🎯 Guía Rápida por Rol

### Soy Usuario 👤
**Quiero**: Saber qué atajos de teclado existen  
**Acción**: Presiona `Shift + ?` en la app  
**Alternativa**: Lee [`KEYBOARD_SHORTCUTS_GUIDE.md`](./KEYBOARD_SHORTCUTS_GUIDE.md)

### Soy Desarrollador Frontend 💻
**Quiero**: Entender cómo está implementada la accesibilidad  
**Acción**: Lee [`ACCESSIBILITY.md`](./ACCESSIBILITY.md)  
**Luego**: Lee [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md)

### Soy Reviewer 🔍
**Quiero**: Verificar que los cambios mantienen accesibilidad  
**Checklist**: Usa [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md) sección "Checklist"  
**Pruebas**: Consulta [`TESTING_ACCESSIBILITY.md`](./TESTING_ACCESSIBILITY.md)

### Soy QA / Tester 🧪
**Quiero**: Probar la accesibilidad sistemáticamente  
**Acción**: Sigue [`TESTING_ACCESSIBILITY.md`](./TESTING_ACCESSIBILITY.md)

### Soy Diseñador UX 🎨
**Quiero**: Entender cómo diseñar componentes accesibles  
**Acción**: Lee sección "Cómo Mejorar la Accesibilidad" en [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md)

---

## 📊 Resumen de Características

### Atajos de Teclado Implementados

| Categoría | Atajos |
|-----------|--------|
| **Gestión de Canciones** | Ctrl+N, Ctrl+S, Ctrl+Shift+P |
| **Apariencia** | Ctrl+T |
| **Sincronización** | Ctrl+G |
| **Edición** | Ctrl+Z, Ctrl+Shift+Z |
| **Navegación** | Tab, Shift+Tab, Esc |
| **Ayuda** | Shift+? |

**Total**: 9 atajos implementados

### Características WCAG 2.1

- ✅ **Level A**: Navegación completa por teclado
- ✅ **Focus Management**: Indicadores claros
- ✅ **ARIA Labels**: En todos los botones
- ✅ **Skip Links**: Saltar al contenido
- ✅ **Screen Reader**: Soporte completo
- ✅ **Contraste Alto**: Modo soportado
- ✅ **Reducción de Movimiento**: Respetada

---

## 🔗 Enlaces Importantes

### Documentación Interna
- [KEYBOARD_SHORTCUTS_GUIDE.md](./KEYBOARD_SHORTCUTS_GUIDE.md) - Atajos y tips
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - Detalles técnicos
- [CONTRIBUTING_ACCESSIBILITY.md](./CONTRIBUTING_ACCESSIBILITY.md) - Patrones
- [TESTING_ACCESSIBILITY.md](./TESTING_ACCESSIBILITY.md) - Pruebas

### Estándares WCAG
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WCAG 2.1 Understanding](https://www.w3.org/WAI/WCAG21/Understanding/)

### Herramientas
- [Axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Comunidad
- [WebAIM](https://webaim.org/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

## 🚀 Roadmap de Accesibilidad

### ✅ Completado (v1.0)
- Sistema de atajos de teclado
- Skip Links
- Focus management mejorado
- ARIA labels y roles
- Soporte para preferencias del SO
- Documentación completa

### 🎯 Próximo (v1.1)
- Pruebas automáticas con jest-axe
- Soporte para más atajos personalizables
- Mejorar navegación en tablas

### 🔮 Futuro (v2.0)
- Temas de alto contraste personalizables
- Soporte para zoom del navegador
- Anuncios accesibles en tiempo real

---

## 💬 Soporte y Reportes

### Reportar un Problema
1. Revisa [`TESTING_ACCESSIBILITY.md`](./TESTING_ACCESSIBILITY.md) para verificar que es un problema real
2. Incluye detalles: navegador, SO, lector de pantalla (si aplica)
3. Describe los pasos para reproducir
4. Abre un issue en GitHub

### Sugerir Mejoras
1. Abre una discusión en GitHub
2. Describe qué quieres mejorar y por qué
3. Comparte ejemplos o mockups si es posible
4. Participa en la discusión

### Contribuir Código
1. Lee [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md)
2. Sigue el checklist de accesibilidad
3. Realiza pruebas con [`TESTING_ACCESSIBILITY.md`](./TESTING_ACCESSIBILITY.md)
4. Abre un Pull Request con descripción clara

---

## 📝 Notas Importantes

- 🎯 **Prioridad**: La accesibilidad es una prioridad de primera clase
- 🔐 **Compatibilidad**: Todos los cambios mantienen compatibilidad hacia atrás
- 📱 **Multiplataforma**: Funciona en Windows, Mac, Linux
- 🌐 **Navegadores**: Chrome, Firefox, Safari, Edge
- ♿ **Estándar**: Sigue WCAG 2.1 Level A como mínimo
- 🚀 **Extensible**: Fácil de agregar nuevas características

---

## 📞 Contacto y Contribuciones

**Preguntas sobre accesibilidad?** → Abre un issue en GitHub  
**Quieres contribuir?** → Lee [`CONTRIBUTING_ACCESSIBILITY.md`](./CONTRIBUTING_ACCESSIBILITY.md)  
**Encontraste un bug?** → Reportalo con detalles en GitHub  

---

<div align="center">

### 🎉 Gracias por ayudar a hacer el Cancionero accesible para todos

**Presiona `Shift + ?` en la app para ver los atajos disponibles**

</div>

---

**Última actualización**: Octubre 31, 2026  
**Mantenedor**: Equipo de Cancionero  
**Estado**: Listo para producción ✅
