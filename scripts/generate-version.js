#!/usr/bin/env node

/**
 * Version generator for semantic versioning with automatic build numbers.
 * Uses Git to extract version info and generates a build number using:
 * - Build Number Formula: commit_count (incremental with each build)
 * - This is a standard practice in software industry (Maven, npm, etc.)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getGitInfo() {
  try {
    // Get all tags sorted by version
    const tagsOutput = execSync('git tag -l --sort=-version:refname --merged HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    const tags = tagsOutput ? tagsOutput.split('\n').filter(t => t) : [];
    
    // Get current version from package.json
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    let currentVersion = packageJson.version || '0.0.0';
    
    // Extract semantic version parts
    let [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Find the latest tag that matches semantic versioning
    for (const tag of tags) {
      const match = tag.match(/^v?(\d+\.\d+\.\d+)$/);
      if (match) {
        const [tagMajor, tagMinor, tagPatch] = match[1].split('.').map(Number);
        // Update if we haven't set a version yet or if tag is newer
        if (!currentVersion.match(/^\d+\.\d+\.\d+$/) || 
            tagMajor > major || 
            (tagMajor === major && tagMinor > minor) ||
            (tagMajor === major && tagMinor === minor && tagPatch > patch)) {
          major = tagMajor;
          minor = tagMinor;
          patch = tagPatch;
        }
        break;
      }
    }
    
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
      version: `${major}.${minor}.${patch}`,
      buildNumber,
      commitHash,
      branch,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting git info:', error.message);
    return {
      version: '0.0.0',
      buildNumber: 0,
      commitHash: 'unknown',
      branch: 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

function generateVersionFile() {
  const versionInfo = getGitInfo();
  
  const versionContent = `// Auto-generated version file - DO NOT EDIT
// Generated at ${versionInfo.timestamp}

export const APP_VERSION = '${versionInfo.version}';
export const BUILD_NUMBER = ${versionInfo.buildNumber};
export const COMMIT_HASH = '${versionInfo.commitHash}';
export const BUILD_BRANCH = '${versionInfo.branch}';
export const BUILD_TIMESTAMP = '${versionInfo.timestamp}';

/**
 * Version string including build metadata
 * Format: MAJOR.MINOR.PATCH+buildNumber
 * Example: 1.2.3+1042
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
  console.log(`  Version: ${versionInfo.version}`);
  console.log(`  Build Number: ${versionInfo.buildNumber}`);
  console.log(`  Commit: ${versionInfo.commitHash}`);
  console.log(`  Branch: ${versionInfo.branch}`);
}

generateVersionFile();
