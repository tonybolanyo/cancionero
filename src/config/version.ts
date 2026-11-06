// Auto-generated version file - DO NOT EDIT
// Generated at 2026-11-06T21:50:56.531Z
// Managed by release-please with conventional commits analysis

export const APP_VERSION = '0.1.0';
export const BUILD_NUMBER = 1;
export const COMMIT_HASH = '0f4dff5';
export const BUILD_BRANCH = 'expert-goggles';
export const BUILD_TIMESTAMP = '2026-11-06T21:50:56.531Z';

/**
 * Version string including build metadata
 * Format: MAJOR.MINOR.PATCH+buildNumber
 * Example: 1.2.3+1042
 * 
 * The semantic version (MAJOR.MINOR.PATCH) is automatically updated based on 
 * Conventional Commits analysis:
 * - feat: MINOR version bump
 * - fix: PATCH version bump  
 * - BREAKING CHANGE: MAJOR version bump
 * 
 * Collision Detection: If a version already exists as a git tag, the patch
 * version is automatically incremented to ensure uniqueness.
 */
export const FULL_VERSION = `${APP_VERSION}+${BUILD_NUMBER}`;

/**
 * Display version for UI
 * Format: v1.2.3 (build: 1042)
 */
export const DISPLAY_VERSION = `v${APP_VERSION} (build: ${BUILD_NUMBER})`;
