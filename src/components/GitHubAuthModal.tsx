import React, { useState } from 'react';
import {
  X,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface GitHubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubAuthModal: React.FC<GitHubAuthModalProps> = ({ isOpen, onClose }) => {
  const {
    isAuthenticated,
    user,
    authorizedUsername,
    setAuthorizedUsername,
    loginWithGitHub,
    logout,
    simulateAuthorDemoLogin
  } = useAuth();

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [customUsername, setCustomUsername] = useState(authorizedUsername);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    // Save custom username
    setAuthorizedUsername(customUsername);

    const result = await loginWithGitHub(token, customUsername);
    setIsLoading(false);

    if (result.success && result.user) {
      setStatusMessage({
        type: 'success',
        text: `¡Bienvenido Tony! Autenticado como @${result.user.login}. Modo autor activado.`
      });
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1500);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Error al autenticar con GitHub.'
      });
    }
  };

  const handleDemoLogin = () => {
    setAuthorizedUsername(customUsername);
    simulateAuthorDemoLogin();
    setStatusMessage({
      type: 'success',
      text: `Modo autor activado para pruebas en vista previa.`
    });
    setTimeout(() => {
      onClose();
      setStatusMessage(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-y-auto text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                {isAuthenticated ? 'Sesión de Autor Activa' : 'Acceso de Autor con GitHub'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Autenticación 100% estática para la administración del cancionero
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
          {isAuthenticated && user ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center gap-4">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-12 h-12 rounded-full border border-[var(--border-medium)] object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)] text-sm truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-[var(--accent-primary)] font-mono font-medium">
                      @{user.login}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Modo autor activado. Tienes acceso completo para crear canciones, editar borradores y gestionar Git.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={`https://github.com/${user.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Ver perfil en GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={logout}
                  className="px-4 py-2 text-xs font-semibold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500/80 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar Sesión de Autor
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Architecture info note */}
              <div className="p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs text-[var(--text-secondary)] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--accent-primary)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sin backend dedicado (Web 100% estática)</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Para que puedas publicar el cancionero en GitHub Pages o cualquier hosting estático, la verificación de identidad se realiza directamente desde tu navegador contra <code className="text-[var(--text-primary)] font-mono">api.github.com</code>.
                </p>
              </div>

              {/* Status banner */}
              {statusMessage && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300'
                }`}>
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Authorized Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)] block">
                  Tu nombre de usuario en GitHub
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="tonygb"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Solo esta cuenta de GitHub tendrá permisos de edición y acceso a borradores.
                </span>
              </div>

              {/* Token Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Token de acceso personal de GitHub (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?description=Cancionero+Tony+Author+Mode&scopes=read:user"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Generar en GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx o github_pat_..."
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block leading-relaxed">
                  Solo requiere el permiso mínimo <code className="text-[var(--accent-primary)] font-semibold">read:user</code> para validar tu identidad. No requiere acceso a repositorios privados si no lo deseas.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLoading ? 'Verificando con GitHub...' : 'Verificar y Entrar como Autor'}</span>
                </button>

                {/* Instant preview testing button */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    ¿Probando en vista previa sin token?
                  </span>
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                  >
                    Activar Modo Autor de Prueba
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
