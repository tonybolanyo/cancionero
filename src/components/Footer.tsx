import React from 'react';
import { Music2, FolderGit2, Lock, BarChart3 } from 'lucide-react';
import { siteMetadata } from '../utils/siteConfig';
import { DISPLAY_VERSION, BUILD_BRANCH } from '../config/version';

interface FooterProps {
  isAuthor: boolean;
  onDashboardClick: () => void;
  onGitSyncClick: () => void;
  onAuthClick: () => void;
  onAboutClick: () => void;
}

export function Footer({
  isAuthor,
  onDashboardClick,
  onGitSyncClick,
  onAuthClick,
  onAboutClick,
}: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-10 transition-colors duration-200">
      <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Main footer content */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[var(--text-muted)]">
          <div>
            <p className="font-serif text-[var(--text-primary)] font-semibold mb-1">
              {siteMetadata.name}
            </p>
            <p className="text-[var(--text-muted)] max-w-xl">
              {siteMetadata.description}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={onDashboardClick}
              className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
              aria-label="Dashboard & Estadísticas"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Dashboard & Estadísticas</span>
            </button>

            {isAuthor ? (
              <button
                onClick={onGitSyncClick}
                className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                aria-label="Sincronizar con Git"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Sincronizar con Git</span>
              </button>
            ) : (
              <button
                onClick={onAuthClick}
                className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Acceso Autor (GitHub)"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Acceso Autor (GitHub)</span>
              </button>
            )}

            <button
              onClick={onAboutClick}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              aria-label="Manifiesto"
            >
              Manifiesto
            </button>
            <a
              href="mailto:tony@tonygb.com"
              className="hover:text-[var(--text-primary)] transition-colors"
              aria-label="Contacto de Autor"
            >
              Contacto de Autor
            </a>
          </div>
        </div>

        {/* Version info - subtle display at bottom */}
        <div className="mt-6 pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5 text-[var(--accent-primary)] opacity-50" />
            <span>{DISPLAY_VERSION}</span>
            {BUILD_BRANCH && !['unknown', 'master', 'main'].includes(BUILD_BRANCH) && (
              <span className="ml-2 px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] opacity-75">
                {BUILD_BRANCH}
              </span>
            )}
          </div>
          <p className="text-[0.7rem] opacity-50">
            © {new Date().getFullYear()} {siteMetadata.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
