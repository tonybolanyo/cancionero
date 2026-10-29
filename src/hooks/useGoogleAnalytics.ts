import { useEffect } from 'react';

/**
 * Hook para inyectar Google Analytics en React
 * Usa la variable de entorno VITE_GOOGLE_ANALYTICS_ID
 * 
 * Uso:
 *   useGoogleAnalytics();
 * 
 * En .env.local:
 *   VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
 */
export function useGoogleAnalytics() {
  useEffect(() => {
    const gaId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;

    if (!gaId) {
      console.debug('[GA] No Google Analytics ID configured');
      return;
    }

    // Cargar script de Google Analytics
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    // Configurar Google Analytics
    window.dataLayer = window.dataLayer || [];
    function gtag(...args) {
      window.dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', gaId, {
      page_path: window.location.pathname,
      anonymize_ip: true,
    });

    window.gtag = gtag;

    console.debug(`[GA] Google Analytics initialized (ID: ${gaId})`);
  }, []);
}

/**
 * Hook para rastrear eventos personalizados en Google Analytics
 * 
 * Uso:
 *   const trackEvent = useGAEvent();
 *   trackEvent('song_played', { song_id: '123', artist: 'John Doe' });
 */
export function useGAEvent() {
  return (eventName, eventData = {}) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, eventData);
      console.debug(`[GA Event] ${eventName}`, eventData);
    } else {
      console.debug(`[GA Event] ${eventName} (GA not initialized)`, eventData);
    }
  };
}

/**
 * Hook para rastrear page views manualmente
 * Útil en SPAs donde la URL cambia sin recargar
 * 
 * Uso:
 *   usePageView();
 *   // En cambios de ruta:
 *   usePageView(newPath);
 */
export function usePageView(path = '') {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      const pageUrl = path || window.location.pathname;
      window.gtag('config', import.meta.env.VITE_GOOGLE_ANALYTICS_ID, {
        page_path: pageUrl,
      });
      console.debug(`[GA PageView] ${pageUrl}`);
    }
  }, [path]);
}

/**
 * Componente wrapper para inyectar Google Analytics globalmente
 * 
 * Uso en App.tsx:
 *   import { GoogleAnalyticsProvider } from './hooks/useGoogleAnalytics';
 *   
 *   export default function App() {
 *     return (
 *       <GoogleAnalyticsProvider>
 *         <YourApp />
 *       </GoogleAnalyticsProvider>
 *     );
 *   }
 */
export function GoogleAnalyticsProvider({ children }) {
  useGoogleAnalytics();
  return children;
}

// Declaración de tipos para TypeScript
declare global {
  interface Window {
    gtag: (...args) => void;
    dataLayer: any[];
  }
}
