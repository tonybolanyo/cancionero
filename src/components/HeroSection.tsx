import React from 'react';
import { Play, FolderGit2, Lock } from 'lucide-react';
import { Song } from '../types/song';
import { siteMetadata } from '../utils/siteConfig';
import bannerImage from '../assets/images/songwriter_studio_banner_1792313088629.jpg';

interface HeroSectionProps {
  songs: Song[];
  onPlayFeatured: (song: Song) => void;
  onOpenGitModal: () => void;
  onExploreCatalog: () => void;
  isAuthor: boolean;
  onOpenAuthModal: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  songs,
  onPlayFeatured,
  onOpenGitModal,
  onExploreCatalog,
  isAuthor,
  onOpenAuthModal
}) => {
  const publishedCount = songs.filter(s => s.status === 'published').length;
  const draftCount = songs.filter(s => s.status === 'draft').length;
  const privateCount = songs.filter(s => s.status === 'private').length;
  const audioCount = songs.filter(s => s.spotifyUrl || s.youtubeUrl || s.soundcloudUrl || s.audioUrl).length;

  const featuredSong = songs.find(s => s.id === 'algo-quiere-salir' && s.status === 'published') 
    || songs.find(s => s.status === 'published' && (s.spotifyUrl || s.youtubeUrl || s.audioUrl))
    || songs.find(s => s.status === 'published') 
    || songs[0] 
    || null;

  return (
    <section className="relative pt-8 pb-12 overflow-hidden border-b border-[var(--border-subtle)] transition-colors duration-200">
      <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Split Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Column: Typographic Hierarchy */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Quiet editorial kicker */}
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-primary)] tracking-wider uppercase mb-3">
              <span>{siteMetadata.subtitle}</span>
              <span aria-hidden="true">·</span>
              <span>Web Estática & Git</span>
            </div>

            {/* Display headline - Uses site title from metadata.json */}
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.15] text-balance mb-5">
              {siteMetadata.name}
            </h1>

            {/* Lead editorial copy - Uses description from metadata.json */}
            <p className="text-base sm:text-lg text-[var(--text-secondary)] font-normal leading-relaxed max-w-2xl mb-8">
              {siteMetadata.description}
            </p>

            {/* Functional action triggers */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onExploreCatalog}
                className="px-5 py-3 text-sm font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                Explorar Repertorio
              </button>

              {isAuthor ? (
                <button
                  onClick={onOpenGitModal}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FolderGit2 className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Gestor de Archivos Git</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Acceso de Autor (GitHub)</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Visual Container */}
          <div className="lg:col-span-5 relative group">
            <div className="relative h-72 sm:h-80 lg:h-full min-h-[320px] rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] shadow-xl">
              <img
                src={bannerImage}
                alt="Estudio de composición con guitarra acústica, libreta de letras y luz cálida"
                className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              
              {/* Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

              {/* In-image featured badge */}
              {featuredSong ? (
                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[11px] font-mono text-amber-300 uppercase tracking-wider block">
                        Tema Destacado
                      </span>
                      <h2 className="text-white font-serif font-semibold text-base sm:text-lg truncate">
                        {featuredSong.title}
                      </h2>
                      <p className="text-xs text-stone-300 truncate">
                        {featuredSong.year} · {featuredSong.genre} · Tonalidad {featuredSong.key}
                      </p>
                    </div>
                    <button
                      onClick={() => onPlayFeatured(featuredSong)}
                      className="w-11 h-11 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center shrink-0 shadow-lg active:scale-95 transition-all cursor-pointer"
                      title="Escuchar y ver letra"
                    >
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white">
                  <span className="text-xs text-stone-200 font-serif">
                    Archivo de canciones de autor en Markdown & Git
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4-Column KPI strip below the split */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-[var(--border-subtle)]">
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)] block">
              {publishedCount}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Temas editados con letra
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[var(--accent-primary)] block">
              {audioCount}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Con audio en streaming
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[var(--text-secondary)] block">
              {isAuthor ? draftCount : '100%'}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {isAuthor ? 'Borradores en desarrollo' : 'Web estática sin servidor'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[var(--text-muted)] block">
              {isAuthor ? privateCount : 'Markdown'}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {isAuthor ? 'Inéditas privadas' : 'Archivos y control Git'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
