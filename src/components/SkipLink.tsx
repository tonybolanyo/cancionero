import React from 'react';

export const SkipLink: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-[var(--accent-primary)] focus:text-white focus:px-4 focus:py-2 focus:rounded focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-primary)]"
    >
      Saltar al contenido principal
    </a>
  );
};
