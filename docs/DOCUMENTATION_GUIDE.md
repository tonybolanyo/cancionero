# 📚 Guía de Generación de Documentación

**Esta guía ayuda a Copilot, Google AI Studio y otros asistentes a generar documentación coherente y bien organizada para este proyecto.**

---

## 📋 Estructura de Documentación Actual

```
docs/
├── README.md                           # Índice principal de /docs
├── getting-started/                    # Para usuarios nuevos
│   ├── README.md                       # Índice de esta sección
│   ├── QUICKSTART.md                   # Setup en 5 minutos
│   ├── CHEATSHEET.md                   # Referencia rápida
│   └── KEYBOARD_SHORTCUTS_GUIDE.md     # Atajos de teclado
├── features/                           # Características del proyecto
│   ├── README.md                       # Índice de características
│   └── FOOTER_PREVIEW.md               # Detalles de features específicas
├── development/                        # Para desarrolladores
│   ├── README.md                       # Índice de desarrollo
│   ├── SECRETS_CONFIGURATION.md        # Variables de entorno
│   ├── COMMIT_GUIDE.md                 # Convenciones de commits
│   ├── IMPLEMENTATION_SUMMARY.md       # Arquitectura
│   ├── IMPLEMENTATION_REPORT.md        # Análisis técnico
│   └── IMPLEMENTATION_SUMMARY_VERSIONING.md
├── deployment/                         # Despliegue y DevOps
│   ├── README.md                       # Índice de despliegue
│   ├── README_DEPLOYMENT.md            # GitHub Pages paso a paso
│   ├── GITHUB_PAGES_CLOUDFLARE_SETUP.md
│   ├── SEO_QUICKSTART.md
│   ├── SEO_IMPLEMENTATION.md
│   └── SEO_INDEX.md
├── styling/                            # Sistema CSS
│   ├── README.md                       # Índice de CSS
│   ├── CSS_DESIGN_SYSTEM.md            # Diseño visual
│   ├── CSS_VARIABLES_QUICK_START.md    # Cómo usar variables
│   ├── CSS_BEST_PRACTICES.md           # Prácticas recomendadas
│   ├── CSS_ARCHITECTURE.md             # Organización de estilos
│   ├── CSS_VARIABLES_INDEX.md          # Lista completa de variables
│   └── CSS_VARIABLES_SUMMARY.md        # Resumen rápido
├── accessibility/                      # A11y
│   ├── README.md                       # Índice de a11y
│   ├── ACCESSIBILITY.md                # Guía completa
│   ├── ACCESSIBILITY_INDEX.md
│   ├── TESTING_ACCESSIBILITY.md
│   └── CONTRIBUTING_ACCESSIBILITY.md
├── automation/                         # GitHub Actions y CI/CD
│   ├── README.md                       # Índice de automatización
│   └── (documentación de workflows)
├── changelog/                          # Versionado y releases
│   ├── README.md                       # Índice de changelog
│   ├── VERSIONING.md                   # Versionado semántico
│   ├── SEMANTIC_VERSIONING_SETUP.md
│   ├── VERSIONING_FLOW_DIAGRAM.md
│   ├── VERSIONING_VERIFICATION_CHECKLIST.md
│   └── CHANGES.md
└── content/                            # Gestión de contenido
    ├── README.md                       # Índice de contenido
    └── (documentación de canciones)
```

---

## 📐 Estándares de Estructura

### 1. **Encabezados y Jerarquía**

- `# ` = Título principal (coincide con tema de la sección)
- `## ` = Subsecciones grandes (típicamente 3-5 por documento)
- `### ` = Subsecciones pequeñas (dentro de una subsección grande)
- `#### ` = Detalles específicos (evitar si es posible)

**Ejemplo:**
```markdown
# 🎨 Styling & CSS

## 📖 Contenidos
- Lista de archivos

## 🎯 Empieza por Aquí
### Para Diseñadores
...
### Para Desarrolladores
...

## 💡 Variables Principales
```

### 2. **Emojis Consistentes**

Usa estos emojis para mantener coherencia visual:

| Emoji | Uso | Ejemplo |
|-------|-----|---------|
| 📚 | Documentación, índices | `## 📚 Documentación` |
| 📖 | Contenidos, archivos | `## 📖 Contenidos` |
| 🎯 | Inicio rápido, metas | `## 🎯 Empieza por Aquí` |
| 👤 / 👥 | Usuarios, roles | `### Para Usuarios` |
| 👨‍💻 | Desarrolladores | `### Para Desarrolladores` |
| 🏗️ | Arquitectura | `## 🏗️ Arquitectura` |
| 🔧 | Configuración, setup | `## 🔧 Configuración` |
| 💡 | Tips, ideas, conceptos | `## 💡 Conceptos Clave` |
| 🔗 | Véase también, links | `## 🔗 Véase También` |
| ✅ | Checklists, validación | `## ✅ Checklist` |
| ⚙️ | Configuración técnica | `## ⚙️ Configuración` |
| 📊 | Datos, métricas | `## 📊 Métricas` |
| 🚀 | Inicio, deployment | `## 🚀 Comienza Aquí` |
| ⚡ | Rápido, performance | `## ⚡ Performance` |

### 3. **Secciones Estándar por Tipo**

#### Para Archivos README.md en Directorios:

```markdown
# 🎨 [Tema Principal]

[Descripción breve]

## 📖 Contenidos
- **[archivo.md](archivo.md)** - Descripción breve
- **[otro.md](otro.md)** - Descripción

## 🎯 Empieza por Aquí

### Para [Rol 1]
1. Comienza con...
2. Luego...

### Para [Rol 2]
1. Comienza con...

## [Sección de Conceptos]
Explicar idea central

## 🔗 Véase También
- [../otra-seccion/](../otra-seccion/) - Descripción
```

#### Para Archivos de Contenido Profundo:

```markdown
# 📖 [Título]

> Descripción breve o propósito

## Tabla de Contenidos
1. [Sección 1](#sección-1)
2. [Sección 2](#sección-2)

## Sección 1
Contenido detallado...

### Subsección 1.1
Más detalle...

## 🔗 Referencias
- Link a documentación relacionada
```

### 4. **Tablas para Comparativas**

Cuando haya opciones o comparativas, usar tablas:

```markdown
| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Opción A | Pro 1, Pro 2 | Con 1, Con 2 |
| Opción B | Pro 1, Pro 2 | Con 1, Con 2 |
```

### 5. **Bloques de Código**

- Especificar siempre el lenguaje: ` ```bash `, ` ```typescript `, etc.
- Comentarios inline para código complejo
- Ejemplos cortos, concisos
- Si es muy largo, mencionar archivo + líneas: `src/utils.ts:42-60`

```bash
# Comentario explicativo
command --flag valor
```

### 6. **Avisos y Destacados**

```markdown
> 🔒 **Importante**: Mensajes de seguridad o críticos

> ⚠️ **Advertencia**: Precauciones o cambios disruptivos

> 💡 **Tip**: Consejos y optimizaciones

> ℹ️ **Nota**: Información adicional opcional
```

### 7. **Listas y Numeración**

- Usar `*` para listas no ordenadas (no `-`)
- Usar `1.`, `2.`, etc. para ordenadas
- Mantener indentación con 2 espacios para sublistas

```markdown
* Punto principal
  * Subpunto
    * Sub-subpunto
```

---

## 🏗️ Patrones de Organización

### Estructura por Rol (Usuario vs Developer vs Admin)

Cuando un documento aplique a múltiples roles, organizar así:

```markdown
## 🎯 Empieza por Aquí

### Para [Rol A]
1. Paso A1
2. Paso A2

### Para [Rol B]
1. Paso B1
2. Paso B2

### Para [Rol C]
(No aplica)
```

### Estructura de Guías Paso a Paso

```markdown
## [Tarea]

### Paso 1: [Acción]
Explicación...
```bash
comando
```

### Paso 2: [Acción]
Explicación...
```

### Resultado
Qué debe verse/funcionar

### Verificación
Cómo comprobar que funcionó
```

### Documentación de Variables/Configuración

```markdown
## [Nombre de Variable]

**Descripción**: Para qué sirve

**Valor**: Tipo de dato esperado

**Ejemplo**:
```env
NAME=valor
```

**Ubicación**: Dónde va configurado (`.env`, `vite.config.ts`, etc.)

**Requerido**: Sí/No

**Por defecto**: valor-defecto
```

---

## ✏️ Convenciones de Escritura

### Tono y Lenguaje

* Usar **español claro y conciso**
* Dirigirse al lector como "tú" o imperativo ("Lee", "Haz", etc.)
* Evitar jerga innecesaria; si es técnica, explicar brevemente
* Mantener párrafos cortos (máx 3-4 líneas)
* Una idea por párrafo

### Ortografía y Formato

* **Markdown**: 
  * **Negrita** para palabras clave
  * `código` para referencias a código/archivos
  * [Links](url) para referencias cruzadas
* Mantener enlaces relativos: `[Link](../otra-carpeta/archivo.md)`
* Usar `código.md` con backticks para archivos
* Rutas: `/docs/styling/` con slashes

### Ejemplos

**Mal** ❌:
```markdown
Es muy importante que entiendas que tienes que ir a la documentación y 
después tienes que leer el archivo de configuración que está en tal sitio 
y allí encontrarás la información.
```

**Bien** ✅:
```markdown
Lee [SECRETS_CONFIGURATION.md](SECRETS_CONFIGURATION.md) para configurar variables de entorno.
```

---

## 🔄 Cuándo Crear Nuevo Documento

Crear un nuevo archivo cuando:

* El tema no cabe en sección existente
* La longitud excedería 500 líneas
* Es un topic completamente independiente
* Múltiples roles lo necesitarían por separado

**NO** crear archivo cuando:

* Es un subtema de un archivo existente
* Solo es 1-2 párrafos
* Es una referencia rápida (incluir en README de sección)

---

## 📝 Checklist para Nuevo Documento

Antes de finalizar un documento, verificar:

- [ ] Título con emoji apropiado
- [ ] Descripción inicial clara
- [ ] Índice/tabla de contenidos (si > 300 líneas)
- [ ] Mínimo 3 subsecciones con encabezados
- [ ] Al menos una tabla o bloque de código
- [ ] Sección "Véase También" con referencias cruzadas
- [ ] Sin URLs brutas (usar [text](url))
- [ ] Rutas relativas: `../docs/otra-carpeta/`
- [ ] Emojis consistentes con este documento
- [ ] Máximo 1000 líneas (si más, considerar dividir)
- [ ] Revisado ortografía y gramática

---

## 🔗 Referencias Cruzadas

Siempre enlazar documentación relacionada:

```markdown
## 🔗 Véase También

- [Tema Relacionado 1](../carpeta/archivo.md) - Descripción breve
- [Tema Relacionado 2](../otra-carpeta/archivo.md) - Descripción breve
```

Mantener las referencias relativas respecto a `/docs/`.

---

## 📊 Estructura Global Actual

```
Raíz del Proyecto
├── README.md ← Punto de entrada principal (links a /docs)
├── docs/ ← Toda la documentación
│   ├── README.md ← Índice de /docs (tabla de roles)
│   └── [categorías vistas arriba]
└── [código fuente, configuración, etc.]
```

---

## 🤖 Instrucciones para Copilot & Google AI Studio

**Si eres un asistente de IA generando documentación para este proyecto:**

1. **Consulta esta guía primero** - Asegúrate de seguir la estructura
2. **Categoriza el tema** - ¿Entra en getting-started, development, styling, etc.?
3. **Revisa archivos similares** - Mira ejemplos en la misma carpeta
4. **Usa la estructura estándar** - Comienza con encabezado + emoji, luego "Contenidos"
5. **Enlaza correctamente** - Referencias relativas desde `/docs`
6. **Emojis consistentes** - Consulta tabla arriba, mantén coherencia
7. **Pon links útiles** - Sección "Véase También" con referencias cruzadas
8. **Revisa longitud** - Máx 1000 líneas, considera dividir si es más largo
9. **Actualiza índices** - Si creas nuevo archivo, añade a `README.md` de su carpeta
10. **Mantén formato** - Listas con `*`, código con ` ```lenguaje `, negrita con `**`

---

## 📞 Soporte y Preguntas

Si necesitas generar documentación y tienes dudas:

1. Consulta un archivo similar en la misma categoría
2. Revisa la sección correspondiente de esta guía
3. Mantén el objetivo: **claridad, navegabilidad y coherencia**

---

**Última actualización**: 31 Octubre 2024
**Responsable**: Copilot / Asistentes de IA
**Versión**: 1.0
