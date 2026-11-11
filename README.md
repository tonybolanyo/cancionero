# 🎵 Cancionero de Versos Perdidos

> **Canciones de autor, letras íntimas y poesía acústica.**  
> *Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía.*

Aplicación web moderna desarrollada en **React 19**, **Vite** y **Tailwind CSS**, diseñada como un archivo vivo de composiciones musicales para cantautores e instrumentistas.

---

## 🚀 Comienza Aquí

* **👤 Nuevo en el proyecto**: Lee la [Guía de Inicio Rápido](docs/getting-started/QUICKSTART.md)
* **⌨️ Atajos útiles**: Consulta los [Atajos de Teclado](docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md)
* **🔗 Despliegue**: Ve a [Despliegue en GitHub Pages](docs/deployment/README_DEPLOYMENT.md)

---

## ✨ Características Principales

* 🎼 **Visor interactivo de acordes y letras** con transposición en tiempo real y modo atril.
* 🔍 **Búsqueda instantánea** por título, versos, tonalidad, género, y más.
* 🎛️ **Tres modos de visualización**: Tarjetas, Lista ampliada y Tabla de atril.
* 🎧 **Integración multimedia** con Spotify, YouTube, SoundCloud.
* 📦 **Sincronización Git** con commits y push automáticos.
* 🏷️ **Renombrado de archivos Markdown** con control de versiones.
* 🎙️ **Detector automático de audio** (IA + DSP) para BPM, tonalidad y acordes.
* 🔐 **Seguridad sin secretos**: Autenticación de autor segura sin credenciales en el código.

---

## 📚 Documentación Completa

La documentación está organizada por categorías en el directorio `/docs`:

### 🎯 Por Rol

| Rol | Documentación |
|-----|---------------|
| **Usuario** | [Getting Started](docs/getting-started/) → Guías rápidas, atajos y cheatsheets |
| **Desarrollador** | [Development](docs/development/) → Configuración, commits, implementación |
| **Diseñador** | [Styling](docs/styling/) → Sistema CSS, variables, arquitectura visual |
| **DevOps** | [Deployment](docs/deployment/) → GitHub Pages, Cloudflare, SEO |

### 📖 Índice de Documentación

- **[Getting Started](docs/getting-started/)** - Inicio rápido, atajos, cheatsheets
- **[Features](docs/features/)** - Características detalladas y previsualizaciones
- **[Development](docs/development/)** - Configuración, secretos, guía de commits
- **[Deployment](docs/deployment/)** - GitHub Pages, Cloudflare, SEO
- **[Styling](docs/styling/)** - Sistema CSS, variables, arquitectura de estilos
- **[Accessibility](docs/accessibility/)** - Accesibilidad, pruebas, contribuciones
- **[Automation](docs/automation/)** - Versionado, changelog, flujos de trabajo
- **[Content](docs/content/)** - Gestión de contenido, metadatos
- **[Changelog](docs/changelog/)** - Historial de versiones y cambios

---

## 💻 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Ejecutar tests unitarios (109 tests)
npm test

# Desarrollo local
npm run dev

# Compilar para producción
npm run build

# Previsualizar compilación
npm run preview
```

El servidor estará en `http://localhost:3000`.

---

## 🔐 Autenticación del Autor

* El repositorio es 100% público y seguro sin guardar credenciales.
* Los autores introducen su Personal Access Token directamente en el navegador.
* El acceso se verifica automáticamente contra la API de GitHub.
* Los tokens se guardan solo localmente en el navegador (`sessionStorage`/`localStorage`).

→ [Más detalles en la documentación de despliegue](docs/deployment/README_DEPLOYMENT.md)

---

## 📂 Estructura del Proyecto y Arquitectura SOLID

→ Para una guía técnica detallada de la arquitectura de componentes y patrones SOLID, consulta **[Arquitectura de Componentes SOLID](docs/development/COMPONENT_ARCHITECTURE.md)**.

```text
├── .github/workflows/          # GitHub Actions (despliegue automático)
├── src/                        # Código fuente (React 19, Vite, Tailwind CSS)
│   ├── components/             # Componentes organizados por dominio
│   │   ├── layout/             # Shell visual (Header, Footer, SkipLink, AppLayout)
│   │   ├── catalog/            # Catálogo, filtros, vistas en cuadrícula/atril
│   │   ├── modals/             # Diálogos y modales globales (AppModals)
│   │   ├── audio/              # Reproductores, DSP, métrica y sincronización LRC
│   │   ├── routing/            # Enrutador de vistas (AppRouter)
│   │   ├── auth/               # Guardias de acceso para autor
│   │   └── seo/                # Metadatos dinámicos y OpenGraph
│   ├── hooks/                  # Custom hooks desacoplados (useSongCatalog, etc.)
│   ├── pages/                  # Vistas y páginas completas independientes
│   ├── context/                # Contextos de React (Theme, Auth, Navigation)
│   ├── services/               # Servicios Git y persistencia en disco/Storage
│   └── utils/                  # Utilidades de transposición, PDF y parseo
├── test/                       # Batería de pruebas unitarias (Node.js test runner)
├── songs/                      # Catálogo de canciones en formato Markdown
├── docs/                       # 📖 Documentación estructurada
├── public/                     # Archivos estáticos y catálogo generado
├── package.json                # Dependencias, scripts y configuración
└── package-lock.json           # Bloqueo de versiones sincronizado para despliegues
```

---

## 📝 Documentation Maintenance

Documentation is maintained synchronized with code changes. All documentation files are in the `/docs` directory.

### For AI Assistants and Contributors

- **Copilot Users:** [Copilot Documentation Guide](docs/COPILOT_INSTRUCTIONS.md) - Step-by-step instructions for maintaining docs during Copilot sessions
- **Google AI Studio Users:** [Google AI Studio Instructions](docs/GOOGLE_AI_STUDIO_INSTRUCTIONS.md) - Detailed prompts and workflow for documentation generation
- **General Maintenance:** [Documentation Maintenance Guide](docs/DOCUMENTATION_MAINTENANCE.md) - When and how to update documentation
- **Style Guide:** [Documentation Style Guide](docs/DOCUMENTATION_GUIDE.md) - Formatting, conventions, and best practices

### Key Rules for Documentation

1. All documentation files go in `/docs` organized by category
2. Markdown format (.md) with no emojis in text content
3. Include both functional descriptions and developer technical details
4. Update documentation simultaneously with code changes
5. Include screenshots/videos for user-facing features using Playwright
6. Maintain cross-references between related documentation

### Quick Links for Specific Roles

| Role | Start Here |
|------|-----------|
| New User | [Getting Started](docs/getting-started/QUICKSTART.md) |
| Developer | [Development Setup](docs/development/README.md) |
| Contributor | [Commit Guide](docs/development/COMMIT_GUIDE.md) |
| DevOps | [Deployment Guide](docs/deployment/README.md) |
| Designer | [CSS System](docs/styling/CSS_DESIGN_SYSTEM.md) |
| Maintaining Docs | [Maintenance Guide](docs/DOCUMENTATION_MAINTENANCE.md) |

---

## 📄 License

Song content and lyrics © by the author. Application code available under MIT license.
