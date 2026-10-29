# 📊 Guía de SEO - Cancionero de Versos Perdidos

Esta guía documenta todas las mejoras de SEO implementadas en el proyecto Cancionero.

---

## 🎯 Resumen de Mejoras

### 1. **Meta Tags Mejorados**
Se han añadido meta tags completos y optimizados para:
- **Meta description**: Descripción clara y atractiva para buscadores
- **Meta keywords**: Palabras clave relevantes
- **Meta author**: Atribución del autor
- **Meta robots**: Control del rastreo de buscadores
- **Meta language**: Especificación del idioma
- **Theme color**: Cohesión visual

### 2. **Open Graph Tags (OG)**
Optimizados para compartir en redes sociales:
- `og:title`: Título optimizado
- `og:description`: Descripción optimizada
- `og:url`: URL canónica
- `og:type`: Tipo de contenido (website, music.song)
- `og:site_name`: Nombre del sitio
- `og:locale`: Localización (es_ES)
- `og:image`: Imagen de previsualización
- `og:image:alt`: Texto alternativo de imagen

### 3. **Twitter Card Tags**
Optimizados para X/Twitter:
- `twitter:card`: Tipo de tarjeta (summary_large_image)
- `twitter:title`: Título
- `twitter:description`: Descripción
- `twitter:image`: Imagen de previsualización
- `twitter:creator`: Identificador del creador

### 4. **Datos Estructurados (JSON-LD)**

#### a. Schema WebSite
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Cancionero de versos perdidos",
  "description": "...",
  "url": "https://tonygb.com/cancionero/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://tonygb.com/cancionero/?q={search_term_string}"
    }
  }
}
```

#### b. Schema MusicGroup/Artist
```json
{
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "Cancionero de versos perdidos",
  "description": "Colección de canciones de autor y poesía acústica",
  "url": "https://tonygb.com/cancionero/",
  "genre": ["Acoustic", "Singer-Songwriter", "Folk", "Cantautor"],
  "knowsLanguage": "es",
  "sameAs": [
    "https://github.com/tonybolanyo",
    "https://twitter.com/tonygb"
  ]
}
```

#### c. Schema MusicRecording (Dinámico por canción)
Se genera automáticamente cuando se abre una canción:
```json
{
  "@context": "https://schema.org",
  "@type": "MusicRecording",
  "name": "Título de la canción",
  "description": "Descripción/notas de la canción",
  "url": "https://tonygb.com/cancionero/?song=id",
  "datePublished": "2024-01-01",
  "duration": "PT3:45",
  "genre": "Acoustic",
  "byArtist": {
    "@type": "MusicGroup",
    "name": "Tony García Bernal",
    "url": "https://tonygb.com/cancionero/"
  }
}
```

---

## 🛠️ Componentes y Hooks

### `useMetaTags` Hook
**Ubicación:** `src/hooks/useMetaTags.ts`

Hook personalizado para gestionar dinámicamente todos los meta tags y datos estructurados.

**Uso básico:**
```typescript
import { useMetaTags } from '../hooks/useMetaTags';

function MyComponent() {
  useMetaTags({
    title: 'Mi página especial',
    description: 'Una descripción increíble',
    keywords: ['palabra1', 'palabra2'],
    ogImage: 'https://ejemplo.com/imagen.jpg',
    canonicalUrl: 'https://ejemplo.com/pagina'
  });

  return <div>Mi contenido</div>;
}
```

**Parámetros disponibles:**
- `title` (string): Título de la página
- `description` (string): Descripción meta
- `keywords` (string[]): Array de palabras clave
- `ogTitle`, `ogDescription`, `ogImage`, `ogUrl`, `ogType`: Tags Open Graph
- `twitterCard`, `twitterTitle`, `twitterDescription`, `twitterImage`, `twitterCreator`: Tags Twitter
- `author` (string): Autor del contenido
- `robots` (string): Directivas de robots (ej: "index, follow")
- `language` (string): Código del idioma (ej: "es")
- `canonicalUrl` (string): URL canónica
- `structuredData` (object): Datos estructurados JSON-LD

### `SeoHelper` Componente
**Ubicación:** `src/components/SeoHelper.tsx`

Componente que simplifica la integración de SEO en la aplicación React.

**Uso:**
```typescript
import { SeoHelper } from './components/SeoHelper';
import { Song } from './types/song';

function MyPage({ song }: { song: Song }) {
  return (
    <>
      <SeoHelper
        title="Mi página"
        description="Descripción"
        keywords={['palabra1', 'palabra2']}
        song={song}  // Actualiza automáticamente los tags cuando hay canción
      />
      <div>Contenido de la página</div>
    </>
  );
}
```

**Props disponibles:**
- `title`: Título de la página
- `description`: Descripción
- `keywords`: Array de palabras clave
- `ogImage`: Imagen para OG
- `ogUrl`: URL para OG
- `song`: Objeto Song (se genera schema automáticamente)
- `breadcrumbs`: Array de breadcrumbs para schema

---

## 📝 Funciones Helper

### `generateOrganizationSchema()`
Genera esquema para la organización/artista.

```typescript
import { generateOrganizationSchema } from '../hooks/useMetaTags';

const schema = generateOrganizationSchema();
// Usa en structuredData del useMetaTags
```

### `generateSongSchema(song)`
Genera esquema para una canción específica.

```typescript
import { generateSongSchema } from '../hooks/useMetaTags';

const schema = generateSongSchema({
  id: 'mi-cancion',
  title: 'Mi Canción',
  description: 'Descripción',
  year: 2024,
  duration: '3:45',
  genre: 'Acoustic',
  spotifyUrl: 'https://spotify.com/...'
});
```

### `generateBreadcrumbSchema(items)`
Genera esquema de migas de pan.

```typescript
import { generateBreadcrumbSchema } from '../hooks/useMetaTags';

const schema = generateBreadcrumbSchema([
  { name: 'Inicio', url: '/' },
  { name: 'Canciones', url: '/songs' },
  { name: 'Mi Canción' }
]);
```

### `generateWebsiteSchema()`
Genera esquema básico del sitio web.

```typescript
import { generateWebsiteSchema } from '../hooks/useMetaTags';

const schema = generateWebsiteSchema();
```

---

## 🔄 Uso en la Aplicación Principal

En `src/App.tsx`, el componente `SeoHelper` se usa así:

```typescript
<SeoHelper
  title="Cancionero de versos perdidos"
  description="Versos que se perdieron un día y regresaron convertidos en canciones..."
  keywords={['canciones', 'poesía', 'acústico', 'cantautor', 'letras', 'compositor', 'música original', 'singer-songwriter']}
  song={selectedSong}  // Se actualiza automáticamente cuando se selecciona una canción
/>
```

Cuando el usuario:
1. **Carga la página**: Muestra meta tags genéricos del cancionero
2. **Abre una canción**: Los meta tags se actualizan automáticamente con:
   - Título de la canción
   - Descripción basada en notas
   - Schema de MusicRecording
   - URL específica de la canción

---

## 📱 Validación de SEO

### Herramientas recomendadas para validar:

1. **Google Search Console**: https://search.google.com/search-console
   - Valida indexación
   - Ver cómo Google ve las páginas
   - Revisar datos estructurados

2. **Google Rich Results Test**: https://search.google.com/test/rich-results
   - Validar estructuras JSON-LD
   - Ver previsualización de resultados ricos

3. **SEO Checker Tools**:
   - https://www.seobility.net/
   - https://www.seoptimer.com/
   - https://www.woorank.com/

4. **Open Graph Debugger**:
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator

5. **Chrome DevTools**:
   - Inspeccionar meta tags en el HTML
   - Validar que datos estructurados estén presentes

---

## 🎵 Características SEO Específicas para Música

El proyecto implementa las siguientes optimizaciones para contenido musical:

### 1. **Schema MusicRecording**
Permite que buscadores identifiquen correctamente canciones, con atributos como:
- Título de la canción
- Duración
- Artista
- Género
- URL de plataformas (Spotify, YouTube)

### 2. **Schema MusicGroup**
Identifica al artista/proyecto con:
- Nombres alternativos (sameAs)
- Géneros
- Idiomas
- Enlaces a redes sociales

### 3. **Meta Tags Dinámicos**
Cuando se abre una canción:
- El título de página cambia
- Description se actualiza
- Open Graph tags reflejan la canción específica
- Estructura JSON-LD es para MusicRecording

### 4. **Keywords Contextuales**
Para cada canción se añaden:
- Título
- Género
- Tonalidad/Key
- Tags personalizados

---

## 🚀 Deploy con GitHub Pages

Cuando se despliega en GitHub Pages, los meta tags se sirven automáticamente con el HTML estático. No requiere configuración adicional.

### Verificación post-deploy:
1. Abre la URL del sitio en producción
2. Ver código fuente (Ctrl+U)
3. Verifica que meta tags estén presentes
4. Usa Google Search Console para validar indexación

---

## 📋 Checklist de SEO Implementado

- ✅ Meta description con palabras clave
- ✅ Meta keywords
- ✅ Meta author
- ✅ Meta robots (index, follow)
- ✅ Canonical URL
- ✅ Language meta tag
- ✅ Open Graph completo
- ✅ Twitter Card completo
- ✅ JSON-LD WebSite Schema
- ✅ JSON-LD MusicGroup Schema
- ✅ JSON-LD MusicRecording Schema (dinámico)
- ✅ Preconnect para fonts
- ✅ Theme color
- ✅ Favicon
- ✅ Alternates hreflang

---

## 🔗 URLs Importantes

- **Sitio**: https://tonygb.com/cancionero/
- **GitHub**: https://github.com/tonybolanyo/cancionero
- **Twitter**: https://twitter.com/tonygb

---

## 📞 Soporte

Para preguntas sobre SEO o cómo usar los componentes:
1. Revisa los comentarios en los archivos
2. Consulta la documentación del hook `useMetaTags`
3. Revisa ejemplos en `src/App.tsx`

