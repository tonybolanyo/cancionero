# 🎵 Cancionero de Versos Perdidos

> **Canciones de autor, letras íntimas y poesía acústica.**  
> *Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía.*

Aplicación web moderna desarrollada en **React 19**, **Vite** y **Tailwind CSS**, diseñada como un archivo vivo de composiciones musicales para cantautores e instrumentistas.

---

## ✨ Características Principales

* 🎼 **Visor interactivo de acordes y letras**:
  * Alternador de posición de acordes: acordes **encima de la sílaba** o **en la misma línea**.
  * Transposición tonal en tiempo real (+1/-1 semitono con cálculo enarmónico inteligente).
  * Modo de atril con auto-scroll a velocidad regulable para ensayos y directos.
* 🔍 **Búsqueda instantánea y multi-criterio**:
  * Búsqueda en tiempo real por título, versos, tonalidad, género, notas, año o etiquetas.
  * Atajo de teclado rápido (`/` o `Ctrl+K`) para enfocar la búsqueda.
* 🎛️ **Tres modos de visualización**:
  * **Tarjetas (Cuadrícula)**: Vista visual con enlaces de audio, extractos de letra y etiquetas.
  * **Lista ampliada**: Filas detalladas con previsualización de estrofas poéticas y notas del autor.
  * **Lista comprimida**: Tabla de atril densa, con métrica, tempo BPM y columnas ordenables.
* 🎧 **Integración multimedia**: Enlaces y reproductores para Spotify, YouTube, SoundCloud y maquetas de audio directas.
* 📦 **Sincronización Git & Operación Push**:
  * Registro de commits con mensajes descriptivos y autoría.
  * **Operación "push" automática o manual** tras realizar commits (sincroniza directamente con tu repositorio remoto de GitHub).
  * Contador de commits pendientes de push y registro de última sincronización.
* 🏷️ **Renombrado de archivos Markdown (`songs/*.md`)**:
  * Opción para renombrar archivos desde el editor, visor de detalles, tarjetas o tabla de canciones.
  * Migración automática de contenido en snapshots y opción de commit/push inmediato del renombrado.
* 🔐 **Seguridad sin secretos en el repositorio**:
  * Acceso a la sección de autor protegido exclusivamente para tu usuario de GitHub.
  * No hay tokens, contraseñas ni claves API expuestas en el código público.

---

## 🚀 Despliegue en GitHub Pages (Paso a Paso)

Este proyecto está completamente preparado para desplegarse como una web estática en **GitHub Pages** mediante **GitHub Actions**.

### Paso 1: Subir el proyecto a tu repositorio de GitHub

Si aún no has vinculado tu repositorio remoto:

```bash
git init
git add .
git commit -m "Initial commit: Cancionero de versos perdidos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cancionero.git
git push -u origin main
```

*(Sustituye `TU_USUARIO` y `cancionero` por los datos reales de tu repositorio).*

---

### Paso 2: Activar GitHub Actions en GitHub Pages

1. Abre tu repositorio en GitHub.
2. Ve a la pestaña **Settings** (Configuración).
3. En el menú lateral izquierdo, haz clic en **Pages**.
4. En la sección **Build and deployment**:
   * En el desplegable **Source**, selecciona: **`GitHub Actions`** (en lugar de *"Deploy from a branch"*).

---

### Paso 3: Configurar el Usuario de Autor (Opcional / Personalizable)

El proyecto viene configurado por defecto para autorizar al usuario `tonygb`. Si deseas cambiar el usuario de GitHub autorizado como autor:

1. En tu repositorio de GitHub, ve a **Settings** > **Secrets and variables** > **Actions**.
2. Haz clic en la pestaña **Variables** (no Secrets, ya que el nombre de usuario es público).
3. Pulsa **New repository variable**:
   * **Name**: `VITE_GITHUB_ALLOWED_USER`
   * **Value**: tu nombre de usuario de GitHub (ejemplo: `tu-usuario`).
4. Guarda los cambios.

> 🔒 **Importante**: **No necesitas configurar tokens ni contraseñas como Secretos en GitHub.**  
> El sistema de autenticación no requiere almacenar tu token en el servidor de despliegue. Tu token personal lo introducirás tú mismo directamente en el navegador cuando desees iniciar sesión como autor.

---

### Paso 4: Despliegue Automático

El flujo de trabajo incluido en `.github/workflows/deploy-pages.yml` se activará automáticamente con cada `push` a la rama `main` o `master`.

Para comprobar el estado del despliegue:
1. Ve a la pestaña **Actions** en tu repositorio de GitHub.
2. Verás el flujo **Deploy to GitHub Pages**.
3. Al finalizar con éxito, en la pestaña **Pages** o en el resumen del workflow aparecerá la URL pública de tu web:
   ```
   https://TU_USUARIO.github.io/cancionero/
   ```

*(Si utilizas un dominio personalizado o un nombre de repositorio distinto, el flujo detecta automáticamente la ruta base correcta mediante `actions/configure-pages`).*

---

## 🔒 Cómo Funciona la Autenticación del Autor

Para garantizar que **el repositorio sea 100% público y seguro sin guardar credenciales en el código**:

1. **Visita pública**: Cualquier visitante que acceda a la web solo podrá ver las canciones públicas aprobadas. Los borradores e inéditas permanecen ocultos.
2. **Acceso del autor**:
   * Haz clic en **Acceso Autor** (o el botón con icono de candado).
   * Introduce tu **Personal Access Token (PAT)** de GitHub (un token clásico con permisos `read:user` o un fine-grained token).
3. **Verificación criptográfica**:
   * La aplicación hace una llamada directa y segura a la API oficial de GitHub (`https://api.github.com/user`) con tu token.
   * La API devuelve el nombre del usuario autenticado.
   * La aplicación comprueba estrictamente que coincida con el usuario configurado (`tonygb`).
   * **Si cualquier otro usuario de GitHub introduce un token válido de su propia cuenta, el acceso es rechazado inmediatamente.**
4. **Almacenamiento del token**:
   * El token solo se guarda localmente en tu propio navegador (`sessionStorage`, o `localStorage` si marcas *"Recordar en este equipo"*).
   * Al cerrar sesión o borrar datos del navegador, el token desaparece.

---

## 💻 Desarrollo Local

Si deseas probar o modificar la aplicación en tu entorno local:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo Vite
npm run dev

# 3. Compilar para producción localmente
npm run build

# 4. Previsualizar la compilación de producción
npm run preview
```

El servidor local se iniciará habitualmente en `http://localhost:3000`.

---

## 📂 Estructura del Proyecto

```text
├── .github/
│   └── workflows/
│       └── deploy-pages.yml     # Flujo automatizado de despliegue a GitHub Pages
├── src/
│   ├── components/              # Componentes de UI (Modales, Filtros, Tablas, etc.)
│   │   ├── SongCard.tsx         # Vista de cuadrícula (Tarjetas)
│   │   ├── SongExpandedRow.tsx  # Vista de lista ampliada
│   │   ├── SongCompactView.tsx  # Vista de lista comprimida / atril
│   │   ├── SongDetailModal.tsx  # Visor completo con acordes y afinación
│   │   └── SongFilters.tsx      # Barra de búsqueda y selector de vistas
│   ├── context/                 # Contextos de React (Tema, Autenticación GitHub)
│   ├── data/                    # Catálogo inicial de canciones
│   ├── services/                # Servicios de persistencia y simulación Git
│   ├── types/                   # Definiciones de TypeScript (Song, Auth, etc.)
│   └── utils/                   # Transposición armónica y parseo Markdown
├── metadata.json                # Metadatos del cancionero (Título y descripción)
├── vite.config.ts               # Configuración de Vite adaptada a GitHub Pages
└── package.json                 # Dependencias y scripts de construcción
```

---

## 📄 Licencia

Contenido de canciones y letras © por el autor. Código de la aplicación disponible bajo licencia MIT.
