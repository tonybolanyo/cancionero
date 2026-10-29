# 🚀 SEO Quick Start Guide

## Para Desarrolladores

### Uso Básico (Ya implementado en App.tsx)

```typescript
import { SeoHelper } from './components/SeoHelper';

function App() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  return (
    <>
      {/* Los meta tags se actualizan automáticamente */}
      <SeoHelper
        title="Cancionero de versos perdidos"
        description="..."
        keywords={['canciones', 'poesía', 'acústico', ...]}
        song={selectedSong}  // 🎵 Detecta automáticamente
      />
      {/* Resto de componentes */}
    </>
  );
}
```

### Personalizar por Página

```typescript
import { SeoHelper } from './components/SeoHelper';

export function MyCustomPage() {
  return (
    <>
      <SeoHelper
        title="Mi página personalizada"
        description="Descripción única"
        keywords={['palabra1', 'palabra2']}
        ogImage="https://ejemplo.com/imagen.jpg"
      />
      {/* Contenido */}
    </>
  );
}
```

### Hook Directo para Control Avanzado

```typescript
import { useMetaTags, generateSongSchema } from './hooks/useMetaTags';

export function AdvancedSeoComponent() {
  useMetaTags({
    title: 'Título personalizado',
    description: 'Descripción personalizada',
    keywords: ['palabra1', 'palabra2'],
    structuredData: generateSongSchema({
      id: 'mi-cancion',
      title: 'Mi Canción',
      year: 2024,
      genre: 'Acoustic',
    }),
  });

  return <div>Contenido con SEO avanzado</div>;
}
```

---

## Configuración

### Cambiar URL del sitio:

**Opción 1: Variable de entorno (.env)**
```
VITE_SITE_URL=https://mi-dominio.com
```

**Opción 2: Editar `src/utils/seoConfig.ts`**
```typescript
export const SEO_CONFIG = {
  site: {
    url: 'https://mi-dominio.com',
    // ...
  },
};
```

### Cambiar información del artista:

Edita `src/utils/seoConfig.ts`:
```typescript
artist: {
  name: 'Tu nombre',
  twitterHandle: '@tu_twitter',
  githubUsername: 'tu-github',
},
```

---

## Validación

### En Desarrollo:
```bash
npm run dev
# Abre http://localhost:3000
# DevTools > Elements > <head>
# Verifica meta tags presentes
```

### Después de Build:
```bash
npm run build
npm run preview
# DevTools > Elements > <head>
# Verifica meta tags en dist/index.html
```

### Comandos útiles en Browser Console:
```javascript
// Ver todos los meta tags
document.querySelectorAll('meta').forEach(m => console.log(m.outerHTML));

// Ver JSON-LD schemas
document.querySelectorAll('script[type="application/ld+json"]').forEach(s => 
  console.log(JSON.parse(s.textContent))
);

// Contar meta tags
document.querySelectorAll('meta').length;
```

---

## Herramientas de Testing

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Facebook Debugger**: https://developers.facebook.com/tools/debug/
3. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
4. **Google Search Console**: https://search.google.com/search-console

---

## Estructura de Archivos

```
src/
├── hooks/
│   └── useMetaTags.ts          # Hook principal
├── utils/
│   └── seoConfig.ts            # Configuración centralizada
└── components/
    └── SeoHelper.tsx           # Componente wrapper
```

---

## Flujo Automático

```
Usuario abre canción
        ↓
selectedSong se actualiza
        ↓
App.tsx pasa a SeoHelper
        ↓
SeoHelper detecta cambio
        ↓
Llama useMetaTags
        ↓
Actualiza meta tags dinámicamente ✨
```

---

## Mejores Prácticas

✅ **Siempre** usar `<SeoHelper />` en raíz de componentes  
✅ **Pasar** `song={selectedSong}` para actualizaciones automáticas  
✅ **Personalizar** título, descripción y keywords por página  
✅ **Validar** después de cambios importantes  
✅ **Monitoreear** Google Search Console regularmente  

❌ **No** modificar meta tags manualmente en HTML después de compilar  
❌ **No** olvidar pasar `song` prop cuando sea relevante  
❌ **No** usar palabras clave duplicadas  
❌ **No** dejar descripción vacía  

---

## Solución de Problemas

### Meta tags no se actualizan
- ✅ Verifica que `SeoHelper` esté en el árbol de componentes
- ✅ Revisa que `song` prop esté siendo pasada correctamente
- ✅ Abre DevTools y busca en `<head>`

### Schemas JSON-LD no aparecen
- ✅ Verifica scripts en `<head>`
- ✅ Abre browser console y busca scripts de tipo "application/ld+json"
- ✅ Valida con https://search.google.com/test/rich-results

### Títulos o descripciones incorrectos
- ✅ Verifica los valores en props del SeoHelper
- ✅ Revisa configuración en `seoConfig.ts`
- ✅ Comprueba que no haya caracteres especiales sin escapar

---

## Ejemplos Completos

### Página de Inicio:
```typescript
export function HomePage() {
  return (
    <>
      <SeoHelper
        title="Cancionero de versos perdidos"
        description="Canciones de autor, letras íntimas y poesía acústica"
        keywords={['canciones', 'poesía', 'acústico', 'cantautor']}
      />
      <HeroSection />
      <SongCatalog />
    </>
  );
}
```

### Página de Canción:
```typescript
export function SongPage({ song }: { song: Song }) {
  return (
    <>
      <SeoHelper
        title={song.title}
        description={song.notes}
        song={song}  // 🎵 Schema automático
        ogImage={song.coverImage}
      />
      <SongDetail song={song} />
    </>
  );
}
```

### Página de Búsqueda:
```typescript
export function SearchResults({ results, query }: Props) {
  return (
    <>
      <SeoHelper
        title={`Resultados: "${query}"`}
        description={`${results.length} canciones encontradas`}
        keywords={[...results.map(s => s.genre)]}
      />
      <ResultsList results={results} />
    </>
  );
}
```

---

## Documentación Adicional

- **Documentación Completa**: Ver `docs/SEO.md`
- **Resumen de Cambios**: Ver `SEO_IMPLEMENTATION.md`
- **Lista de Cambios**: Ver `CHANGES.md`

---

## ¿Preguntas?

Revisa:
1. Comentarios en código (`src/hooks/useMetaTags.ts`)
2. Archivos de documentación
3. Ejemplos en este guía
4. Archivo README del proyecto

