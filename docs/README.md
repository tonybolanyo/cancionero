# Cancionero Documentation

Welcome to the complete documentation for **Cancionero de Versos Perdidos**. Here you will find user guides, technical references, and best practices.

---

## Documentation for Different Roles

Find documentation based on your role or need:

---

## Documentation Maintenance

Documentation is kept synchronized with code changes. These guides help maintain consistency:

### For Different Tools and Roles

| Role/Tool | Guide | Purpose |
|-----------|-------|---------|
| **Copilot Sessions** | [COPILOT_INSTRUCTIONS.md](COPILOT_INSTRUCTIONS.md) | Step-by-step workflow for maintaining docs during GitHub Copilot sessions |
| **Google AI Studio** | [GOOGLE_AI_STUDIO_INSTRUCTIONS.md](GOOGLE_AI_STUDIO_INSTRUCTIONS.md) | Prompts and workflows for generating/updating documentation with AI Studio |
| **General Maintenance** | [DOCUMENTATION_MAINTENANCE.md](DOCUMENTATION_MAINTENANCE.md) | When to update docs and how to handle common scenarios |
| **Writing Standards** | [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) | Markdown formatting, naming conventions, style guidelines |
| **Structure Overview** | [ORGANIZATION_SUMMARY.md](ORGANIZATION_SUMMARY.md) | Complete overview of documentation organization and structure |
| **Visual Assets** | [assets/SCREENSHOTS_AND_VIDEOS_GUIDE.md](assets/SCREENSHOTS_AND_VIDEOS_GUIDE.md) | How to create screenshots and videos for user documentation |

### Key Principles

1. Update documentation simultaneously with code changes - never defer
2. All documentation in `/docs` organized by category
3. Markdown format only, no emojis in text
4. Include functional descriptions AND developer technical details
5. Keep documentation synchronized with actual features
6. Use automated tools (Playwright) for screenshots and videos

---

## By Role

### 👤 For Users

| Role | Get Started | Documentation |
|------|-------------|----------------|
| **User** | [Quick Start](getting-started/QUICKSTART.md) | [Getting Started](getting-started/) |
| **Developer** | [Development Setup](development/README.md) | [Development](development/) |
| **Designer** | [CSS Variables](styling/CSS_VARIABLES_QUICK_START.md) | [Styling](styling/) |
| **DevOps** | [GitHub Pages](deployment/README_DEPLOYMENT.md) | [Deployment](deployment/) |
| **Contributor** | [Commit Guide](development/COMMIT_GUIDE.md) | [Development](development/) |

---

## By Category

### Getting Started
* [CSS_VARIABLES_QUICK_START.md](styling/CSS_VARIABLES_QUICK_START.md) - Primeros pasos
* [CSS_BEST_PRACTICES.md](styling/CSS_BEST_PRACTICES.md) - Mejores prácticas
* [CSS_ARCHITECTURE.md](styling/CSS_ARCHITECTURE.md) - Organización
* [CSS_VARIABLES_INDEX.md](styling/CSS_VARIABLES_INDEX.md) - Índice completo
* [CSS_VARIABLES_SUMMARY.md](styling/CSS_VARIABLES_SUMMARY.md) - Resumen

#### ♿ [Accessibility](accessibility/)
Accesibilidad, pruebas y contribuciones a11y.
* [ACCESSIBILITY.md](accessibility/ACCESSIBILITY.md) - Guía completa
* [ACCESSIBILITY_INDEX.md](accessibility/ACCESSIBILITY_INDEX.md) - Índice de características
* [TESTING_ACCESSIBILITY.md](accessibility/TESTING_ACCESSIBILITY.md) - Pruebas
* [CONTRIBUTING_ACCESSIBILITY.md](accessibility/CONTRIBUTING_ACCESSIBILITY.md) - Contribuir

#### 🤖 [Automation](automation/)
Flujos de trabajo, GitHub Actions y CI/CD.
* [README.md](automation/README.md) - Descripción de flujos

#### 📝 [Changelog](changelog/)
Versionado semántico, releases y historial de cambios.
* [VERSIONING.md](changelog/VERSIONING.md) - Versionado semántico
* [SEMANTIC_VERSIONING_SETUP.md](changelog/SEMANTIC_VERSIONING_SETUP.md) - Configuración
* [VERSIONING_FLOW_DIAGRAM.md](changelog/VERSIONING_FLOW_DIAGRAM.md) - Diagrama del flujo
* [VERSIONING_VERIFICATION_CHECKLIST.md](changelog/VERSIONING_VERIFICATION_CHECKLIST.md) - Checklist
* [CHANGES.md](changelog/CHANGES.md) - Historial

#### 📂 [Content](content/)
Gestión de contenido, metadatos y estructura de canciones.
* [README.md](content/README.md) - Guía de contenido

---

## ❓ No Sé Por Dónde Empezar

**¿Primera vez?**
→ Ve a [Getting Started](getting-started/QUICKSTART.md)

**¿Quiero cambiar colores o estilos?**
→ Lee [Styling / CSS_VARIABLES_QUICK_START.md](styling/CSS_VARIABLES_QUICK_START.md)

**¿Voy a desplegar?**
→ Sigue [Deployment / README_DEPLOYMENT.md](deployment/README_DEPLOYMENT.md)

**¿Soy desarrollador?**
→ Comienza en [Development / README.md](development/README.md)

**¿Quiero contribuir?**
→ Lee [Development / COMMIT_GUIDE.md](development/COMMIT_GUIDE.md)

**¿Necesito accesibilidad?**
→ Consulta [Accessibility / ACCESSIBILITY.md](accessibility/ACCESSIBILITY.md)

---

## Documentation Maintenance

Documentation is kept synchronized with code changes. These guides help maintain consistency:

### For Different Tools and Roles

| Role/Tool | Guide | Purpose |
|-----------|-------|---------|
| **Copilot Sessions** | [COPILOT_INSTRUCTIONS.md](COPILOT_INSTRUCTIONS.md) | Step-by-step workflow for maintaining docs during GitHub Copilot sessions |
| **Google AI Studio** | [GOOGLE_AI_STUDIO_INSTRUCTIONS.md](GOOGLE_AI_STUDIO_INSTRUCTIONS.md) | Prompts and workflows for generating/updating documentation with AI Studio |
| **General Maintenance** | [DOCUMENTATION_MAINTENANCE.md](DOCUMENTATION_MAINTENANCE.md) | When to update docs and how to handle common scenarios |
| **Writing Standards** | [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) | Markdown formatting, naming conventions, style guidelines |

### Key Principles

1. Update documentation simultaneously with code changes - never defer
2. All documentation in `/docs` organized by category
3. Markdown format only, no emojis in text
4. Include functional descriptions AND developer technical details
5. Keep documentation synchronized with actual features
6. Use automated tools (Playwright) for screenshots and videos

---

## 📊 Mapa del Proyecto

```
Cancionero/
├── README.md ← Punto de entrada (enlaza a /docs)
├── docs/ ← Estás aquí 📍
│   ├── DOCUMENTATION_GUIDE.md (Cómo escribir docs)
│   ├── getting-started/
│   ├── features/
│   ├── development/
│   ├── deployment/
│   ├── styling/
│   ├── accessibility/
│   ├── automation/
│   ├── changelog/
│   └── content/
├── src/ (Código fuente React)
├── public/ (Assets estáticos)
├── songs/ (Archivos de canciones)
└── .github/ (GitHub Actions)
```

---

## 🔄 Última Actualización

Esta documentación se reorganizó el **31 de Octubre de 2024** para mejorar navegabilidad y mantener estructura coherente.

Si encuentras enlaces rotos o información desactualizada, por favor reporta un issue.

---

## 📞 Necesitas Ayuda?

* **Pregunta general sobre Cancionero** → [Getting Started](getting-started/)
* **Problema técnico** → [Development](development/)
* **Cómo desplegar** → [Deployment](deployment/)
* **Mejorar estilos** → [Styling](styling/)
* **Hacer código accesible** → [Accessibility](accessibility/)
