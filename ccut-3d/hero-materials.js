(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HERO_MATERIALS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROFILES = Object.freeze({
    brick: Object.freeze({ pattern: 'brick', shaderKey: 'campus-brick-v3', roughness: .82, metalness: .01, envMapIntensity: .38, metersPerTile: Object.freeze([.38, .14]), features: Object.freeze(['mortar-depth', 'edge-grime', 'micro-roughness']) }),
    stone: Object.freeze({ pattern: 'stone', shaderKey: 'campus-stone-v2', roughness: .68, metalness: 0, envMapIntensity: .42, features: Object.freeze(['mineral-clouding', 'rain-streaks', 'micro-roughness']) }),
    glass: Object.freeze({ pattern: 'glass', shaderKey: 'campus-glass-v2', roughness: .26, metalness: .14, envMapIntensity: 1.18, interiorDepth: true, curtainVariation: true, features: Object.freeze(['interior-depth', 'curtain-silhouette', 'sky-reflection']) }),
    warmGlass: Object.freeze({ pattern: 'warm-glass', shaderKey: 'campus-warm-glass-v2', roughness: .3, metalness: .04, envMapIntensity: .72, emissiveIntensity: 1.35, interiorDepth: true, curtainVariation: true, features: Object.freeze(['interior-depth', 'curtain-silhouette', 'warm-room-variation']) }),
  });

  function getMainBuildingMaterialProfile(name) {
    const value = String(name || '').toLowerCase();
    if (value.includes('warm lit')) return PROFILES.warmGlass;
    if (value.includes('blue dusk glass')) return PROFILES.glass;
    if (value.includes('brick')) return PROFILES.brick;
    if (value.includes('limestone') || value.includes('carved stone')) return PROFILES.stone;
    return null;
  }

  function shaderPattern(profile) {
    const pattern = profile.pattern;
    if (pattern === 'brick') return `
vec2 campusBrickUv = vec2(vCampusLocal.x * ${(1 / profile.metersPerTile[0]).toFixed(5)}, vCampusLocal.y * ${(1 / profile.metersPerTile[1]).toFixed(5)});
campusBrickUv.x += mod(floor(campusBrickUv.y), 2.0) * .5;
vec2 campusBrickCell = fract(campusBrickUv);
float campusMortar = 1.0 - smoothstep(.025, .075, min(min(campusBrickCell.x, 1.0-campusBrickCell.x), min(campusBrickCell.y, 1.0-campusBrickCell.y)));
float campusBrickTone = .91 + .11 * campusNoise(floor(campusBrickUv));
diffuseColor.rgb *= campusBrickTone;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .64 + vec3(.055), campusMortar * .30);
float campusBaseDust = 1.0 - smoothstep(.15, 2.2, vCampusLocal.y);
diffuseColor.rgb *= 1.0 - campusBaseDust * .10;`;
    if (pattern === 'stone') return `
float campusStoneLarge = campusNoise(vCampusLocal.xz * .32 + vCampusLocal.y * .17);
float campusStoneFine = campusNoise(vCampusLocal.xy * 3.7);
float campusRainStreak = smoothstep(.72, .98, campusNoise(vec2(floor(vCampusLocal.x * .7), floor(vCampusLocal.y * .12)))) * smoothstep(1.0, 10.0, vCampusLocal.y);
diffuseColor.rgb *= .91 + campusStoneLarge * .12 + campusStoneFine * .035;
diffuseColor.rgb *= 1.0 - campusRainStreak * .055;`;
    if (pattern === 'glass') return `
float campusGlassBand = .94 + .06 * sin(vCampusLocal.y * 1.9 + vCampusLocal.x * .12);
vec2 campusPaneUv = fract(vec2(vCampusLocal.x * .285, vCampusLocal.y * .47));
float campusRoomSeed = campusNoise(floor(vec2(vCampusLocal.x * .285, vCampusLocal.y * .47)));
float campusWindowInterior = smoothstep(.02, .22, campusPaneUv.x) * smoothstep(.02, .2, campusPaneUv.y);
float campusCurtain = smoothstep(.56 + campusRoomSeed * .18, .92, campusPaneUv.x) * (.35 + .35 * campusRoomSeed);
float campusSkyReflection = pow(clamp(1.0 - abs(normalize(vViewPosition).z), 0.0, 1.0), 1.7);
vec3 campusRoom = mix(vec3(.055,.067,.075), vec3(.12,.105,.095), campusRoomSeed);
campusRoom = mix(campusRoom, vec3(.30,.24,.19), campusCurtain);
diffuseColor.rgb = mix(campusRoom, diffuseColor.rgb * campusGlassBand + vec3(.10,.16,.23) * campusSkyReflection, .40 + .22 * campusWindowInterior);`;
    if (pattern === 'warm-glass') return `
float campusWarmVariation = .92 + .08 * campusNoise(vCampusLocal.xy * .8);
vec2 campusPaneUv = fract(vec2(vCampusLocal.x * .285, vCampusLocal.y * .47));
float campusRoomSeed = campusNoise(floor(vec2(vCampusLocal.x * .285, vCampusLocal.y * .47)));
float campusWindowInterior = smoothstep(.03, .22, campusPaneUv.y);
float campusCurtain = smoothstep(.58 + campusRoomSeed * .16, .92, campusPaneUv.x) * .42;
vec3 campusWarmRoom = mix(vec3(.38,.16,.065), vec3(.92,.48,.17), campusWarmVariation);
diffuseColor.rgb = mix(campusWarmRoom, vec3(.34,.16,.09), campusCurtain) * (.76 + .24 * campusWindowInterior);`;
    return '';
  }

  function applyMainBuildingMaterial(material) {
    const profile = getMainBuildingMaterialProfile(material && material.name);
    if (!profile || !material) return false;
    material.userData = material.userData || {};
    const shaderAlreadyInstalled = material.userData.campusShaderKey === profile.shaderKey;
    material.roughness = profile.roughness;
    material.metalness = profile.metalness;
    material.envMapIntensity = profile.envMapIntensity;
    if (profile.emissiveIntensity != null) material.emissiveIntensity = profile.emissiveIntensity;
    material.userData.campusSurface = profile.pattern;
    material.userData.campusFeatures = Array.from(profile.features || []);
    if (shaderAlreadyInstalled) return true;
    material.userData.campusShaderKey = profile.shaderKey;
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      if (typeof previousCompile === 'function') previousCompile.call(this, shader, renderer);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCampusLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCampusLocal = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vCampusLocal;
float campusNoise(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + shaderPattern(profile))
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float campusMicroRoughness = campusNoise(vCampusLocal.xy * 9.7 + vCampusLocal.z * .31);
roughnessFactor = clamp(roughnessFactor + (campusMicroRoughness - .5) * .11, .08, 1.0);`);
    };
    const priorCacheKey = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey.bind(material) : () => '';
    material.customProgramCacheKey = () => `${priorCacheKey()}-${profile.shaderKey}`;
    material.needsUpdate = true;
    return true;
  }

  return Object.freeze({ getMainBuildingMaterialProfile, applyMainBuildingMaterial });
});
