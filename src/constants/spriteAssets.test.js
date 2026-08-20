import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPRITE_DIRS = ['public/images/items', 'public/images/sprites'];

function findPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findPngs(full));
    else if (entry.name.endsWith('.png')) out.push(full);
  }
  return out;
}

const sprites = SPRITE_DIRS
  .map((dir) => path.join(root, dir))
  .filter((dir) => fs.existsSync(dir))
  .flatMap(findPngs);

const relative = (file) => path.relative(root, file).split(path.sep).join('/');

// PNG colour types: 0 greyscale, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA.
// 0 and 2 carry no alpha at all, so their background is baked in — which on a
// dark panel shows up as a black box behind the icon.
function colourType(file) {
  return fs.readFileSync(file).subarray(0, 26)[25];
}

function hasTransparencyChunk(file) {
  return fs.readFileSync(file).includes(Buffer.from('tRNS'));
}

describe('sprite transparency', () => {
  test('there are sprites to check', () => {
    expect(sprites.length).toBeGreaterThan(50);
  });

  // Regression guard: sky_fragment.png shipped as plain RGB and rendered with a
  // black square behind it. `npm run fix-sprites -- --write` repairs any that
  // slip in this way.
  test('every sprite can be transparent', () => {
    const opaque = sprites
      .filter((file) => [0, 2].includes(colourType(file)))
      .map(relative);

    expect(opaque).toEqual([]);
  });

  test('palette sprites declare their transparent index', () => {
    const missing = sprites
      .filter((file) => colourType(file) === 3)
      .filter((file) => !hasTransparencyChunk(file))
      .map(relative);

    expect(missing).toEqual([]);
  });
});
