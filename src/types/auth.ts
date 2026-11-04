export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio?: string;
  email?: string;
}

export interface GoogleAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  isAuthor: boolean;
  user: GitHubUser | null;
  token: string | null;
  authorizedUsername: string;
  rememberMe: boolean;
  googleUser?: GoogleAuthUser | null;
  isGoogleDriveConnected?: boolean;
}
