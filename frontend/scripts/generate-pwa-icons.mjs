// Gera os ícones do PWA a partir de src/assets/logo.png.
// Uso: npm run icons
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/assets/logo.png');
const outDir = path.join(root, 'public/icons');

// Mesma cor de --bg-primary do tema claro.
const background = '#f5e9d7';

const icons = [
  // "any": o logo ocupa quase todo o quadro.
  { file: 'icon-192.png', size: 192, scale: 0.9 },
  { file: 'icon-512.png', size: 512, scale: 0.9 },
  // "maskable": o logo fica dentro da zona segura (círculo de 80%) para não ser cortado.
  { file: 'icon-maskable-192.png', size: 192, scale: 0.68 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.68 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
];

await mkdir(outDir, { recursive: true });
const trimmed = await sharp(source).trim().toBuffer();

for (const { file, size, scale } of icons) {
  const inner = Math.round(size * scale);
  const logo = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toFile(path.join(outDir, file));

  console.log(`public/icons/${file}`);
}
