#!/usr/bin/env node
/**
 * Controles de integridad del repositorio (Fase 0).
 *
 * Bloquea las tres regresiones que causaron el estado del que parte la V1:
 *   1. Marcadores de conflicto de Git guardados como código (ver `6a2597b`).
 *   2. `node_modules` versionado (ver `LeadUpao-Bot/main`, 6 128 archivos).
 *   3. Archivos de entorno reales indexados por error.
 *
 * Opera sobre el índice de Git, no sobre el disco: solo importa lo que se
 * llega a commitear.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BINARIAS = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip|mp4)$/i;

function archivosIndexados() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

const errores = [];
const archivos = archivosIndexados();

// 1. Marcadores de conflicto
const MARCADOR = /^(<{7} |={7}$|>{7} )/m;
for (const archivo of archivos) {
  if (BINARIAS.test(archivo)) continue;
  let contenido;
  try {
    contenido = readFileSync(archivo, 'utf8');
  } catch {
    continue; // archivo eliminado en el árbol de trabajo
  }
  if (MARCADOR.test(contenido)) {
    errores.push(`marcador de conflicto de Git en ${archivo}`);
  }
}

// 2. Dependencias versionadas
for (const archivo of archivos) {
  if (archivo.split('/').includes('node_modules')) {
    errores.push(`node_modules versionado: ${archivo}`);
  }
}

// 3. Archivos de entorno reales
for (const archivo of archivos) {
  const base = archivo.split('/').pop();
  if (base.startsWith('.env') && base !== '.env.example') {
    errores.push(`archivo de entorno indexado: ${archivo}`);
  }
}

// 4. Un solo lockfile, en la raíz
const lockfiles = archivos.filter((a) => a.endsWith('package-lock.json'));
if (lockfiles.length > 1) {
  errores.push(
    `debe haber un único package-lock.json en la raíz; hay ${lockfiles.length}: ${lockfiles.join(', ')}`,
  );
}

if (errores.length > 0) {
  console.error('check-repo: FALLÓ\n');
  for (const e of errores) console.error(`  ✗ ${e}`);
  console.error(`\n${errores.length} problema(s).`);
  process.exit(1);
}

console.error(`check-repo: OK (${archivos.length} archivos indexados)`);
