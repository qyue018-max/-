const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('embedded campus requests exit only after pointer lock is released', () => {
  const file = path.resolve(__dirname, '..', 'portal-bridge.js');
  const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const listeners = new Map();
  const messages = [];
  const document = {
    pointerLockElement: {},
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  const parent = { postMessage: (message) => messages.push(message) };
  const window = { parent, document };

  vm.runInNewContext(source, { window, document });
  assert.equal(typeof listeners.get('keydown'), 'function');

  listeners.get('keydown')({ key: 'Escape' });
  assert.deepEqual(messages, []);

  document.pointerLockElement = null;
  listeners.get('keydown')({ key: 'Escape' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'ccut-campus-exit');
});
