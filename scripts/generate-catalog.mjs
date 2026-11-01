#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const songsDir = path.join(projectRoot, 'songs');
const catalogPath = path.join(projectRoot, 'catalog.json');
const publicDir = path.join(projectRoot, 'public');
const publicCatalogPath = path.join(publicDir, 'catalog.json');

// Simple markdown frontmatter parser to extract YAML front matter
function parseMarkdownFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract frontmatter between --- markers
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.warn(`⚠️  No frontmatter found in ${path.basename(filePath)}`);
      return null;
    }
    
    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split('\n');
    const metadata = {};
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Handle key: value pairs
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse JSON arrays for tags
      if (key === 'tags') {
        try {
          const match = value.match(/^\[(.*)\]$/);
          if (match) {
            metadata[key] = match[1]
              .split(',')
              .map(tag => tag.trim().replace(/^["']|["']$/g, ''));
          } else {
            metadata[key] = [value];
          }
        } catch {
          metadata[key] = [value];
        }
      } else if (key === 'tempo' || key === 'year') {
        metadata[key] = parseInt(value, 10) || 0;
      } else if (key === 'createdAt' || key === 'updatedAt') {
        metadata[key] = value;
      } else {
        metadata[key] = value;
      }
    }
    
    // Extract body (lyrics) after frontmatter
    const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : '';
    metadata.lyrics = body;

    return metadata;
  } catch (err) {
    console.error(`❌ Error parsing ${path.basename(filePath)}:`, err.message);
    return null;
  }
}

// Generate catalog from markdown files
function generateCatalog() {
  try {
    if (!fs.existsSync(songsDir)) {
      console.error(`❌ Songs directory not found: ${songsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(songsDir).filter(f => f.endsWith('.md'));
    const songs = [];
    let parseErrors = 0;
    
    for (const file of files) {
      const filePath = path.join(songsDir, file);
      const metadata = parseMarkdownFile(filePath);
      
      if (metadata) {
        songs.push(metadata);
      } else {
        parseErrors++;
      }
    }

    // Sort: published first, then drafts, then private; then by year/recency
    songs.sort((a, b) => {
      const statusOrder = { published: 1, draft: 2, private: 3 };
      const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (orderDiff !== 0) return orderDiff;
      const bTs = Date.parse(b.updatedAt || new Date(0).toISOString());
      const aTs = Date.parse(a.updatedAt || new Date(0).toISOString());
      if (bTs !== aTs) return bTs - aTs;
      return (b.year || 0) - (a.year || 0);
    });

    // Write to root catalog.json
    fs.writeFileSync(catalogPath, JSON.stringify(songs, null, 2) + '\n');
    console.log(`✅ Generated catalog.json with ${songs.length} songs`);

    // Also copy to public/ for serving
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.copyFileSync(catalogPath, publicCatalogPath);
    console.log(`✅ Copied catalog.json to public/`);

    // Write to src/data/bundledSongs.json for direct zero-latency import
    const bundledDataPath = path.join(projectRoot, 'src', 'data', 'bundledSongs.json');
    fs.writeFileSync(bundledDataPath, JSON.stringify(songs, null, 2) + '\n');
    console.log(`✅ Generated src/data/bundledSongs.json with ${songs.length} songs`);

    if (parseErrors > 0) {
      console.warn(`⚠️  ${parseErrors} file(s) had parsing errors`);
    }

    return songs.length;
  } catch (err) {
    console.error('❌ Failed to generate catalog:', err);
    process.exit(1);
  }
}

generateCatalog();
