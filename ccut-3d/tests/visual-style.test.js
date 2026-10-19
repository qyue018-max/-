const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBuildingStyle,
  getGrandFacadeProfile,
  getCinematicLighting,
  getMainPlazaLandmarks,
  shouldRenderVegetation,
  getRoadSurfaceStyle,
  getRoadArrowDistances,
  getStadiumGrandstandLayout,
} = require('../visual-style.js');

test('main teaching building uses the photographed red-and-stone landmark facade', () => {
  const style = getBuildingStyle({ name: '主教学楼', kind: 'university' });
  const renamedStyle = getBuildingStyle({ id: 1420146280, name: '东区教学主楼', kind: 'university' });

  assert.equal(style.preset, 'main-landmark');
  assert.equal(style.wall, '#783b3d');
  assert.equal(style.base, '#d8cdbd');
  assert.equal(style.floors, 6);
  assert.equal(style.hasCentralPediment, true);
  assert.equal(style.hasArchedTopWindows, true);
  assert.equal(style.hasWarmWindowVariation, true);
  assert.equal(style.centerBayWindowed, true);
  assert.equal(renamedStyle.preset, 'main-landmark');
});

test('all secondary campus buildings use the main building classical facade language', () => {
  for (const building of [
    { name: '信息传播楼', kind: 'university' },
    { name: '3栋', kind: 'dormitory' },
    { name: '东区食堂', kind: 'residential' },
    { name: '体育馆', kind: 'manual' },
    { name: '换热站', kind: 'service' },
  ]) {
    const style = getBuildingStyle(building);
    assert.equal(style.preset, 'campus-grand');
    assert.equal(style.wall, '#783b3d');
    assert.equal(style.base, '#d8cdbd');
    assert.equal(style.trim, '#eee1cf');
    assert.equal(style.hasCentralPediment, true);
    assert.equal(style.hasArchedTopWindows, true);
    assert.equal(style.hasGroundArches, true);
    assert.equal(style.hasPilasters, true);
    assert.equal(style.archFrameMode, 'outlined-glass');
    assert.equal(style.archGlassEmissive, false);
    assert.equal(style.stairTowerWall, style.wallShadow);
  }
});

test('grand facade preserves the supplied height and includes short visible buildings', () => {
  for (const height of [3.5, 4.4, 11.6, 22.4]) {
    const profile = getGrandFacadeProfile({ h: height }, 40);
    assert.equal(profile.enabled, true);
    assert.ok(profile.pedimentBaseY + profile.pedimentHeight <= height + 1e-9);
    assert.ok(profile.topArchCenterY + profile.topArchHeight / 2 <= height + 1e-9);
  }
});

test('default cinematic lighting is dusk with warm windows and blue-purple fog', () => {
  const lighting = getCinematicLighting();

  assert.equal(lighting.mode, 'dusk');
  assert.equal(lighting.skyTop, 0x172c55);
  assert.equal(lighting.skyBottom, 0xe08a65);
  assert.equal(lighting.fog, 0x5d607a);
  assert.ok(lighting.windowGlow > 0.5);
  assert.ok(lighting.sunIntensity > 0.7);
  assert.ok(lighting.exposure < 1);
  assert.ok(lighting.entranceLightIntensity <= 0.6);
  assert.ok(lighting.plazaReflectivity > 0);
});

test('main plaza landmark composes the stone in front of the facade with its tree behind-right', () => {
  const facade = { mx: 60, mz: -120, nx: 0, nz: 1, tx: 1, tz: 0 };
  const layout = getMainPlazaLandmarks(facade);

  assert.deepEqual(layout.stone.position, [67.5, -74]);
  assert.deepEqual(layout.tree.position, [72.2, -76.6]);
  assert.ok(layout.planter.width > layout.stone.width);
  assert.ok(layout.planter.depth > layout.stone.depth);
  assert.deepEqual(layout.collision, { width: 15.5, depth: 8.2, height: 0.75 });
  assert.ok(layout.teleport.position[1] > layout.stone.position[1]);
  assert.equal(layout.teleport.yaw, 0);
});

test('main plaza stone carries the photographed peach granite and contrasting mineral veins', () => {
  const layout = getMainPlazaLandmarks({ mx: 0, mz: 0, nx: 0, nz: 1, tx: 1, tz: 0 });

  assert.equal(layout.stone.baseColor, '#c9836f');
  assert.deepEqual(layout.stone.veinColors, ['#53565a', '#65756f', '#e1c2ab']);
  assert.equal(layout.stone.textureProjection, 'front-decal');
  assert.equal(layout.tree.foliage, '#682c32');
  assert.equal(layout.tree.whitewashedBase, true);
});

test('campus vegetation is hidden while the photographed main-plaza landmark tree remains', () => {
  assert.equal(shouldRenderVegetation('campus-tree'), false);
  assert.equal(shouldRenderVegetation('campus-conifer'), false);
  assert.equal(shouldRenderVegetation('campus-shrub'), false);
  assert.equal(shouldRenderVegetation('main-plaza-tree'), true);
});

test('wide campus service roads receive concrete paving with a yellow centre line and arrows', () => {
  const style = getRoadSurfaceStyle('service');

  assert.equal(style.renderSurface, true);
  assert.ok(style.width >= 6);
  assert.equal(style.surfaceColor, '#918d84');
  assert.equal(style.centerLineColor, '#d6ae32');
  assert.equal(style.showCenterLine, true);
  assert.equal(style.showArrows, true);
});

test('narrow footways stay plain concrete without traffic markings', () => {
  const style = getRoadSurfaceStyle('footway');

  assert.equal(style.renderSurface, true);
  assert.ok(style.width < 5);
  assert.equal(style.showCenterLine, false);
  assert.equal(style.showArrows, false);
  assert.deepEqual(getRoadArrowDistances('footway', 180), []);
});

test('direction arrows are spaced along long service roads but omitted from short segments', () => {
  assert.deepEqual(getRoadArrowDistances('service', 40), []);
  assert.deepEqual(getRoadArrowDistances('service', 150), [28, 86]);
});

test('stadium keeps one central building and replaces the two side buildings with symmetric white stands', () => {
  const layout = getStadiumGrandstandLayout();

  assert.equal(layout.centralBuildingId, 933);
  assert.deepEqual(layout.replacedBuildingIds, [934, 935]);
  assert.equal(layout.stands.length, 2);
  assert.equal(layout.stands[0].centerX, layout.stands[1].centerX);
  assert.equal(layout.stands[0].length, layout.stands[1].length);
  assert.equal(layout.stands[0].depth, layout.stands[1].depth);
  assert.equal(layout.stands[0].tiers, layout.stands[1].tiers);
  assert.equal(
    +(layout.centralCenterZ - layout.stands[0].centerZ).toFixed(3),
    +(layout.stands[1].centerZ - layout.centralCenterZ).toFixed(3),
  );
  assert.equal(layout.concreteColor, '#e5e3dc');
  assert.equal(layout.railingColor, '#8f969b');
  assert.ok(layout.weathering > 0);
});
