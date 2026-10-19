(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CAMPUS_VISUAL_STYLE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAIN_BUILDING = Object.freeze({
    preset: 'main-landmark',
    wall: '#783b3d',
    wallShadow: '#542c33',
    base: '#d8cdbd',
    trim: '#eee1cf',
    glass: '#263f59',
    warmGlass: '#f1b768',
    roof: '#442f38',
    floors: 6,
    hasCentralPediment: true,
    hasArchedTopWindows: true,
    hasWarmWindowVariation: true,
    centerBayWindowed: true,
  });

  const CAMPUS_GRAND = Object.freeze({
    preset: 'campus-grand',
    wall: '#783b3d',
    wallShadow: '#542c33',
    stairTowerWall: '#542c33',
    base: '#d8cdbd',
    trim: '#eee1cf',
    glass: '#263f59',
    warmGlass: '#f1b768',
    roof: '#442f38',
    hasCentralPediment: true,
    hasArchedTopWindows: true,
    hasGroundArches: true,
    hasPilasters: true,
    archFrameMode: 'outlined-glass',
    archGlassEmissive: false,
    hasWarmWindowVariation: true,
  });

  function getBuildingStyle(building) {
    if (building && (building.id === 1420146280 || building.name === '主教学楼' || building.name === '东区教学主楼')) return MAIN_BUILDING;
    return CAMPUS_GRAND;
  }

  function shouldRenderVegetation(kind) {
    return kind === 'main-plaza-tree';
  }

  const ROAD_STYLES = Object.freeze({
    service: Object.freeze({
      renderSurface: true,
      width: 7.2,
      surfaceColor: '#918d84',
      edgeColor: '#b7b2a8',
      centerLineColor: '#d6ae32',
      showCenterLine: true,
      showArrows: true,
    }),
    footway: Object.freeze({
      renderSurface: true,
      width: 3.2,
      surfaceColor: '#aaa69d',
      edgeColor: '#c4c0b7',
      centerLineColor: null,
      showCenterLine: false,
      showArrows: false,
    }),
  });

  const HIDDEN_ROAD_STYLE = Object.freeze({
    renderSurface: false,
    width: 0,
    surfaceColor: null,
    edgeColor: null,
    centerLineColor: null,
    showCenterLine: false,
    showArrows: false,
  });

  function getRoadSurfaceStyle(kind) {
    return ROAD_STYLES[kind] || HIDDEN_ROAD_STYLE;
  }

  function getRoadArrowDistances(kind, length) {
    if (!getRoadSurfaceStyle(kind).showArrows || Number(length) < 58) return [];
    const distances = [];
    for (let d = 28; d <= Number(length) - 18; d += 58) distances.push(d);
    return distances;
  }

  function getStadiumGrandstandLayout() {
    const centralCenterZ = (65.33 + 113.84) / 2;
    const offset = 47.75;
    const shared = Object.freeze({
      centerX: -418.25,
      length: 34,
      depth: 17,
      tiers: 7,
      tierRise: .62,
    });
    return Object.freeze({
      centralBuildingId: 933,
      centralCenterZ,
      replacedBuildingIds: Object.freeze([934, 935]),
      stands: Object.freeze([
        Object.freeze({ ...shared, centerZ: centralCenterZ - offset }),
        Object.freeze({ ...shared, centerZ: centralCenterZ + offset }),
      ]),
      concreteColor: '#e5e3dc',
      concreteShadow: '#c8c6c0',
      railingColor: '#8f969b',
      weathering: .18,
    });
  }

  function getGrandFacadeProfile(building, frontage) {
    const h = Math.max(3.5, Number(building && building.h) || 3.5);
    const width = Math.max(8, Number(frontage) || 8);
    const pedimentHeight = Math.min(4.8, Math.max(1.1, h * .2));
    const topArchHeight = Math.min(3.45, Math.max(.85, h * .16));
    const groundArchHeight = Math.min(3.8, Math.max(.95, h * .22));
    const doorHeight = Math.min(4.2, Math.max(1.8, h * .24), h - .65);
    const pilasterHeight = Math.max(1.3, h - 1.1);
    return Object.freeze({
      enabled: h >= 3.5 && width >= 8,
      pedimentHeight,
      pedimentBaseY: h - pedimentHeight,
      topArchHeight,
      topArchCenterY: h - topArchHeight / 2 - .12,
      groundArchHeight,
      groundArchCenterY: groundArchHeight / 2 + .12,
      pilasterHeight,
      pilasterCenterY: .55 + pilasterHeight / 2,
      doorHeight,
    });
  }

  function getCinematicLighting() {
    return Object.freeze({
      mode: 'dusk',
      skyTop: 0x172c55,
      skyBottom: 0xe08a65,
      fog: 0x5d607a,
      hemisphereSky: 0x7189ad,
      hemisphereGround: 0x332b35,
      hemisphereIntensity: 0.72,
      sunColor: 0xffb36b,
      sunIntensity: 1.05,
      ambientColor: 0x6f7caa,
      ambientIntensity: 0.28,
      windowGlow: 0.82,
      exposure: 0.86,
      entranceLightIntensity: 0.48,
      plazaReflectivity: 0.24,
    });
  }

  function offsetOnFacade(facade, along, normal) {
    return [
      +(facade.mx + facade.tx * along + facade.nx * normal).toFixed(2),
      +(facade.mz + facade.tz * along + facade.nz * normal).toFixed(2),
    ];
  }

  function getMainPlazaLandmarks(facade) {
    const stonePosition = offsetOnFacade(facade, 7.5, 46);
    const treePosition = offsetOnFacade(facade, 12.2, 43.4);
    const planterPosition = offsetOnFacade(facade, 9.8, 44.8);
    const teleportPosition = offsetOnFacade(facade, 7.5, 76);
    return Object.freeze({
      stone: Object.freeze({
        position: stonePosition,
        width: 6.2,
        height: 8.4,
        depth: 2.7,
        baseColor: '#c9836f',
        veinColors: Object.freeze(['#53565a', '#65756f', '#e1c2ab']),
        textureProjection: 'front-decal',
      }),
      tree: Object.freeze({
        position: treePosition,
        height: 15.5,
        foliage: '#682c32',
        whitewashedBase: true,
      }),
      planter: Object.freeze({
        position: planterPosition,
        width: 15.5,
        depth: 8.2,
      }),
      collision: Object.freeze({ width: 15.5, depth: 8.2, height: .75 }),
      teleport: Object.freeze({ position: teleportPosition, yaw: 0 }),
    });
  }

  return {
    getBuildingStyle,
    getGrandFacadeProfile,
    getCinematicLighting,
    getMainPlazaLandmarks,
    shouldRenderVegetation,
    getRoadSurfaceStyle,
    getRoadArrowDistances,
    getStadiumGrandstandLayout,
  };
});
