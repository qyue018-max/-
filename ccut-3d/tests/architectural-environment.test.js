const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('the campus installs a dusk reflection environment for PBR architecture', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');

  assert.match(source, /new T\.CubeTexture\(/);
  assert.match(source, /scene\.environment\s*=/);
  assert.match(source, /architectural-reflection-environment/);
});
