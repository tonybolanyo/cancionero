#!/usr/bin/env node

/**
 * Changelog generator for semantic versioning
 * Generates changelog entries from conventional commits
 * 
 * Features:
 * - Parses conventional commits (feat, fix, refactor, etc.)
 * - Groups changes by type (Features, Fixes, Breaking Changes, etc.)
 * - Updates CHANGELOG.md with new version entries
 * - Generates changelog for GitHub releases
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse conventional commits into structured format
 */
function parseCommits(commitLog) {
  const commits = {
    breaking: [],
    features: [],
    fixes: [],
    refactors: [],
    docs: [],
    style: [],
    perf: [],
    tests: [],
    chore: [],
    other: []
  };

  if (!commitLog) return commits;

  const lines = commitLog.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Format: hash - subject (author)
    const match = line.match(/^([a-f0-9]+)\s*-\s*(.+?)\s*\((.+?)\)$/);
    if (!match) continue;

    const [, hash, subject, author] = match;
    const shortHash = hash.substring(0, 7);

    // Check for breaking changes
    if (subject.includes('BREAKING CHANGE') || subject.includes('!:')) {
      commits.breaking.push({ hash: shortHash, subject, author });
    }
    // Parse type(scope): message
    else if (subject.match(/^feat(\(.+?\))?:\s/)) {
      commits.features.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^fix(\(.+?\))?:\s/)) {
      commits.fixes.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^refactor(\(.+?\))?:\s/)) {
      commits.refactors.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^docs(\(.+?\))?:\s/)) {
      commits.docs.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^style(\(.+?\))?:\s/)) {
      commits.style.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^perf(\(.+?\))?:\s/)) {
      commits.perf.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^test(\(.+?\))?:\s/)) {
      commits.tests.push({ hash: shortHash, subject, author });
    } else if (subject.match(/^chore(\(.+?\))?:\s/)) {
      commits.chore.push({ hash: shortHash, subject, author });
    } else {
      commits.other.push({ hash: shortHash, subject, author });
    }
  }

  return commits;
}

/**
 * Get commits since last tag
 */
function getCommitsSinceLastTag() {
  try {
    const tagsOutput = execSync('git tag -l --sort=-version:refname', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    const tags = tagsOutput ? tagsOutput.split('\n').filter(t => t) : [];
    let lastTag = null;

    // Find latest semantic version tag
    for (const tag of tags) {
      if (tag.match(/^v?\d+\.\d+\.\d+$/)) {
        lastTag = tag;
        break;
      }
    }

    let commitLog;
    if (lastTag) {
      commitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"%h - %s (%an)" --no-decorate`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    } else {
      commitLog = execSync('git log --pretty=format:"%h - %s (%an)" --no-decorate', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    }

    return { commitLog, lastTag };
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return { commitLog: '', lastTag: null };
  }
}

/**
 * Format commits into changelog section
 */
function formatCommitsForChangelog(commits) {
  let changelog = '';

  if (commits.breaking.length > 0) {
    changelog += '### ⚠️ Breaking Changes\n\n';
    for (const commit of commits.breaking) {
      const message = commit.subject.replace(/BREAKING[\s-]CHANGE:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.features.length > 0) {
    changelog += '### 🎉 Features\n\n';
    for (const commit of commits.features) {
      const message = commit.subject.replace(/^feat(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.fixes.length > 0) {
    changelog += '### 🐛 Bug Fixes\n\n';
    for (const commit of commits.fixes) {
      const message = commit.subject.replace(/^fix(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.perf.length > 0) {
    changelog += '### ⚡ Performance Improvements\n\n';
    for (const commit of commits.perf) {
      const message = commit.subject.replace(/^perf(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.refactors.length > 0) {
    changelog += '### ♻️ Code Refactoring\n\n';
    for (const commit of commits.refactors) {
      const message = commit.subject.replace(/^refactor(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.docs.length > 0) {
    changelog += '### 📚 Documentation\n\n';
    for (const commit of commits.docs) {
      const message = commit.subject.replace(/^docs(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.style.length > 0) {
    changelog += '### 🎨 Styling\n\n';
    for (const commit of commits.style) {
      const message = commit.subject.replace(/^style(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.tests.length > 0) {
    changelog += '### ✅ Tests\n\n';
    for (const commit of commits.tests) {
      const message = commit.subject.replace(/^test(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  if (commits.other.length > 0) {
    changelog += '### 🔄 Other Changes\n\n';
    for (const commit of commits.other) {
      changelog += `- ${commit.subject} ([${commit.hash}](../../commit/${commit.hash})) - ${commit.author}\n`;
    }
    changelog += '\n';
  }

  return changelog.trim();
}

/**
 * Generate short changelog for GitHub release
 */
function generateReleaseChangelog(commits) {
  let changelog = '';

  if (commits.breaking.length > 0) {
    changelog += '### ⚠️ Breaking Changes\n';
    for (const commit of commits.breaking.slice(0, 5)) {
      const message = commit.subject.replace(/BREAKING[\s-]CHANGE:\s*/, '').trim();
      changelog += `- ${message}\n`;
    }
    if (commits.breaking.length > 5) {
      changelog += `- ... and ${commits.breaking.length - 5} more breaking changes\n`;
    }
    changelog += '\n';
  }

  if (commits.features.length > 0) {
    changelog += '### 🎉 Features\n';
    for (const commit of commits.features.slice(0, 5)) {
      const message = commit.subject.replace(/^feat(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message}\n`;
    }
    if (commits.features.length > 5) {
      changelog += `- ... and ${commits.features.length - 5} more features\n`;
    }
    changelog += '\n';
  }

  if (commits.fixes.length > 0) {
    changelog += '### 🐛 Bug Fixes\n';
    for (const commit of commits.fixes.slice(0, 5)) {
      const message = commit.subject.replace(/^fix(\(.+?\))?:\s*/, '').trim();
      changelog += `- ${message}\n`;
    }
    if (commits.fixes.length > 5) {
      changelog += `- ... and ${commits.fixes.length - 5} more fixes\n`;
    }
    changelog += '\n';
  }

  return changelog.trim();
}

/**
 * Update CHANGELOG.md file
 */
function updateChangelogFile(version, changelog, date = new Date()) {
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  
  const dateStr = date.toISOString().split('T')[0];
  const versionHeader = `## [${version}] - ${dateStr}\n\n`;
  
  const newEntry = versionHeader + changelog + '\n\n---\n\n';

  let content = '';
  if (fs.existsSync(changelogPath)) {
    content = fs.readFileSync(changelogPath, 'utf-8');
  }

  // Keep the header
  const header = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
  
  // Remove old header if exists
  let bodyContent = content.replace(/^# Changelog\n\nAll notable.*?\n\n/s, '');
  
  // Add new entry
  const updatedContent = header + newEntry + bodyContent;

  fs.writeFileSync(changelogPath, updatedContent);
  console.log(`✓ CHANGELOG.md updated with version ${version}`);
}

/**
 * Main function to generate changelog
 */
export function generateChangelog(version) {
  console.log('📝 Generating changelog...\n');

  const { commitLog, lastTag } = getCommitsSinceLastTag();

  if (!commitLog) {
    console.log('⚠️  No commits found since last tag');
    return { changelog: '', releaseChangelog: '' };
  }

  const commits = parseCommits(commitLog);
  const totalCommits = Object.values(commits).reduce((sum, arr) => sum + arr.length, 0);
  
  console.log(`📊 Found ${totalCommits} commits since ${lastTag || 'repository start'}`);
  console.log(`   Breaking: ${commits.breaking.length}, Features: ${commits.features.length}, Fixes: ${commits.fixes.length}`);

  const changelog = formatCommitsForChangelog(commits);
  const releaseChangelog = generateReleaseChangelog(commits);

  if (version) {
    updateChangelogFile(version, changelog);
  }

  console.log(`✓ Changelog generated for ${totalCommits} commits\n`);

  return { changelog, releaseChangelog };
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: generate-changelog.js <version>');
    console.error('Example: generate-changelog.js 1.2.3');
    process.exit(1);
  }

  const { releaseChangelog } = generateChangelog(version);

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `changelog<<EOF\n${releaseChangelog}\nEOF`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
  } else {
    console.log('Release Changelog:\n');
    console.log(releaseChangelog);
  }
}

export { parseCommits, formatCommitsForChangelog, generateReleaseChangelog };
