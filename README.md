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

## 📂 Estructura del Proyecto

```text
├── .github/workflows/          # GitHub Actions (despliegue automático)
├── src/                        # Código fuente (React, Vite, Tailwind)
│   ├── components/             # Componentes de UI
│   ├── context/                # Contextos de React
│   ├── services/               # Servicios Git y persistencia
│   └── utils/                  # Utilidades de transposición y parseo
├── songs/                      # Catálogo de canciones (Markdown)
├── docs/                       # 📖 Documentación estructurada
├── public/                     # Archivos estáticos
└── package.json                # Dependencias y scripts
```

---

## 📝 Escribir Documentación

¿Necesitas crear o actualizar documentación? Consulta la [Guía de Generación de Documentación](docs/DOCUMENTATION_GUIDE.md) para mantener coherencia con la estructura.

---

## 📄 Licencia

Contenido de canciones y letras © por el autor. Código de la aplicación disponible bajo licencia MIT.
