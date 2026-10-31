# 👨‍💻 Development

Configuración, guías de desarrollo y documentos técnicos internos.

## 📖 Contenidos

- **[SECRETS_CONFIGURATION.md](SECRETS_CONFIGURATION.md)** - Configuración de variables secretas
- **[COMMIT_GUIDE.md](COMMIT_GUIDE.md)** - Convenciones de commits
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Resumen de implementación
- **[IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)** - Reporte técnico detallado
- **[IMPLEMENTATION_SUMMARY_VERSIONING.md](IMPLEMENTATION_SUMMARY_VERSIONING.md)** - Versionado e implementación

## 🎯 Empieza por Aquí

### Configuración Inicial
1. Lee [SECRETS_CONFIGURATION.md](SECRETS_CONFIGURATION.md) para entender variables de entorno
2. Sigue [../getting-started/QUICKSTART.md](../getting-started/QUICKSTART.md) para setup del desarrollo

### Escribir Código
1. Revisa [COMMIT_GUIDE.md](COMMIT_GUIDE.md) antes de hacer commits
2. Consulta [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) para entender la arquitectura
3. Lee [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) para detalles técnicos

### Versionado
- Consulta [IMPLEMENTATION_SUMMARY_VERSIONING.md](IMPLEMENTATION_SUMMARY_VERSIONING.md)
- Revisa [../changelog/](../changelog/) para el flujo completo de versionado

## 🔧 Herramientas Necesarias

```bash
node >= 18.x
npm >= 9.x (o bun)
git >= 2.30.x
```

## 📁 Estructura de Desarrollo

```
src/
├── components/     # Componentes React
├── context/        # Contextos globales
├── hooks/          # Hooks personalizados
├── services/       # Lógica de negocio
├── types/          # Definiciones TypeScript
├── utils/          # Utilidades
└── index.css       # Estilos con variables CSS
```

## 🧪 Testing

Actualmente hay tests de dominio en `test/`:
- `keyAnalysis.test.ts`
- `meter.test.ts`

Para agregar más tests: revisar [../changelog/](../changelog/) para flujos de versionado.

## 📦 Scripts Disponibles

```bash
npm run dev      # Desarrollo local
npm run build    # Compilación producción
npm run preview  # Previsualizar build
npm run lint     # Verificar tipos
npm run clean    # Limpiar build
```
