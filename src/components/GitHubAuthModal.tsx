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
  UserCheck,
  ShieldAlert,
  Loader2
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
    loginWithGitHub,
    logout,
    isVerifyingSession
  } = useAuth();

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const result = await loginWithGitHub(token, rememberMe);
    setIsLoading(false);

    if (result.success && result.user) {
      setStatusMessage({
        type: 'success',
        text: `Identidad verificada con éxito como @${result.user.login}. Modo autor activado.`
      });
      setToken('');
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1500);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Error al autenticar credenciales con GitHub.'
      });
    }
  };

  const handleLogout = () => {
    logout();
    setStatusMessage(null);
    setToken('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-y-auto text-[var(--text-primary)] transition-colors duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] shadow-sm">
              {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                {isAuthenticated ? 'Sesión de Autor Verificada' : 'Acceso Restringido de Autor'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Verificación directa con GitHub API · Cero secretos en el repositorio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-6 space-y-5 bg-[var(--bg-surface)]">
          {/* Security architecture banner */}
          <div className="p-4 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs text-[var(--text-secondary)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--accent-primary)]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Autorización exclusiva para @{authorizedUsername}</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-modal)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                GitHub Pages
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              El repositorio y la web estática en GitHub Pages son completamente públicos y <strong>no contienen ningún dato sensible ni token</strong>.
              El acceso a la sección de autor está protegido criptográficamente: solo el usuario titular de la cuenta <strong className="text-[var(--text-primary)] font-mono">@{authorizedUsername}</strong> puede desbloquear la edición tras validar su identidad con la API de GitHub.
            </p>
          </div>

          {/* Status feedback banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{statusMessage.text}</span>
            </div>
          )}

          {isAuthenticated && user ? (
            /* Logged in state for authorized author */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-start gap-4">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-13 h-13 rounded-full border-2 border-[var(--accent-primary)] object-cover shadow-sm shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif font-bold text-[var(--text-primary)] text-base truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-[var(--accent-primary)] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
                      @{user.login}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Identidad verificada como Autor Único</span>
                  </div>

                  {user.bio && (
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 italic font-serif">
                      "{user.bio}"
                    </p>
                  )}

                  <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                    Tienes permisos completos para componer nuevas canciones, editar letras y cifrados, gestionar borradores e inéditas y registrar commits en Git.
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
                  onClick={handleLogout}
                  className="px-4 py-2 text-xs font-semibold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar Sesión de Autor
                </button>
              </div>
            </div>
          ) : (
            /* Login Form for the author */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Authorized user badge - Not editable by unauthorized visitors */}
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block font-medium">
                      Cuenta de GitHub autorizada
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      @{authorizedUsername}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Único titular</span>
                </span>
              </div>

              {/* Personal Access Token Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Personal Access Token (PAT) de GitHub de @{authorizedUsername}
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?description=Cancionero+Tony+Auto+Commit+and+Push&scopes=repo,read:user"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-semibold"
                    title="Crear un token en GitHub con alcance 'repo' para permitir auto-commit y push"
                  >
                    <span>Generar token con 'repo'</span>
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
                    placeholder="ghp_... o github_pat_..."
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    title={showToken ? 'Ocultar token' : 'Mostrar token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-[11px] text-[var(--text-muted)] space-y-1.5 leading-relaxed p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                  <p>
                    🔑 <strong>Permisos recomendados para Auto-Commit y Push</strong>:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>Token Clásico</strong>: Marca el permiso <code className="text-[var(--accent-primary)] font-semibold font-mono">repo</code> (o <code className="text-[var(--accent-primary)] font-semibold font-mono">public_repo</code> si el repositorio es público) y <code className="font-mono">read:user</code>.
                    </li>
                    <li>
                      <strong>Token Fine-grained</strong>: Selecciona el repositorio <code className="text-[var(--text-primary)] font-mono font-semibold">cancionero</code> y en <em>Repository permissions</em> otorga <code className="text-[var(--accent-primary)] font-semibold font-mono">Contents: Read and write</code>.
                    </li>
                  </ul>
                  <p className="text-[10px] text-[var(--text-muted)] pt-0.5 italic">
                    Con este permiso, cada vez que crees, edites o renombres una canción, se hará automáticamente el commit y el <strong>push directo a github.com/{authorizedUsername}/cancionero</strong>.
                  </p>
                </div>
              </div>

              {/* Persistence option */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] bg-[var(--bg-input)] border-[var(--border-subtle)] cursor-pointer"
                  />
                  <span>Recordar sesión en este navegador (usar solo en tu equipo personal)</span>
                </label>
              </div>

              {/* Action button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || isVerifyingSession || !token.trim()}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando credenciales con GitHub...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Verificar y Entrar como Autor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
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
