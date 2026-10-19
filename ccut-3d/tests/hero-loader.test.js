const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('../three.min.js');

test('successful hero replacement hides only its matching procedural fallback', () => {
  const { setFallbackVisible } = require('../hero-loader.js');
  const scene = new THREE.Scene();
  const building = new THREE.Group(); building.userData.heroFallback = 'mainBuilding';
  const stone = new THREE.Group(); stone.name = 'main-plaza-stone';
  const tree = new THREE.Group(); tree.name = 'main-plaza-tree';
  scene.add(building, stone, tree);

  setFallbackVisible(scene, { fallbackTag: 'mainBuilding' }, false);

  assert.equal(building.visible, false);
  assert.equal(stone.visible, true);
  assert.equal(tree.visible, true);
});

test('failed hero replacement can restore the named procedural fallback', () => {
  const { setFallbackVisible } = require('../hero-loader.js');
  const scene = new THREE.Scene();
  const stone = new THREE.Group(); stone.name = 'main-plaza-stone'; stone.visible = false;
  scene.add(stone);

  setFallbackVisible(scene, { fallbackName: 'main-plaza-stone' }, true);

  assert.equal(stone.visible, true);
});

test('stone replacement hides both the procedural stone and its planter', () => {
  const { setFallbackVisible } = require('../hero-loader.js');
  const scene = new THREE.Scene();
  const stone = new THREE.Group(); stone.name = 'main-plaza-stone';
  const planter = new THREE.Group(); planter.name = 'main-plaza-planter';
  scene.add(stone, planter);

  setFallbackVisible(scene, { fallbackNames: ['main-plaza-stone', 'main-plaza-planter'] }, false);

  assert.equal(stone.visible, false);
  assert.equal(planter.visible, false);
});

test('asset transform maps manifest arrays onto a loaded Three.js object', () => {
  const { applyAssetTransform } = require('../hero-loader.js');
  const object = new THREE.Group();

  applyAssetTransform(object, {
    position: [2, 3, 4], rotation: [.1, .2, .3], scale: [1.5, 2, .5],
  });

  assert.deepEqual(object.position.toArray(), [2, 3, 4]);
  assert.deepEqual(object.rotation.toArray().slice(0, 3), [.1, .2, .3]);
  assert.deepEqual(object.scale.toArray(), [1.5, 2, .5]);
});
