#!/usr/bin/env node

/**
 * Version generator for semantic versioning with automatic build numbers.
 * Works with release-please for automated semantic versioning.
 * 
 * Features:
 * - Analyzes conventional commits (feat:, fix:, BREAKING CHANGE:)
 * - Implements full semantic versioning (MAJOR.MINOR.PATCH)
 * - Detects and avoids git tag collisions (increments patch if collision detected)
 * - Always ensures version increment
 * - Build Number Formula: commit_count (incremental with each build)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse conventional commit types to determine version bump
 * Returns: 'major', 'minor', 'patch', or 'none'
 */
function analyzeCommits() {
  try {
    // Get latest git tag or use 0.0.0 as base
    const tagsOutput = execSync('git tag -l --sort=-version:refname', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    const tags = tagsOutput ? tagsOutput.split('\n').filter(t => t) : [];
    let latestTag = null;
    
    // Find latest semantic version tag
    for (const tag of tags) {
      const match = tag.match(/^v?(\d+\.\d+\.\d+)$/);
      if (match) {
        latestTag = tag;
        break;
      }
    }
    
    // Get commits since latest tag (or all if no tag)
    let commitLog;
    if (latestTag) {
      commitLog = execSync(`git log ${latestTag}..HEAD --format=%B --no-decorate`, { 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    } else {
      commitLog = execSync('git log --format=%B --no-decorate', { 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    }
    
    if (!commitLog) {
      return { bump: 'none', latestTag };
    }
    
    // Analyze commits for bump type
    const hasBreaking = /BREAKING[\s-]CHANGE/i.test(commitLog);
    const hasFeature = /^feat(\(.*\))?:/m.test(commitLog);
    const hasFix = /^fix(\(.*\))?:/m.test(commitLog);
    
    let bump = 'none';
    if (hasBreaking) bump = 'major';
    else if (hasFeature) bump = 'minor';
    else if (hasFix) bump = 'patch';
    
    return { bump, latestTag, commitLog };
  } catch (error) {
    console.error('Error analyzing commits:', error.message);
    return { bump: 'patch', latestTag: null };
  }
}

/**
 * Calculate next version based on bump type and existing tags
 */
function getNextVersion(bump) {
  try {
    // Get all semantic version tags
    const tagsOutput = execSync('git tag -l --sort=-version:refname', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    const tags = tagsOutput ? tagsOutput.split('\n').filter(t => t) : [];
    const versions = tags
      .map(tag => tag.match(/^v?(\d+\.\d+\.\d+)$/)?.[1])
      .filter(Boolean)
      .sort((a, b) => {
        const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
        return (bMajor - aMajor) || (bMinor - aMinor) || (bPatch - aPatch);
      });
    
    let [major, minor, patch] = versions.length > 0
      ? versions[0].split('.').map(Number)
      : [0, 0, 0];
    
    // Calculate next version based on bump type
    switch (bump) {
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor++;
        patch = 0;
        break;
      case 'patch':
      case 'none':
      default:
        patch++;
        break;
    }
    
    const nextVersion = `${major}.${minor}.${patch}`;
    const nextTag = `v${nextVersion}`;
    
    // Check for collision and increment patch if needed
    let finalVersion = nextVersion;
    let finalTag = nextTag;
    let collisionCount = 0;
    
    while (versions.includes(finalVersion)) {
      const [fMajor, fMinor, fPatch] = finalVersion.split('.').map(Number);
      finalVersion = `${fMajor}.${fMinor}.${fPatch + 1}`;
      finalTag = `v${finalVersion}`;
      collisionCount++;
      
      if (collisionCount > 1000) {
        throw new Error('Too many version collision attempts');
      }
    }
    
    return { version: finalVersion, tag: finalTag, previousVersions: versions };
  } catch (error) {
    console.error('Error calculating next version:', error.message);
    return { version: '0.0.1', tag: 'v0.0.1', previousVersions: [] };
  }
}

function getGitInfo(semanticVersion) {
  try {
    // Get total commit count (standard build number formula in industry)
    let buildNumber = 0;
    try {
      buildNumber = parseInt(
        execSync('git rev-list --count HEAD', { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim()
      );
    } catch {
      buildNumber = 0;
    }
    
    // Get short commit hash
    const commitHash = execSync('git rev-parse --short HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    // Get branch name
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    return {
      version: semanticVersion,
      buildNumber,
      commitHash,
      branch,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting git info:', error.message);
    return {
      version: semanticVersion,
      buildNumber: 0,
      commitHash: 'unknown',
      branch: 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

function generateVersionFile() {
  // Analyze commits to determine version bump
  const analysis = analyzeCommits();
  console.log(`📊 Commit Analysis: ${analysis.bump} bump`);
  if (analysis.latestTag) {
    console.log(`   Latest tag: ${analysis.latestTag}`);
  }
  
  // Calculate next version with collision detection
  const { version: nextVersion, tag: nextTag, previousVersions } = getNextVersion(analysis.bump);
  console.log(`✓ Next version: ${nextVersion}`);
  console.log(`   Tag: ${nextTag}`);
  if (previousVersions.length > 0) {
    console.log(`   Previous versions: ${previousVersions.slice(0, 3).join(', ')}${previousVersions.length > 3 ? '...' : ''}`);
  }
  
  // Get git info
  const versionInfo = getGitInfo(nextVersion);
  
  const versionContent = `// Auto-generated version file - DO NOT EDIT
// Generated at ${versionInfo.timestamp}
// Managed by release-please with conventional commits analysis

export const APP_VERSION = '${versionInfo.version}';
export const BUILD_NUMBER = ${versionInfo.buildNumber};
export const COMMIT_HASH = '${versionInfo.commitHash}';
export const BUILD_BRANCH = '${versionInfo.branch}';
export const BUILD_TIMESTAMP = '${versionInfo.timestamp}';

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
export const FULL_VERSION = \`\$\{APP_VERSION\}+\$\{BUILD_NUMBER\}\`;

/**
 * Display version for UI
 * Format: v1.2.3 (build: 1042)
 */
export const DISPLAY_VERSION = \`v\$\{APP_VERSION\} (build: \$\{BUILD_NUMBER\})\`;
`;

  const outputPath = path.join(__dirname, '../src/config/version.ts');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, versionContent);
  console.log('✓ Version file generated at src/config/version.ts');
  console.log(`  App Version: ${versionInfo.version}`);
  console.log(`  Build Number: ${versionInfo.buildNumber}`);
  console.log(`  Commit: ${versionInfo.commitHash}`);
  console.log(`  Branch: ${versionInfo.branch}`);
}

generateVersionFile();

