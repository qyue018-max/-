import { GLTFLoader } from './vendor/GLTFLoader.module.js';

const scene = window._campusScene;
const manifest = window.HERO_ASSETS;
const helpers = window.HERO_LOADER;
const heroMaterials = window.HERO_MATERIALS;

function statusKey(id) {
  return `hero${id[0].toUpperCase()}${id.slice(1)}`;
}

function loadAsset(loader, id, asset) {
  document.body.dataset[statusKey(id)] = 'loading';
  return new Promise((resolve) => {
    loader.load(asset.url, (gltf) => {
      const model = helpers.applyAssetTransform(gltf.scene, asset);
      model.name = `hero-${id}`;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (id === 'mainBuilding' && heroMaterials) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => heroMaterials.applyMainBuildingMaterial(material));
        }
      });
      scene.add(model);
      helpers.setFallbackVisible(scene, asset, false);
      document.body.dataset[statusKey(id)] = 'loaded';
      resolve({ id, loaded: true });
    }, undefined, (error) => {
      helpers.setFallbackVisible(scene, asset, true);
      document.body.dataset[statusKey(id)] = 'fallback';
      console.warn(`[hero-assets] ${id} kept its procedural fallback`, error && error.message ? error.message : error);
      resolve({ id, loaded: false });
    });
  });
}

if (!scene || !manifest || !helpers) {
  document.body.dataset.heroAssets = 'partial';
  console.warn('[hero-assets] scene or manifest unavailable; using procedural fallbacks');
} else {
  document.body.dataset.heroAssets = 'loading';
  const loader = new GLTFLoader();
  Promise.all(Object.entries(manifest).map(([id, asset]) => loadAsset(loader, id, asset))).then((results) => {
    document.body.dataset.heroAssets = results.every((result) => result.loaded) ? 'ready' : 'partial';
    window.dispatchEvent(new CustomEvent('hero-assets-ready', { detail: results }));
  });
}
