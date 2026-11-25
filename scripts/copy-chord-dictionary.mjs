#!/usr/bin/env node
/**
 * Script para copiar los diccionarios (acordes y escalas) a la carpeta pública
 * Se ejecuta como parte del proceso de build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const sourceDir = path.join(projectRoot, 'data');
const targetDir = path.join(projectRoot, 'public', 'data');
const dictionaryFiles = ['chord-dictionary.json', 'scale-dictionary.json'];

console.log('📋 Copiando diccionarios musicales a public/data...');
console.log(`   Origen: ${sourceDir}`);
console.log(`   Destino: ${targetDir}`);

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('   📁 Directorio destino creado');
}

// Copy each dictionary file
try {
  for (const dictionaryFile of dictionaryFiles) {
    const sourceFile = path.join(sourceDir, dictionaryFile);
    const targetFile = path.join(targetDir, dictionaryFile);

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Archivo fuente requerido no encontrado: ${sourceFile}`);
    }

    fs.copyFileSync(sourceFile, targetFile);

    if (!fs.existsSync(targetFile)) {
      throw new Error(`El archivo ${dictionaryFile} no se copió correctamente`);
    }

    const stats = fs.statSync(targetFile);
    console.log(`✅ ${dictionaryFile} copiado exitosamente (${stats.size} bytes)`);
  }
} catch (error) {
  console.error('❌ Error al copiar diccionarios:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('✨ Diccionarios de acordes y escalas listos para servir\n');
