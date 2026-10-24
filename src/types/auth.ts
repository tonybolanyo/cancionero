export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio?: string;
  email?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isAuthor: boolean;
  user: GitHubUser | null;
  token: string | null;
  authorizedUsername: string;
  rememberMe: boolean;
}
