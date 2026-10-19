const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

test('the desktop guide presents keyboard controls as grouped game help, not fake buttons', () => {
  assert.match(html, /id="helpDesk"[^>]*class="control-guide"/);
  assert.match(html, /class="control-group"/);
  assert.match(html, /键盘操作/);
  assert.doesNotMatch(html, /<kbd>Ctrl<\/kbd>\s*加速/);
});

test('the in-scene control strip exposes only useful controls and a real help shortcut', () => {
  assert.match(html, /id="controlHint"/);
  for (const key of ['WASD', 'V', 'F', 'N', 'M', 'H']) {
    assert.match(html, new RegExp(`data-key="${key}"`));
  }
  assert.match(game, /KeyH/);
  assert.match(game, /openHelp/);
});

test('toggle controls ignore keyboard repeat and publish visible state for QA', () => {
  assert.match(game, /if \(e\.repeat && TOGGLE_KEYS\.has\(e\.code\)\) return/);
  assert.match(game, /dataset\.fly/);
  assert.match(game, /dataset\.night/);
  assert.match(game, /dataset\.view/);
  assert.match(game, /dataset\.map/);
});
