#!/usr/bin/env node
/**
 * Genera los íconos PNG de la PWA desde static/faro-icon.svg con sharp.
 * Uso: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'static', 'faro-icon.svg'));
const iconsDir = join(root, 'static', 'icons');
mkdirSync(iconsDir, { recursive: true });

const out = [
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
  { file: 'icons/icon-maskable-512.png', size: 512 },
  { file: 'icons/apple-touch-icon.png', size: 180 },
  { file: 'favicon.png', size: 48 }
];

for (const { file, size } of out) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(root, 'static', file));
  console.log(`✓ ${file} (${size}×${size})`);
}
console.log('Íconos generados.');
