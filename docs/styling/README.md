# 🎨 Styling & CSS

Sistema completo de variables CSS, arquitectura de estilos y mejores prácticas de diseño.

## 📖 Contenidos

- **[CSS_DESIGN_SYSTEM.md](CSS_DESIGN_SYSTEM.md)** - Sistema de diseño visual completo
- **[CSS_VARIABLES_QUICK_START.md](CSS_VARIABLES_QUICK_START.md)** - Cómo usar variables CSS
- **[CSS_BEST_PRACTICES.md](CSS_BEST_PRACTICES.md)** - Mejores prácticas y convenciones
- **[CSS_ARCHITECTURE.md](CSS_ARCHITECTURE.md)** - Arquitectura y organización
- **[CSS_VARIABLES_INDEX.md](CSS_VARIABLES_INDEX.md)** - Índice completo de variables
- **[CSS_VARIABLES_SUMMARY.md](CSS_VARIABLES_SUMMARY.md)** - Resumen rápido de variables

## 🎯 Empieza por Aquí

### Para Diseñadores
1. Lee [CSS_DESIGN_SYSTEM.md](CSS_DESIGN_SYSTEM.md) para entender la paleta y componentes
2. Consulta [CSS_VARIABLES_INDEX.md](CSS_VARIABLES_INDEX.md) para colores y espaciado

### Para Desarrolladores
1. Comienza con [CSS_VARIABLES_QUICK_START.md](CSS_VARIABLES_QUICK_START.md)
2. Revisa [CSS_BEST_PRACTICES.md](CSS_BEST_PRACTICES.md) antes de escribir estilos
3. Usa [CSS_VARIABLES_INDEX.md](CSS_VARIABLES_INDEX.md) como referencia durante desarrollo

### Para Contribuidores
- Lee [CSS_ARCHITECTURE.md](CSS_ARCHITECTURE.md) para entender la estructura
- Sigue las prácticas en [CSS_BEST_PRACTICES.md](CSS_BEST_PRACTICES.md)

## 💡 Variables Principales

El sistema incluye **130+ variables CSS** para:
- **Colores** - Paleta clara/oscura
- **Tipografía** - Tamaños, pesos, alturas de línea
- **Espaciado** - Margen, padding, gaps
- **Sombras** - Depth y elevación
- **Componentes** - Botones, tarjetas, modales

## 🌓 Tema Automático

Todas las variables soportan cambio automático entre modo claro/oscuro:
```css
/* Definido en src/index.css */
:root { /* Modo claro */ }
:root.dark { /* Modo oscuro */ }
```
