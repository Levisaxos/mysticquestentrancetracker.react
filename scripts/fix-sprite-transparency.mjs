#!/usr/bin/env node
//
// Give sprites a transparent background.
//
// Most of our sprites already have an alpha channel, but a few were saved as
// plain RGB with the background baked in as black — which shows up as an ugly
// black square on the dark panel.
//
// The fix is not "make every black pixel transparent": these sprites have black
// outlines, and that would eat them. Instead this flood-fills inward from the
// edges, so only background black that actually touches the border is cleared
// and interior outlines survive.
//
//     npm run fix-sprites          # report what would change
//     npm run fix-sprites -- --write

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH = ['public/images/items', 'public/images/sprites'];

// How dark counts as background. Generous enough for near-black compression
// artefacts, tight enough not to swallow dark sprite colours.
const DARK = 40;

const write = process.argv.includes('--write');

function findPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findPngs(full));
    else if (entry.name.endsWith('.png')) out.push(full);
  }
  return out;
}

/** Colour type 2 (RGB) and 0 (greyscale) carry no alpha at all. */
function lacksAlpha(file) {
  const header = fs.readFileSync(file).subarray(0, 26);
  return header[25] === 2 || header[25] === 0;
}

function clearBackground(png) {
  const { width, height, data } = png;
  const at = (x, y) => (y * width + x) * 4;
  const isDark = (i) => data[i] <= DARK && data[i + 1] <= DARK && data[i + 2] <= DARK;

  const seen = new Uint8Array(width * height);
  const queue = [];

  // Seed from every border pixel; anything dark and connected to the outside
  // is background.
  for (let x = 0; x < width; x += 1) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += 1) {
    queue.push([0, y], [width - 1, y]);
  }

  let cleared = 0;
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const index = y * width + x;
    if (seen[index]) continue;
    seen[index] = 1;

    const i = at(x, y);
    if (!isDark(i)) continue;

    data[i + 3] = 0;
    cleared += 1;

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return cleared;
}

const files = SEARCH
  .map((dir) => path.join(root, dir))
  .filter((dir) => fs.existsSync(dir))
  .flatMap(findPngs);

const affected = files.filter(lacksAlpha);

console.log(`Scanned ${files.length} sprites; ${affected.length} have no alpha channel.`);
if (!affected.length) {
  console.log('Nothing to do.');
  process.exit(0);
}

for (const file of affected) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const cleared = clearBackground(png);
  const relative = path.relative(root, file).split(path.sep).join('/');

  console.log(`  ${relative} — ${cleared} background pixels of ${png.width * png.height}`);

  if (write) fs.writeFileSync(file, PNG.sync.write(png));
}

console.log(write
  ? '\nWritten. Check them in the app; `git checkout` restores the originals.'
  : '\nDry run. Re-run with --write to apply.');
