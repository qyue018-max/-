const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const campus = fs.readFileSync(path.join(root, 'campus.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

test('satellite tiles and fallback ground use separate depth layers', () => {
  assert.match(campus, /far\.position\.y\s*=\s*-1\.5/);
  assert.match(campus, /depthWrite:\s*false/);
  assert.match(campus, /far\.renderOrder\s*=\s*-100/);
  assert.match(campus, /mesh\.position\.set\([^;]+,\s*\.02,/);
  assert.match(campus, /polygonOffset:\s*true/);
  assert.match(campus, /mesh\.renderOrder\s*=\s*-50/);
});

test('the roaming camera keeps enough depth precision for aerial views', () => {
  const match = game.match(/new T\.PerspectiveCamera\(70,\s*innerWidth \/ innerHeight,\s*([.\d]+),\s*4000\)/);
  assert.ok(match, 'camera declaration should remain explicit');
  assert.ok(Number(match[1]) >= .35, `camera near plane is too small: ${match[1]}`);
});
