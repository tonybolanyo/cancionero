# Arquitectura de Componentes y Principios SOLID

Este documento detalla la arquitectura de componentes de **Cancionero de Versos Perdidos**, diseñada y refactorizada siguiendo los principios **SOLID** y las mejores prácticas de ingeniería de software en frontend con **React 19**, **TypeScript** y **Tailwind CSS**.

---

## 1. Visión General del Diseño

El objetivo principal de esta refactorización es eliminar el acoplamiento monolítico, garantizar que cada módulo tenga una única responsabilidad bien definida, simplificar el mantenimiento a largo plazo, facilitar la incorporación de nuevas funciones y permitir pruebas unitarias exhaustivas sin necesidad de montar la aplicación completa.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                   │
│  (Orquestador ligero: ThemeProvider, AuthProvider, NavigationProvider)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│          AppLayout           │              │          AppModals           │
│  (Header, Footer, SkipLink,  │              │  (Auth, QuickStart, Rename,  │
│          SeoHelper)          │              │   Delete, History, YouTube)  │
└──────────────┬───────────────┘              └──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│          AppRouter           │
│  (Despachador de páginas     │
│   con AuthorAccessGuard)     │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┬──────────────────────┬──────────────────────┐
    ▼                     ▼                      ▼                      ▼
CatalogPage          AlbumsPage            SongDetailPage         SongEditorPage
(Hero, Filtros,     (Discografía,         (Visualizador acordes, (Editor versos,
 Vistas, Métricas)   Detalle, Editor)      Transposición, Audio)  Análisis, Audio)
```

---

## 2. Aplicación de los Principios SOLID

### S — Single Responsibility Principle (Principio de Responsabilidad Única)

Antes de la refactorización, `App.tsx` superaba las 1.290 líneas de código y acumulaba más de 10 responsabilidades incompatibles:
- Gestión del estado y persistencia de canciones y álbumes.
- Normalización léxica y lógica de búsqueda y filtros combinados.
- Registro y gestión de atajos de teclado globales.
- Sincronización en segundo plano con el repositorio remoto de GitHub.
- Renderizado de la página principal (Hero, discografía destacada, selector de vistas, tarjetas de temas y gráficos analíticos).
- Gestión del estado abierto/cerrado de 8 diálogos modales independientes.
- Modificación del título de la pestaña del navegador según la ruta activa.

**Solución aplicada:**
1. **`src/hooks/useSongCatalog.ts`**: Encapsula exclusivamente la lógica de filtrado de temas (búsqueda insensible a mayúsculas y tildes, filtro por estado, plataforma, tonalidad, etiquetas), agregación de metadatos (`availableKeys`, `availableTags`, `counts`) y persistencia de la preferencia de visualización (`viewMode`).
2. **`src/hooks/useSongsManager.ts`**: Encapsula exclusivamente el ciclo de vida del catálogo de canciones (carga inicial, guardado, actualización, borrado, sincronización en segundo plano con GitHub y cálculo del estado Git).
3. **`src/hooks/useAlbumsManager.ts`**: Encapsula exclusivamente la administración de álbumes discográficos y la sincronización bidireccional de pistas con las canciones del catálogo.
4. **`src/hooks/useAppModals.ts`**: Centraliza el estado de apertura, cierre y datos temporales de los modales y notificaciones toast.
5. **`src/pages/CatalogPage.tsx`**: Componente de página dedicado a la vista del catálogo principal.
6. **`src/components/layout/AppLayout.tsx`**: Encapsula la estructura visual estándar (cabecera, enlace de accesibilidad, etiquetas SEO dinámicas y pie de página).
7. **`src/components/routing/AppRouter.tsx`**: Encapsula la resolución de rutas a componentes de página aplicando guardias de autorización (`AuthorAccessGuard`).
8. **`src/components/modals/AppModals.tsx`**: Orquesta el renderizado declarativo de las ventanas modales sin sobrecargar el flujo de trabajo de la UI.

---

### O — Open/Closed Principle (Principio de Abierto/Cerrado)

La arquitectura actual está abierta a la extensión pero cerrada a la modificación:
- **Nuevas Rutas y Páginas**: Para añadir una nueva sección (por ejemplo, una nueva vista de exportación o estadísticas avanzadas), se define la ruta en `NavigationContext.tsx` y se añade la rama correspondiente en `AppRouter.tsx`, sin alterar `App.tsx` ni los componentes de catálogo existentes.
- **Nuevos Filtros de Catálogo**: La función pura `filterSongsList` en `useSongCatalog.ts` recibe un objeto de configuración desacoplado. Añadir un nuevo criterio (por ejemplo, filtro por año o por afinación de guitarra) no requiere modificar los componentes visuales ni romper las pruebas unitarias existentes.
- **Nuevas Modales Globales**: Se registran en `useAppModals` y `AppModals`, manteniendo limpia la jerarquía de componentes de la aplicación.

---

### L — Liskov Substitution Principle (Principio de Sustitución de Liskov)

- Todas las páginas (`CatalogPage`, `AlbumsPage`, `SongDetailPage`, `SongEditorPage`, etc.) cumplen con contratos de interfaz consistentes y predecibles.
- Se eliminaron componentes modales heredados y obsoletos que duplicaban funciones (`SongDetailModal.tsx`, `SongEditorModal.tsx`, `AudioAnalyzerModal.tsx`, `SongbookExportModal.tsx`, `AboutModal.tsx`), eliminando discrepancias de comportamiento entre versiones modales y páginas independientes.

---

### I — Interface Segregation Principle (Principio de Segregación de Interfaces)

- Cada componente recibe únicamente las propiedades y devoluciones de llamada que necesita para funcionar.
- Los componentes de catálogo (`SongFilters`, `SongCard`, `SongExpandedRow`, `SongCompactView`) no dependen del estado de autenticación de GitHub ni de la lógica de sincronización remota; reciben datos puros o manejadores directos.
- Se crearon barriles de exportación semánticos (`src/components/layout`, `src/components/catalog`, `src/components/modals`, `src/components/audio`, `src/components/auth`, `src/components/seo`) para que los consumidores importen únicamente lo que necesitan sin cargar dependencias innecesarias.

---

### D — Dependency Inversion Principle (Principio de Inversión de Dependencias)

- Los componentes visuales de alto nivel ya no interactúan de forma directa y dispersa con `localStorage` o llamadas globales a `window`.
- Dependen de abstracciones proporcionadas por hooks (`useSongCatalog`, `useSongsManager`, `useAlbumsManager`, `useAppNavigation`, `useAuth`, `useTheme`).
- Esto permite probar las funciones de filtrado, transformación y cálculo de métricas de forma puramente funcional, como demuestra la suite de pruebas en `test/songCatalog.test.ts`.

---

## 3. Estructura de Directorios de Componentes

```text
src/
├── components/
│   ├── layout/                 # Estructura del shell de la aplicación
│   │   ├── Header.tsx          # Barra de navegación superior de 3 zonas
│   │   ├── Footer.tsx          # Pie de página editorial con enlaces rápidos
│   │   ├── SkipLink.tsx        # Enlace de accesibilidad para lectores de pantalla
│   │   ├── AppLayout.tsx       # Envoltura común de diseño
│   │   └── index.ts            # Barril de exportación
│   ├── catalog/                # Componentes del repertorio y catálogo
│   │   ├── HeroSection.tsx     # Hero banner editorial con canción destacada
│   │   ├── SongFilters.tsx     # Barra de búsqueda y filtros segmentados
│   │   ├── SongCard.tsx        # Tarjeta de canción (vista en cuadrícula)
│   │   ├── SongExpandedRow.tsx # Fila expandida con acordes y reproductores
│   │   ├── SongCompactView.tsx # Tabla compacta de atril para músicos
│   │   ├── AlbumCard.tsx       # Tarjeta de álbum discográfico
│   │   ├── SongDashboard.tsx   # Dashboard analítico con Recharts
│   │   └── index.ts            # Barril de exportación
│   ├── modals/                 # Diálogos y notificaciones globales
│   │   ├── AppModals.tsx       # Contenedor orquestador de modales
│   │   ├── GitHubAuthModal.tsx # Autenticación de autor con token GitHub
│   │   ├── RenameFileModal.tsx # Renombrado seguro de ficheros Markdown
│   │   ├── DeleteSongModal.tsx # Confirmación de borrado con commit
│   │   ├── VersionHistory.tsx  # Historial de versiones y restauración
│   │   ├── KeyboardShortcutsModal.tsx # Ayuda de atajos de teclado
│   │   ├── SongwritingQuickStartModal.tsx # Asistente de inicio rápido
│   │   ├── SongVideoVisualizerModal.tsx   # Generador de vídeo para YouTube
│   │   ├── Mp3MetadataComparisonModal.tsx # Comparador de metadatos ID3
│   │   ├── GitNotificationToast.tsx       # Toast de confirmación de push
│   │   └── index.ts            # Barril de exportación
│   ├── audio/                  # DSP, reproducción y sincronización
│   │   ├── BeatTimeline.tsx    # Línea temporal de pulsos y métrica
│   │   ├── SyncedLyrics.tsx    # Letras sincronizadas en tiempo real
│   │   ├── LrcSyncAssistant.tsx # Asistente de sincronización LRC
│   │   ├── AudioAnalyzerSection.tsx # Extracción armónica y tonalidad
│   │   └── index.ts            # Barril de exportación
│   ├── auth/                   # Control de acceso y seguridad
│   │   ├── AuthorAccessGuard.tsx # Guardia para rutas protegidas
│   │   └── index.ts            # Barril de exportación
│   ├── seo/                    # Optimización para motores de búsqueda
│   │   ├── SeoHelper.tsx       # Inyección de metaetiquetas y OpenGraph
│   │   └── index.ts            # Barril de exportación
│   ├── routing/                # Despacho de vistas
│   │   └── AppRouter.tsx       # Enrutador principal de páginas
│   └── index.ts                # Barril general de componentes
├── hooks/
│   ├── useSongCatalog.ts       # Filtros, ordenación y estado del catálogo
│   ├── useSongsManager.ts      # Persistencia y ciclo de vida de canciones
│   ├── useAlbumsManager.ts     # Persistencia y ciclo de vida de álbumes
│   ├── useAppModals.ts         # Orquestación de estados modales
│   ├── useKeyboardShortcuts.ts # Atajos de teclado accesibles
│   └── ...
└── pages/
    ├── CatalogPage.tsx         # Página principal del catálogo
    ├── AlbumsPage.tsx          # Galería de discografía
    ├── AlbumDetailPage.tsx     # Ficha de álbum y lista de pistas
    ├── AlbumEditorPage.tsx     # Creación y edición de álbumes
    ├── SongDetailPage.tsx      # Ficha técnica, acordes y transposición
    ├── SongEditorPage.tsx      # Editor con autocompletado y análisis
    ├── SongbookPage.tsx        # Generador de cancionero PDF para atril
    ├── AudioAnalyzerPage.tsx   # Herramienta de detección de BPM y notas
    ├── AboutPage.tsx           # Manifiesto y notas del autor
    ├── GitSyncPage.tsx         # Gestión del repositorio y copias
    └── SpotifyImportPage.tsx   # Importador de álbumes desde Spotify
```

---

## 4. Estrategia de Testing y Verificabilidad

Gracias a la separación de funciones puras en `useSongCatalog.ts`, la lógica central de búsqueda y filtrado se valida de manera exhaustiva en `test/songCatalog.test.ts`:
- **Cálculo de Contadores**: Verifica que los contadores diferencian correctamente entre el autor (visibilidad total) y el público visitante (solo temas publicados).
- **Control de Acceso (Visibilidad)**: Garantiza que usuarios no autenticados nunca reciban borradores ni canciones privadas en las listas devueltas.
- **Búsqueda Insensible a Acentos y Mayúsculas**: Comprueba que búsquedas como `"cancion"` coincidan con `"Canción de la Lluvia"`, y que las búsquedas examinen letras, títulos, géneros y notas.
- **Filtrado por Plataforma**: Valida el filtrado según disponibilidad de audio o enlaces a Spotify, YouTube y SoundCloud.
- **Extracción de Tonalidades y Etiquetas**: Valida la ordenación alfabética y el conteo de frecuencia de etiquetas.

Ejecución de la suite completa de pruebas:
```bash
npm test
```
*Resultado actual: 109 pruebas unitarias ejecutadas con éxito en ~5 segundos.*

---

## 5. Sincronización de Dependencias (`package-lock.json`)

Para evitar discrepancias en entornos de integración continua (CI) y despliegues automatizados (Cloudflare, GitHub Pages, Google Cloud):
1. Se ha añadido el script oficial `"test": "tsx --test test/*.test.ts"` a `package.json`.
2. Se ha sincronizado y auditado el fichero `package-lock.json` mediante `npm install --package-lock-only`, garantizando un árbol determinista de dependencias sin discrepancias entre el manifiesto y el bloqueo de versiones.
3. El comando de compilación de producción `npm run build` valida previamente la generación de versiones y el catálogo antes de invocar a Vite.
