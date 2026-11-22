#!/usr/bin/env node
/**
 * Script para copiar el diccionario de acordes a la carpeta pública
 * Se ejecuta como parte del proceso de build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const sourceDir = path.join(projectRoot, 'data');
const targetDir = path.join(projectRoot, 'public', 'data');
const dictionaryFile = 'chord-dictionary.json';

console.log('📋 Copiando diccionario de acordes...');
console.log(`   Origen: ${sourceDir}`);
console.log(`   Destino: ${targetDir}`);

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('   📁 Directorio destino creado');
}

// Copy the dictionary file
try {
  const sourceFile = path.join(sourceDir, dictionaryFile);
  const targetFile = path.join(targetDir, dictionaryFile);

  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    
    // Verify the file was copied
    if (fs.existsSync(targetFile)) {
      const stats = fs.statSync(targetFile);
      console.log(`✅ ${dictionaryFile} copiado exitosamente (${stats.size} bytes)`);
    } else {
      throw new Error('El archivo no se copió correctamente');
    }
  } else {
    console.warn(`⚠️ Archivo fuente no encontrado: ${sourceFile}`);
  }
} catch (error) {
  console.error(`❌ Error al copiar diccionario de acordes:`, error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('✨ Diccionario de acordes listo para servir\n');
