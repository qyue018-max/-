const test = require('node:test');
const assert = require('node:assert/strict');

const { getMainBuildingMaterialProfile, applyMainBuildingMaterial } = require('../hero-materials.js');

test('main building facade materials receive distinct brick and limestone surface profiles', () => {
  const brick = getMainBuildingMaterialProfile('Brick PBR surface');
  const stone = getMainBuildingMaterialProfile('Limestone PBR surface');

  assert.equal(brick.pattern, 'brick');
  assert.ok(brick.roughness >= 0.72);
  assert.ok(brick.metersPerTile[0] <= .45);
  assert.ok(brick.metersPerTile[1] <= .16);
  assert.equal(stone.pattern, 'stone');
  assert.ok(stone.roughness > 0.55);
  assert.notEqual(brick.shaderKey, stone.shaderKey);
});

test('main building glass keeps dusk reflections without turning every window into a lamp', () => {
  const glass = getMainBuildingMaterialProfile('Blue dusk glass');
  const warm = getMainBuildingMaterialProfile('Warm lit windows');

  assert.equal(glass.pattern, 'glass');
  assert.ok(glass.metalness > 0);
  assert.ok(glass.roughness >= 0.2);
  assert.equal(warm.pattern, 'warm-glass');
  assert.ok(warm.emissiveIntensity > 0);
  assert.ok(warm.emissiveIntensity < 2);
  assert.equal(glass.interiorDepth, true);
  assert.equal(glass.curtainVariation, true);
  assert.equal(warm.interiorDepth, true);
});

test('applying a realism profile changes the real material contract and installs a shader hook', () => {
  const material = { name: 'Brick PBR surface', userData: {} };
  const applied = applyMainBuildingMaterial(material);

  assert.equal(applied, true);
  assert.equal(material.roughness, 0.82);
  assert.equal(material.metalness, 0.01);
  assert.equal(material.userData.campusSurface, 'brick');
  assert.deepEqual(material.userData.campusFeatures, ['mortar-depth', 'edge-grime', 'micro-roughness']);
  assert.equal(typeof material.onBeforeCompile, 'function');
  assert.equal(material.needsUpdate, true);
});

test('glass shader adds reflected sky, interior depth and curtain silhouettes', () => {
  const material = { name: 'Blue dusk glass', userData: {} };
  applyMainBuildingMaterial(material);
  const shader = {
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
  };

  material.onBeforeCompile(shader, {});

  assert.match(shader.fragmentShader, /campusWindowInterior/);
  assert.match(shader.fragmentShader, /campusCurtain/);
  assert.match(shader.fragmentShader, /campusSkyReflection/);
});

test('shared GLB materials install the realism shader only once', () => {
  const material = { name: 'Brick PBR surface', userData: {} };
  assert.equal(applyMainBuildingMaterial(material), true);
  const firstCompile = material.onBeforeCompile;
  assert.equal(applyMainBuildingMaterial(material), true);
  assert.equal(material.onBeforeCompile, firstCompile);

  const shader = {
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
  };
  material.onBeforeCompile(shader, {});
  assert.equal((shader.vertexShader.match(/varying vec3 vCampusLocal/g) || []).length, 1);
  assert.equal((shader.fragmentShader.match(/float campusNoise/g) || []).length, 1);
});

test('unrelated materials are not modified by the main building material pass', () => {
  const material = { name: 'Autumn foliage', userData: {} };

  assert.equal(applyMainBuildingMaterial(material), false);
  assert.deepEqual(material, { name: 'Autumn foliage', userData: {} });
});
