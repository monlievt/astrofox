import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve('sharp', {
    paths: [join(root, 'node_modules/.pnpm/sharp@0.34.5/node_modules')],
  }),
);

const svg = readFileSync(join(root, 'public/icon.svg'));
const BG = '#171717'; // --color-neutral-900

// Render the source SVG to a PNG buffer at a given size, optionally on a
// solid background with safe-area padding (used for Apple / maskable icons).
async function render(size, { bg = null, pad = 0 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(svg)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Build a multi-image .ico (PNG-encoded entries: 16, 32, 48).
async function buildIco(sizes) {
  const pngs = await Promise.all(sizes.map(s => render(s)));
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach((png, i) => {
    const s = sizes[i];
    const b = dir.subarray(i * 16, i * 16 + 16);
    b.writeUInt8(s >= 256 ? 0 : s, 0); // width
    b.writeUInt8(s >= 256 ? 0 : s, 1); // height
    b.writeUInt8(0, 2); // palette
    b.writeUInt8(0, 3); // reserved
    b.writeUInt16LE(1, 4); // planes
    b.writeUInt16LE(32, 6); // bpp
    b.writeUInt32LE(png.length, 8);
    b.writeUInt32LE(offset, 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...pngs]);
}

const outputs = [
  ['public/favicon.ico', () => buildIco([16, 32, 48])],
  ['public/apple-icon.png', () => render(180, { bg: BG, pad: 0.12 })],
  ['public/icons/icon-192.png', () => render(192)],
  ['public/icons/icon-512.png', () => render(512)],
  ['public/icons/icon-192-maskable.png', () => render(192, { bg: BG, pad: 0.1 })],
  ['public/icons/icon-512-maskable.png', () => render(512, { bg: BG, pad: 0.1 })],
];

for (const [rel, fn] of outputs) {
  const buf = await fn();
  writeFileSync(join(root, rel), buf);
  console.log(`${rel}  (${buf.length} bytes)`);
}
