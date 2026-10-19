(function (root, factory) {
  const manifest = factory();
  if (typeof module === 'object' && module.exports) module.exports = { HERO_ASSETS: manifest };
  root.HERO_ASSETS = manifest;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return Object.freeze({
    mainBuilding: Object.freeze({
      url: 'assets/models/main-building.glb?v=photo-facade-3',
      fallbackTag: 'mainBuilding',
      position: [61, 0, -132],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
    plazaStone: Object.freeze({
      url: 'assets/models/plaza-stone.glb',
      fallbackName: 'main-plaza-stone',
      fallbackNames: ['main-plaza-stone', 'main-plaza-planter'],
      position: [69.58, 0.25, -74.61],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
    autumnTree: Object.freeze({
      url: 'assets/models/autumn-tree.glb',
      fallbackName: 'main-plaza-tree',
      position: [74.27, 0.25, -77.22],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
  });
});
