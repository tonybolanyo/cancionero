/**
 * Configuration for Author Authentication via GitHub
 * 
 * In a static website deployed on GitHub Pages:
 * - NO private secrets, passwords, or tokens are ever stored in the repository.
 * - The authorized GitHub username is configured here (or via VITE_GITHUB_ALLOWED_USER in build env).
 * - Only personal access tokens belonging to this exact GitHub user will be accepted.
 * - If any other GitHub account enters their token, authentication is strictly rejected by verifying
 *   the authenticated profile against the official GitHub REST API (https://api.github.com/user).
 */

export const AUTHORIZED_GITHUB_USER: string = (
  (import.meta.env.VITE_GITHUB_ALLOWED_USER as string | undefined) || 'tonygb'
).trim().toLowerCase();

/**
 * Validates whether a given GitHub login belongs to the authorized author
 */
export function isAuthorizedAuthorLogin(login: string | undefined | null): boolean {
  if (!login) return false;
  return login.trim().toLowerCase() === AUTHORIZED_GITHUB_USER;
}
