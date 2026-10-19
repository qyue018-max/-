import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { GLTFExporter } from '../vendor/GLTFExporter.module.js';
import { mergeBufferGeometries } from '../vendor/BufferGeometryUtils.module.js';

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
      return this.result;
    });
  }
};

const scene = new THREE.Scene();
const root = new THREE.Group(); root.name = 'MainBuilding'; scene.add(root);
const warmRoot = new THREE.Group(); warmRoot.name = 'WarmWindows'; root.add(warmRoot);
const geometryCache = new Map();

function mat(name, color, roughness=.6, emissive=0x000000, emissiveIntensity=0, metalness=.02) {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
  material.name = name;
  return material;
}
const red = mat('Brick PBR surface', 0x74393d, .82);
const redDark = mat('Brick shadow', 0x4e2028, .82);
const limestone = mat('Limestone PBR surface', 0xb8a992, .68);
const pale = mat('Carved stone PBR surface', 0xd6c9b3, .72);
const recess = mat('Window recess shadow', 0x180f13, .92);
const frame = mat('Powder-coated window frame', 0x353c42, .42, 0x000000, 0, .12);
const glass = mat('Blue dusk glass', 0x071929, .26, 0x000000, 0, .14);
const warm = mat('Warm lit windows', 0x5f2410, .30, 0xff681e, 1.35, .04);
const roof = mat('Slate roof', 0x1c1f26, .72);

function rectangularWindow(name, width, height, x, y, frontZ, facing, windowMaterial, parent) {
  const direction = facing === 'front' ? 1 : -1;
  box(`${name}_Recess`, [width + .42, height + .42, .16], [x, y, frontZ + direction * .05], recess, parent);
  box(`${name}_OuterFrame`, [width + .26, height + .26, .13], [x, y, frontZ + direction * .13], frame, parent, .025);
  box(name, [width, height, .10], [x, y, frontZ + direction * .21], windowMaterial, parent, .025);
  box(`${name}_VerticalMullion`, [.075, height, .07], [x, y, frontZ + direction * .275], frame, parent, .018);
  box(`${name}_HorizontalMullion`, [width, .075, .07], [x, y, frontZ + direction * .275], frame, parent, .018);
}

function box(name, size, position, material, parent, bevel=false) {
  const bevelAmount = bevel && (material === limestone || material === pale)
    ? Math.min(typeof bevel === 'number' ? bevel : .04, size[0] * .12, size[1] * .12, size[2] * .22)
    : 0;
  const key = `${size.join(',')}:bevel=${bevelAmount}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    if (bevelAmount > 0) {
      const [width, height, depth] = size;
      const insetWidth = Math.max(.001, width - bevelAmount * 2);
      const insetHeight = Math.max(.001, height - bevelAmount * 2);
      const insetDepth = Math.max(.001, depth - bevelAmount * 2);
      const shape = new THREE.Shape();
      shape.moveTo(-insetWidth / 2, -insetHeight / 2);
      shape.lineTo(insetWidth / 2, -insetHeight / 2);
      shape.lineTo(insetWidth / 2, insetHeight / 2);
      shape.lineTo(-insetWidth / 2, insetHeight / 2);
      shape.closePath();
      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: insetDepth,
        bevelEnabled: true,
        bevelSize: bevelAmount,
        bevelThickness: bevelAmount,
        bevelSegments: 1,
        curveSegments: 1,
      });
      geometry.translate(0, 0, -insetDepth / 2);
    } else {
      geometry = new THREE.BoxGeometry(...size);
    }
    geometryCache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.fromArray(position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function archGeometry(width, height, depth) {
  const key = `arch:${width},${height},${depth}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const shape = new THREE.Shape();
  const radius = width / 2;
  const spring = height / 2 - radius;
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(-width / 2, spring);
  shape.absarc(0, spring, radius, Math.PI, 0, true);
  shape.lineTo(width / 2, -height / 2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .045, bevelThickness: .045, bevelSegments: 2, curveSegments: 10 });
  geometry.translate(0, 0, -depth / 2);
  geometryCache.set(key, geometry);
  return geometry;
}

function arch(name, width, height, depth, position, material, parent) {
  const mesh = new THREE.Mesh(archGeometry(width, height, depth), material);
  mesh.name = name;
  mesh.position.fromArray(position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinderBetween(name, start, end, radius, material, parent) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function pediment(name, parent, width, frontZ, baseY, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .42, bevelEnabled: false });
  geometry.translate(0, 0, -.21);
  const face = new THREE.Mesh(geometry, red); face.name = name; face.position.set(0, baseY, frontZ); parent.add(face);
  const vertices = [[-width / 2, baseY, frontZ + .25], [0, baseY + height, frontZ + .25], [width / 2, baseY, frontZ + .25]];
  cylinderBetween(`${name}Trim_L`, vertices[0], vertices[1], .22, pale, parent);
  cylinderBetween(`${name}Trim_R`, vertices[1], vertices[2], .22, pale, parent);
  cylinderBetween(`${name}Trim_B`, vertices[2], vertices[0], .22, pale, parent);
}

function reliefPanel(name, width, x, y, z, facing, parent) {
  const direction = facing === 'front' ? 1 : -1;
  box(name, [width, .52, .28], [x, y, z + direction * .24], pale, parent, .02);
  box(`${name}_Inset`, [width * .68, .22, .12], [x, y, z + direction * .43], limestone, parent, .015);
  box(`${name}_Diamond`, [Math.min(.34, width * .15), .34, .10], [x, y, z + direction * .53], pale, parent, .012).rotation.z = Math.PI / 4;
}

function classicalPilaster(name, x, y, z, facing, parent, height=20.4) {
  const direction = facing === 'front' ? 1 : -1;
  box(`${name}_Shaft`, [.88, height - 1.8, 1.08], [x, y, z + direction * .16], limestone, parent, .025);
  box(`${name}_Base`, [1.30, .62, 1.34], [x, y - height / 2 + .38, z + direction * .22], pale, parent, .025);
  box(`${name}_Neck`, [1.08, .34, 1.24], [x, y + height / 2 - .82, z + direction * .22], pale, parent, .02);
  box(`${name}_Capital`, [1.62, .82, 1.45], [x, y + height / 2 - .32, z + direction * .26], pale, parent, .035);
  for (const offset of [-.24, 0, .24]) {
    box(`${name}_Flute_${offset}`, [.07, height - 3.0, .08], [x + offset, y, z + direction * .75], redDark, parent);
  }
}

function batchStaticGeometry(parent) {
  parent.updateMatrixWorld(true);
  const meshes = [];
  parent.traverse((object) => { if (object.isMesh) meshes.push(object); });
  const batches = new Map();
  for (const mesh of meshes) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const photoFacade = /^(CentralRaised|CentralAttic|CentralFrieze|CentralUpperPediment|Entrance|MainEntrance|SidePediment|Pilaster_|CentralPilaster)/.test(mesh.name)
      && mesh.material !== warm && mesh.material !== recess;
    const batchGroup = photoFacade ? 'PhotoFacade' : 'Base';
    const key = `${mesh.material.uuid}:${batchGroup}`;
    if (!batches.has(key)) batches.set(key, { material: mesh.material, geometries: [], batchGroup });
    batches.get(key).geometries.push(geometry);
    mesh.parent.remove(mesh);
  }
  for (const { material, geometries, batchGroup } of batches.values()) {
    const geometry = mergeBufferGeometries(geometries, false);
    if (!geometry) throw new Error(`Unable to batch material ${material.name}`);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Batched_${batchGroup}_${material.name.replace(/\s+/g, '_')}`;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

const segments = [
  ['CentralSection', 0, 0, 0, 74],
  ['InnerWing_L', -50, 3.0, -4.5, 40], ['InnerWing_R', 50, 3.0, 4.5, 40],
  ['MiddleWing_L', -86, 10.0, -10.0, 40], ['MiddleWing_R', 86, 10.0, 10.0, 40],
  ['CurvedWing', -119, 21.0, -15.5, 36], ['CurvedWing_R', 119, 21.0, 15.5, 36],
];
let topNamed = false, groundNamed = false;
const rearFacade = { rectangularWindows: 0, topArches: 0, groundArches: 0, pilasters: 0, doors: 3 };

for (const [name, x, z, angle, width] of segments) {
  const segment = new THREE.Group(); segment.name = name; segment.position.set(x, 0, z); segment.rotation.y = THREE.MathUtils.degToRad(angle); root.add(segment);
  const frontZ = 11.72;
  const rearZ = -11.72;
  box(`${name}_Shell`, [width, 33, 23], [0, 16.5, 0], red, segment);
  box(`${name}_StoneBase`, [width + .4, 5.5, 1], [0, 2.75, frontZ + .08], limestone, segment);
  box(`${name}_BaseCornice`, [width + .8, .55, 1.12], [0, 5.7, frontZ + .10], pale, segment);
  box(`${name}_UpperCornice`, [width + .8, .58, 1.08], [0, 26.1, frontZ + .10], pale, segment);
  box(`${name}_RoofCornice`, [width + 1.2, .7, 1.18], [0, 32.65, frontZ + .08], pale, segment);
  box(`${name}_RearStoneBase`, [width + .4, 5.5, 1], [0, 2.75, rearZ - .08], limestone, segment);
  box(`${name}_RearBaseCornice`, [width + .8, .55, 1.12], [0, 5.7, rearZ - .10], pale, segment);
  box(`${name}_RearUpperCornice`, [width + .8, .58, 1.08], [0, 26.1, rearZ - .10], pale, segment);
  box(`${name}_RearRoofCornice`, [width + 1.2, .7, 1.18], [0, 32.65, rearZ - .08], pale, segment);
  box(`${name}_RoofCap`, [width, .48, 21.6], [0, 33.05, 0], roof, segment);

  const columns = Math.max(5, Math.round(width / 7.1));
  const step = (width - 5) / columns;
  for (let col = 0; col < columns; col++) {
    const px = -((columns - 1) * step) / 2 + col * step;
    for (let floor = 0; floor < 5; floor++) {
      const py = 8 + floor * 3.75;
      const windowMat = (floor * 7 + col * 3) % 9 === 0 ? warm : glass;
      rectangularWindow(`Window_${name}_${floor}_${col}`, step * .39, 2.05, px, py, frontZ, 'front', windowMat, segment);
      reliefPanel(`ReliefPanel_${name}_${floor}_${col}`, step * .48, px, py - 1.48, frontZ, 'front', segment);
      rectangularWindow(col === 0 && floor === 0 ? 'RearFacadeWindow' : `RearWindow_${name}_${floor}_${col}`, step * .39, 2.05, px, py, rearZ, 'rear', windowMat, segment);
      reliefPanel(`RearReliefPanel_${name}_${floor}_${col}`, step * .48, px, py - 1.48, rearZ, 'rear', segment);
      rearFacade.rectangularWindows++;
    }
    if (col % 2 === 0) {
      classicalPilaster(`Pilaster_${name}_${col}`, px - step * .55, 16, frontZ, 'front', segment);
      classicalPilaster(`RearPilaster_${name}_${col}`, px - step * .55, 16, rearZ, 'rear', segment);
      rearFacade.pilasters++;
    }
  }

  const archColumns = Math.max(2, Math.round(width / 13));
  const archStep = (width - 8) / archColumns;
  for (let col = 0; col < archColumns; col++) {
    const px = -((archColumns - 1) * archStep) / 2 + col * archStep;
    const topName = topNamed ? `TopArchWindow_${name}_${col}` : 'TopArchWindow'; topNamed = true;
    arch(`${topName}_Frame`, 6.35, 4, .42, [px, 29.3, frontZ + .22], pale, segment);
    arch(topName, 5.35, 3.25, .34, [px, 29.25, frontZ + .47], glass, segment);
    box(`${topName}_Mullion`, [.10, 2.75, .08], [px, 29.05, frontZ + .68], frame, segment, .018);
    box(`${topName}_Transom`, [5.0, .10, .08], [px, 29.05, frontZ + .68], frame, segment, .018);
    if (name !== 'CentralSection' || Math.abs(px) > 10) {
      const groundName = groundNamed ? `GroundArchWindow_${name}_${col}` : 'GroundArchWindow'; groundNamed = true;
      arch(`${groundName}_Frame`, 6.5, 4.5, .46, [px, 2.9, frontZ + .37], pale, segment);
      arch(groundName, 5.45, 3.7, .34, [px, 2.9, frontZ + .66], glass, segment);
      box(`${groundName}_Mullion`, [.10, 3.1, .08], [px, 2.72, frontZ + .87], frame, segment, .018);
    }
    arch(`RearTopArchFrame_${name}_${col}`, 6.35, 4, .42, [px, 29.3, rearZ - .22], pale, segment);
    arch(`RearTopArchWindow_${name}_${col}`, 5.35, 3.25, .34, [px, 29.25, rearZ - .47], glass, segment);
    box(`RearTopArchMullion_${name}_${col}`, [.10, 2.75, .08], [px, 29.05, rearZ - .68], frame, segment, .018);
    rearFacade.topArches++;
    if (name !== 'CentralSection' || Math.abs(px) > 10) {
      arch(`RearGroundFrame_${name}_${col}`, 6.5, 4.5, .46, [px, 2.9, rearZ - .37], pale, segment);
      arch(col === 0 ? 'RearGroundWindow' : `RearGroundWindow_${name}_${col}`, 5.45, 3.7, .34, [px, 2.9, rearZ - .66], glass, segment);
      box(`RearGroundMullion_${name}_${col}`, [.10, 3.1, .08], [px, 2.72, rearZ - .87], frame, segment, .018);
      rearFacade.groundArches++;
    }
  }

  if (name === 'MiddleWing_L' || name === 'MiddleWing_R') {
    const sideName = name.endsWith('_L') ? 'SidePediment_L' : 'SidePediment_R';
    pediment(sideName, segment, Math.min(22, width - 6), frontZ + .42, 32.2, 4.7);
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .35, 32), pale);
    medal.name = `${sideName}Medallion`; medal.rotation.x = Math.PI / 2; medal.position.set(0, 34, frontZ + .72); segment.add(medal);
  }
}

box('RearEntranceStone', [16.5, 5.5, 1.6], [0, 2.75, -12.05], limestone, root);
for (const x of [-4.2, 0, 4.2]) {
  box(x === 0 ? 'RearDoor' : `RearDoor_${x}`, [3.1, 4.2, .34], [x, 2.25, -12.92], x === 0 ? warm : glass, root);
}
box('RearEntranceCanopy', [17.5, .5, 2.5], [0, 5.9, -12.5], pale, root);

box('CentralProjectingBay', [31.5, 27.2, 2.4], [0, 17.5, 12.1], redDark, root);
for (const x of [-11.2, -5.6, 0, 5.6, 11.2]) {
  classicalPilaster('CentralPilaster', x, 16.7, 13.20, 'front', root, 21);
  for (let floor = 0; floor < 5; floor++) rectangularWindow('CentralWindow', 3.05, 2.05, x, 8 + floor * 3.75, 13.24, 'front', glass, root);
}

// The photographed centre rises above the curved wings with a second attic tier.
box('CentralRaisedAtticMass', [31.5, 6.6, 2.6], [0, 30.2, 12.18], red, root);
box('CentralRaisedAtticLowerCornice', [32.5, .62, 2.95], [0, 27.15, 12.28], pale, root);
box('CentralRaisedAtticUpperCornice', [32.8, .72, 3.0], [0, 33.32, 12.30], pale, root);
for (const x of [-9.2, -4.6, 0, 4.6, 9.2]) {
  rectangularWindow('CentralAtticWindow', 2.55, 2.42, x, 30.05, 13.52, 'front', glass, root);
}
for (const x of [-8.2, 0, 8.2]) reliefPanel('CentralFriezeRelief', 5.1, x, 27.92, 13.56, 'front', root);

box('EntranceStone', [22.5, 5.7, 3.2], [0, 2.85, 14], limestone, root);
for (const x of [-6.8, -2.25, 2.25, 6.8]) classicalPilaster('EntranceColumn', x, 3.35, 15.18, 'front', root, 6.1);
for (const x of [-4.5, 0, 4.5]) {
  arch('EntranceArchFrame', 3.75, 4.8, .38, [x, 3.0, 15.62], pale, root);
  arch('EntranceDoor', 3.12, 4.22, .24, [x, 2.88, 15.90], x === 0 ? warm : glass, root);
  box('EntranceDoorMullion', [.10, 3.65, .08], [x, 2.62, 16.08], frame, root, .015);
}
box('EntranceCanopy', [23.5, .62, 4.2], [0, 6.5, 14], pale, root);
for (let step = 0; step < 4; step++) {
  box('MainEntranceStep', [24.5 + step * 1.15, .22, 2.1 + step * .72], [0, .11 + step * .18, 16.65 + step * .36], limestone, root, .018);
}
// Photo reference: the first tier is the raised attic; one broad pediment crowns it.
pediment('CentralUpperPediment', root, 31.5, 13.84, 33.35, 5.8);
const crest = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .42, 40), pale);
crest.name = 'UniversityCrestMedallion'; crest.rotation.x = Math.PI / 2; crest.position.set(0, 36.05, 14.14); root.add(crest);

root.userData.rearFacade = rearFacade;
root.userData.realism = {
  recessedWindows: true,
  beveledMasonry: true,
  facadeModuleSystem: true,
  windowInteriors: true,
  surfaceWeathering: true,
  warmWindowRatio: .12,
  surfacePatterns: ['brick', 'stone', 'glass'],
};
root.userData.photoFacade = {
  storeys: 7,
  centralPedimentTiers: 2,
  sidePediments: 2,
  entranceDoors: 3,
  flutedPilasters: true,
  carvedReliefPanels: true,
  stoneBaseCourse: true,
  curvedWings: true,
};
batchStaticGeometry(root);
for (const [name, position] of [
  ['TopArchWindow', [0, 29.25, 12.19]],
  ['GroundArchWindow', [-18, 2.9, 12.38]],
  ['SidePediment', [-86, 34, 10.7]],
  ['SidePediment_L', [-86, 34, 10.7]],
  ['SidePediment_R', [86, 34, 10.7]],
  ['CentralPediment', [0, 35, 13.58]],
  ['CentralRaisedAttic', [0, 30.2, 13.5]],
  ['CentralUpperPediment', [0, 36.2, 13.84]],
  ['FlutedPilaster', [-11.2, 16.7, 13.9]],
  ['CorinthianCapital', [-11.2, 26.8, 13.9]],
  ['CarvedReliefPanel', [0, 27.92, 14.0]],
  ['EntrancePortico', [0, 4.1, 15.8]],
  ['MainEntranceSteps', [0, .45, 17.7]],
  ['RearFacadeWindow', [-30, 8, -11.96]],
  ['RearGroundWindow', [-18, 2.9, -12.38]],
  ['RearDoor', [0, 2.25, -12.92]],
]) {
  const marker = new THREE.Group(); marker.name = name; marker.position.fromArray(position); root.add(marker);
}

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true }));
const output = path.resolve('assets', 'models', 'main-building.glb');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, Buffer.from(glb));
console.log(`${output} ${glb.byteLength} bytes`);
