(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HERO_LOADER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function setFallbackVisible(scene, asset, visible) {
    const fallbackNames = asset.fallbackNames || (asset.fallbackName ? [asset.fallbackName] : []);
    scene.traverse(function (object) {
      const tagMatches = asset.fallbackTag && object.userData && object.userData.heroFallback === asset.fallbackTag;
      const nameMatches = fallbackNames.includes(object.name);
      if (tagMatches || nameMatches) object.visible = visible;
    });
  }

  function applyAssetTransform(object, asset) {
    object.position.fromArray(asset.position);
    object.rotation.fromArray(asset.rotation);
    object.scale.fromArray(asset.scale);
    return object;
  }

  return Object.freeze({ setFallbackVisible, applyAssetTransform });
});
