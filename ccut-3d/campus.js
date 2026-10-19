// 长春工业大学北湖校区东区：基于 OpenStreetMap 真实轮廓 + Esri 卫星影像重建
// 坐标系：x 向东，z 向南（米），原点在东区中心附近
'use strict';
const CAMPUS = (function () {
  const T = THREE, D = CAMPUS_DATA, EXT = D.ext, VS = CAMPUS_VISUAL_STYLE;
  const places = [], nightMats = [], lampPos = [], waters = [], groundMats = [];
  const BOUND = { x0: EXT.minX + 8, x1: EXT.maxX - 8, z0: EXT.minZ + 8, z1: EXT.maxZ - 8 };
  const rand = (function () { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  let scene, mainPlazaTeleport = null, mainPlazaLayout = null;
  const stadiumLayout = VS.getStadiumGrandstandLayout();

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, rx, ry) {
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = 8; t.encoding = T.sRGBEncoding; return t;
  }
  function pip(x, z, P) {
    let ins = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
    }
    return ins;
  }
  function bbox(P) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    return { x0, x1, z0, z1 };
  }
  function centroid(P) { const b = bbox(P); return [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]; }

  // ---- 立面：一层 × 4 个开间，米制 UV（宽 14.4m / 高 3.6m 一张）----
  const wallCache = {};
  function wallMat(color) {
    if (wallCache[color]) return wallCache[color];
    const W = 256, H = 128, a = cv(W, H), g = a.getContext('2d'), b = cv(W, H), e = b.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${rand() * .05})`; g.fillRect(rand() * W, rand() * H, 3, 3); }
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    for (let c = 0; c < 4; c++) {
      const x = c * 64;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 12, y0(22), 40, 70);          // 窗洞阴影
      g.fillStyle = '#eef1f2'; g.fillRect(x + 13, y0(22), 38, 66);                   // 窗框
      const gl = g.createLinearGradient(0, 28, 0, 90); gl.addColorStop(0, '#7fa6c4'); gl.addColorStop(1, '#3e6784');
      g.fillStyle = gl; g.fillRect(x + 16, 28, 32, 58);
      g.fillStyle = '#eef1f2'; g.fillRect(x + 31, 28, 2, 58); g.fillRect(x + 16, 52, 32, 2);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 11, 90, 42, 4);                 // 窗台
      if (rand() > .25) { e.fillStyle = rand() > .5 ? '#ffdf9a' : '#fff3cf'; e.fillRect(x + 16, 28, 32, 58); }
    }
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, 0, W, 3);                         // 层线
    const m = new T.MeshLambertMaterial({ map: tex(a, 1 / 14.4, 1 / 3.6), emissive: 0xffffff, emissiveMap: tex(b, 1 / 14.4, 1 / 3.6), emissiveIntensity: 0 });
    nightMats.push(m); return wallCache[color] = m;
  }
  function landmarkWallMat(style) {
    const key = 'landmark:' + style.wall;
    if (wallCache[key]) return wallCache[key];
    const W = 256, H = 128, a = cv(W, H), g = a.getContext('2d'), b = cv(W, H), e = b.getContext('2d');
    g.fillStyle = style.wall; g.fillRect(0, 0, W, H);
    for (let y = 8; y < H; y += 10) {
      g.strokeStyle = 'rgba(255,225,205,.055)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    for (let y = 8; y < H; y += 10) for (let x = (y / 10 % 2) * 8; x < W; x += 18) {
      g.strokeStyle = 'rgba(35,15,22,.08)'; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y); g.stroke();
    }
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    for (let c = 0; c < 4; c++) {
      const x = c * 64;
      g.fillStyle = style.trim; g.fillRect(x + 8, 16, 48, 78);
      g.fillStyle = style.wallShadow; g.fillRect(x + 12, 19, 40, 72);
      const gl = g.createLinearGradient(0, 22, 0, 90); gl.addColorStop(0, '#7890a5'); gl.addColorStop(.45, style.glass); gl.addColorStop(1, '#17283a');
      g.fillStyle = gl; g.fillRect(x + 16, 24, 32, 61);
      g.fillStyle = style.trim; g.fillRect(x + 31, 24, 2, 61); g.fillRect(x + 16, 52, 32, 2);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 18, 27, 3, 55);
      if ((c + Math.floor(rand() * 5)) % 3 === 0) { e.fillStyle = style.warmGlass; e.fillRect(x + 16, 24, 32, 61); }
    }
    g.fillStyle = style.base; g.fillRect(0, 96, W, 32);
    g.fillStyle = style.trim; g.fillRect(0, 92, W, 5); g.fillRect(0, 7, W, 5);
    const m = new T.MeshLambertMaterial({ map: tex(a, 1 / 14.4, 1 / 3.6), emissive: 0xffc06a, emissiveMap: tex(b, 1 / 14.4, 1 / 3.6), emissiveIntensity: 0 });
    nightMats.push(m); return wallCache[key] = m;
  }
  function y0(v) { return v; }
  function labelSprite(text) {
    const c = cv(512, 96), g = c.getContext('2d');
    g.fillStyle = 'rgba(122,22,32,.88)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 504, 88, 18) : g.rect(4, 4, 504, 88); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 52px "PingFang SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex(c, 1, 1), depthWrite: false, fog: false })); sp.scale.set(22, 4.1, 1); return sp;
  }
  // ================= 建筑：真实轮廓挤出 + 细部 =================
  const bld = [];   // {pts,bb,h}
  const MAT = {
    rim: new T.MeshLambertMaterial({ color: 0x9a9890 }),
    equip: new T.MeshLambertMaterial({ color: 0xa8a8a2 }),
    hip: new T.MeshLambertMaterial({ color: 0x6a625b }),
    glass: new T.MeshPhongMaterial({ color: 0x2c4a63, shininess: 90, specular: 0x8899aa, emissive: 0x000000 }),
    frame: new T.MeshLambertMaterial({ color: 0xe9ecee }),
    steel: new T.MeshLambertMaterial({ color: 0x4a4e55 }),
    base: new T.MeshLambertMaterial({ color: 0x9d9a92 }),
    brick: new T.MeshLambertMaterial({ color: 0xb4574a }),
    white: new T.MeshLambertMaterial({ color: 0xf2f2ee }),
    step: new T.MeshLambertMaterial({ color: 0xbdb7aa }),
  };
  function addBox(w, h, d, x, y, z, mat, shadow) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = shadow !== false; m.receiveShadow = true; scene.add(m); return m;
  }
  function stadiumConcreteMaterial(layout) {
    const c = cv(384, 384), g = c.getContext('2d');
    g.fillStyle = layout.concreteColor; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 1100; i++) {
      const shade = 185 + Math.floor(rand() * 48);
      g.fillStyle = `rgba(${shade},${shade},${shade - 4},${.025 + rand() * layout.weathering * .16})`;
      const s = .5 + rand() * 2.3; g.fillRect(rand() * c.width, rand() * c.height, s, s);
    }
    g.strokeStyle = 'rgba(105,108,106,.13)'; g.lineWidth = 1;
    for (let y = 64; y < c.height; y += 96) {
      g.beginPath(); g.moveTo(0, y + rand() * 8); g.lineTo(c.width, y + rand() * 8); g.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = rand() * c.width, y = rand() * c.height;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + rand() * 24, y + 10 + rand() * 35); g.lineTo(x + rand() * 16, y + 30 + rand() * 36); g.stroke();
    }
    return new T.MeshPhongMaterial({ map: tex(c, 2.4, 2.4), color: 0xffffff, shininess: 5, specular: 0x343434 });
  }
  function addBeamBetween(a, b, radius, mat) {
    const av = new T.Vector3(a[0], a[1], a[2]), bv = new T.Vector3(b[0], b[1], b[2]);
    const delta = bv.clone().sub(av), length = delta.length();
    const beam = new T.Mesh(new T.CylinderGeometry(radius, radius, length, 8), mat);
    beam.position.copy(av.add(bv).multiplyScalar(.5));
    beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    beam.castShadow = true; scene.add(beam); return beam;
  }
  function makeStadiumGrandstands() {
    const concrete = stadiumConcreteMaterial(stadiumLayout);
    const fascia = new T.MeshLambertMaterial({ color: stadiumLayout.concreteShadow });
    const rail = new T.MeshPhongMaterial({ color: stadiumLayout.railingColor, shininess: 80, specular: 0xb9c1c5 });
    stadiumLayout.stands.forEach((stand, standIndex) => {
      const backX = stand.centerX - stand.depth / 2;
      const frontX = stand.centerX + stand.depth / 2;
      const tread = stand.depth / stand.tiers;
      for (let i = 0; i < stand.tiers; i++) {
        const tierFront = frontX - i * tread;
        const width = tierFront - backX;
        const height = (i + 1) * stand.tierRise;
        const tier = addBox(width, height, stand.length, backX + width / 2, height / 2 + .08, stand.centerZ, concrete);
        tier.name = `stadium-grandstand-${standIndex + 1}-tier-${i + 1}`;
        addBox(.08, height, stand.length + .08, tierFront, height / 2 + .08, stand.centerZ, fascia, false);
      }
      const topY = stand.tiers * stand.tierRise;
      const railX = backX + .2;
      for (let z = stand.centerZ - stand.length / 2; z <= stand.centerZ + stand.length / 2 + .01; z += 3.4) {
        addBeamBetween([railX, topY, z], [railX, topY + 1.45, z], .055, rail);
      }
      for (const y of [topY + .62, topY + 1.38]) {
        addBeamBetween([railX, y, stand.centerZ - stand.length / 2], [railX, y, stand.centerZ + stand.length / 2], .055, rail);
      }
      for (const side of [-1, 1]) {
        const z = stand.centerZ + side * (stand.length / 2 - .18);
        addBeamBetween([frontX - .15, .78, z], [railX, topY + 1.25, z], .06, rail);
        for (let i = 0; i <= stand.tiers; i += 2) {
          const x = frontX - i * tread;
          const y = Math.max(.15, i * stand.tierRise) + .08;
          addBeamBetween([x, y, z], [x, y + 1.12, z], .052, rail);
        }
      }
      const pts = [[backX, stand.centerZ - stand.length / 2], [frontX, stand.centerZ - stand.length / 2], [frontX, stand.centerZ + stand.length / 2], [backX, stand.centerZ + stand.length / 2]];
      bld.push({ pts, bb: bbox(pts), h: topY + 1.5 });
    });
  }
  function frustum(x0, x1, z0, z1, y, h, ix, iz, mat) {
    const B = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], Tp = [[x0 + ix, z0 + iz], [x1 - ix, z0 + iz], [x1 - ix, z1 - iz], [x0 + ix, z1 - iz]];
    const v = [];
    function tri(a, b, c) { v.push(...a, ...b, ...c); }
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, a = [B[i][0], y, B[i][1]], b = [B[j][0], y, B[j][1]], c = [Tp[j][0], y + h, Tp[j][1]], d = [Tp[i][0], y + h, Tp[i][1]];
      tri(a, d, c); tri(a, c, b);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.material.side = T.DoubleSide; scene.add(m); return m;
  }
  function isRect(P) {
    if (P.length !== 4) return false;
    const bb = bbox(P); for (const p of P) if (Math.min(Math.abs(p[0] - bb.x0), Math.abs(p[0] - bb.x1)) > .6 || Math.min(Math.abs(p[1] - bb.z0), Math.abs(p[1] - bb.z1)) > .6) return false;
    return true;
  }
  // 最靠南(+z)的最长外墙边：返回 {mx,mz,len,nx,nz}
  function southEdge(P) {
    let area = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area > 0 ? 1 : -1; let best = null;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 6) continue;
      const nx = sg * dz / L, nz = -sg * dx / L;
      if (nz > .85 && (!best || L > best.len)) best = { mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, len: L, nx, nz, tx: nz, tz: -nx };
    }
    return best;
  }
  function facadeBox(e, w, h, d, y, normal, along, mat, shadow) {
    const x = e.mx + e.nx * normal + e.tx * along, z = e.mz + e.nz * normal + e.tz * along;
    const m = addBox(w, h, d, x, y, z, mat, shadow); m.rotation.y = Math.atan2(e.nx, e.nz); return m;
  }
  const archFacadeCache = {};
  function archFacadeGeometry(w, h) {
    const key = w + ':' + h;
    if (archFacadeCache[key]) return archFacadeCache[key];
    const s = new T.Shape(), r = w / 2, spring = h / 2 - r;
    s.moveTo(-w / 2, -h / 2); s.lineTo(-w / 2, spring);
    s.absarc(0, spring, r, Math.PI, 0, true); s.lineTo(w / 2, -h / 2); s.closePath();
    return archFacadeCache[key] = new T.ShapeGeometry(s, 12);
  }
  function facadePanel(e, geometry, y, normal, along, mat) {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(e.mx + e.nx * normal + e.tx * along, y, e.mz + e.nz * normal + e.tz * along);
    mesh.rotation.y = Math.atan2(e.nx, e.nz); mesh.castShadow = true; scene.add(mesh); return mesh;
  }
  function outlinedArch(e, w, h, y, normal, along, glass, trimColor) {
    const panel = facadePanel(e, archFacadeGeometry(w, h), y, normal, along, glass);
    const outline = new T.LineSegments(new T.EdgesGeometry(panel.geometry, 10), new T.LineBasicMaterial({ color: trimColor }));
    outline.position.z = .025; panel.add(outline); return panel;
  }
  function grandBuildingFacade(b, e, style) {
    const stone = new T.MeshPhongMaterial({ color: style.base, shininess: 18, specular: 0x4b4140 });
    const trim = new T.MeshLambertMaterial({ color: style.trim });
    const brick = new T.MeshLambertMaterial({ color: style.wallShadow });
    const glass = new T.MeshPhongMaterial({ color: style.glass, shininess: 95, specular: 0x8ba0b4, emissive: style.warmGlass, emissiveIntensity: .18 });
    const archGlass = new T.MeshPhongMaterial({ color: style.glass, shininess: 110, specular: 0xa6bbcf });
    nightMats.push(glass);
    const frontage = Math.max(8, Math.min(e.len - 1.2, 110));
    const profile = VS.getGrandFacadeProfile(b, frontage);
    if (!profile.enabled) return;
    facadeBox(e, frontage, 1.15, .42, .58, .34, 0, stone);
    facadeBox(e, frontage, .34, .48, Math.max(2.8, b.h * .22), .37, 0, trim);
    facadeBox(e, frontage, .42, .54, Math.max(1.2, b.h - .4), .39, 0, trim);

    const pilasterCount = Math.max(3, Math.min(8, Math.round(frontage / 15) + 1));
    for (let i = 0; i < pilasterCount; i++) {
      const along = -frontage * .45 + frontage * .9 * i / Math.max(1, pilasterCount - 1);
      facadeBox(e, .62, profile.pilasterHeight, .48, profile.pilasterCenterY, .47, along, trim);
    }

    const topCount = Math.max(2, Math.min(7, Math.round(frontage / 13)));
    for (let i = 0; i < topCount; i++) {
      const along = -frontage * .39 + frontage * .78 * i / Math.max(1, topCount - 1);
      outlinedArch(e, Math.min(5.0, frontage / topCount * .53), profile.topArchHeight, profile.topArchCenterY, .69, along, archGlass, style.trim);
    }

    const groundCount = Math.max(1, Math.min(5, Math.round(frontage / 22)));
    for (let i = 0; i < groundCount; i++) {
      const along = -frontage * .34 + frontage * .68 * i / Math.max(1, groundCount - 1);
      if (Math.abs(along) < 4.2) continue;
      outlinedArch(e, Math.min(5.7, frontage / groundCount * .50), profile.groundArchHeight, profile.groundArchCenterY, .71, along, archGlass, style.trim);
    }

    const pedimentOffsets = frontage > 72 ? [-frontage * .28, 0, frontage * .28] : [0];
    const pedimentWidth = Math.min(frontage > 72 ? 19 : 26, frontage * .42);
    pedimentOffsets.forEach((along, index) => {
      const s = new T.Shape(); s.moveTo(-pedimentWidth / 2, 0); s.lineTo(pedimentWidth / 2, 0); s.lineTo(0, profile.pedimentHeight); s.closePath();
      const p = facadePanel(e, new T.ShapeGeometry(s), profile.pedimentBaseY, .54, along, brick);
      p.name = `campus-grand-pediment-${index}`;
      const edge = new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: style.trim })); p.add(edge);
    });

    const doorWidth = Math.min(14, frontage * .24), doorHeight = profile.doorHeight;
    facadeBox(e, doorWidth, doorHeight + .7, .56, (doorHeight + .7) / 2, .64, 0, stone);
    [-doorWidth * .27, 0, doorWidth * .27].forEach((along, index) => facadeBox(e, doorWidth * .22, doorHeight, .28, doorHeight / 2, .97, along, index === 1 ? glass : glass, false));
    facadeBox(e, doorWidth + 1.2, .42, 1.25, doorHeight + .45, .82, 0, trim);
  }
  function stoneTexture(style) {
    const c = cv(512, 768), g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 512, 768);
    bg.addColorStop(0, '#dca08b'); bg.addColorStop(.38, style.baseColor); bg.addColorStop(.74, '#bd7569'); bg.addColorStop(1, '#a96360');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 5200; i++) {
      const light = rand() > .52;
      g.fillStyle = light ? `rgba(255,229,204,${.02 + rand() * .055})` : `rgba(61,49,49,${.015 + rand() * .045})`;
      const r = .5 + rand() * 2.2; g.fillRect(rand() * 512, rand() * 768, r, r);
    }
    function mineralPatch(color, alpha, points) {
      g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.beginPath();
      points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.restore();
    }
    mineralPatch(style.veinColors[1], .38, [[-10,520],[80,455],[150,480],[188,612],[130,770],[-20,760]]);
    mineralPatch(style.veinColors[0], .28, [[310,65],[500,120],[540,285],[430,330],[338,238]]);
    mineralPatch(style.veinColors[2], .28, [[25,80],[170,25],[265,115],[214,220],[75,202]]);
    mineralPatch(style.veinColors[1], .24, [[245,410],[352,356],[463,405],[430,535],[310,570]]);
    function vein(color, width, alpha, points) {
      g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i + 2 < points.length; i += 3) g.bezierCurveTo(...points[i], ...points[i + 1], ...points[i + 2]);
      g.stroke(); g.restore();
    }
    vein(style.veinColors[1], 34, .56, [[-20, 125], [92, 165], [85, 285], [225, 330], [330, 370], [300, 505], [560, 535]]);
    vein(style.veinColors[2], 15, .72, [[-10, 102], [105, 160], [90, 257], [225, 306], [338, 355], [290, 478], [545, 520]]);
    vein(style.veinColors[0], 11, .78, [[5, 82], [116, 142], [92, 235], [220, 286], [340, 336], [292, 454], [520, 500]]);
    vein(style.veinColors[0], 7, .68, [[85, 780], [130, 650], [290, 690], [322, 570], [365, 515], [430, 505], [535, 402]]);
    vein(style.veinColors[2], 10, .48, [[-30, 615], [130, 560], [205, 620], [335, 610], [410, 600], [470, 650], [550, 670]]);
    // 照片中的竖向题刻以褪色笔触表现；避免臆造无法辨清的确切文字。
    g.save(); g.translate(280, 280); g.rotate(-.055); g.strokeStyle = 'rgba(64,42,38,.55)'; g.lineWidth = 5; g.lineCap = 'round';
    const marks = [[[0,0],[10,18],[-4,37],[12,55]], [[34,10],[22,28],[42,43],[25,66]], [[-5,84],[13,103],[-2,124],[18,145]], [[38,96],[24,117],[43,137],[28,159]]];
    marks.forEach(m => { g.beginPath(); g.moveTo(m[0][0], m[0][1]); for (let i = 1; i < m.length; i++) g.lineTo(m[i][0], m[i][1]); g.stroke(); }); g.restore();
    return tex(c, 1, 1);
  }
  function cylinderBetween(a, b, r, mat, parent, sides) {
    const va = new T.Vector3(...a), vb = new T.Vector3(...b), dir = new T.Vector3().subVectors(vb, va), len = dir.length();
    const mesh = new T.Mesh(new T.CylinderGeometry(r * .78, r, len, sides || 7), mat);
    mesh.position.copy(va).add(vb).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function addMainPlazaLandmarks(e) {
    const layout = VS.getMainPlazaLandmarks(e), angle = Math.atan2(e.nx, e.nz);
    mainPlazaLayout = layout; mainPlazaTeleport = layout.teleport;

    const planter = new T.Group(); planter.name = 'main-plaza-planter'; planter.position.set(layout.planter.position[0], 0, layout.planter.position[1]); planter.rotation.y = angle;
    const curb = new T.MeshLambertMaterial({ color: 0xaaa39b }), soil = new T.MeshLambertMaterial({ color: 0x352820 });
    const pw = layout.planter.width, pd = layout.planter.depth;
    [[pw, .42, .48, 0, .21, -pd / 2], [pw, .42, .48, 0, .21, pd / 2], [.48, .42, pd, -pw / 2, .21, 0], [.48, .42, pd, pw / 2, .21, 0]].forEach(q => {
      const m = new T.Mesh(new T.BoxGeometry(q[0], q[1], q[2]), curb); m.position.set(q[3], q[4], q[5]); m.castShadow = m.receiveShadow = true; planter.add(m);
    });
    const soilMesh = new T.Mesh(new T.PlaneGeometry(pw - .8, pd - .8), soil); soilMesh.rotation.x = -Math.PI / 2; soilMesh.position.y = .24; soilMesh.receiveShadow = true; planter.add(soilMesh); scene.add(planter);
    const cw = layout.collision.width / 2, cd = layout.collision.depth / 2, pc = layout.planter.position;
    const collisionPts = [[-cw,-cd],[cw,-cd],[cw,cd],[-cw,cd]].map(p => [pc[0] + e.tx * p[0] + e.nx * p[1], pc[1] + e.tz * p[0] + e.nz * p[1]]);
    bld.push({ pts: collisionPts, bb: bbox(collisionPts), h: layout.collision.height });

    const rockShape = new T.Shape();
    [[-2.65,0],[-2.95,1.1],[-2.7,3.15],[-1.85,5.55],[-.75,7.55],[.28,8.4],[1.55,7.8],[2.4,6.0],[2.8,3.9],[2.72,1.2],[2.35,0]].forEach((p, i) => i ? rockShape.lineTo(p[0], p[1]) : rockShape.moveTo(p[0], p[1])); rockShape.closePath();
    const rockGeo = new T.ExtrudeGeometry(rockShape, { depth: layout.stone.depth, bevelEnabled: true, bevelSegments: 2, bevelSize: .24, bevelThickness: .2, curveSegments: 2 }); rockGeo.translate(0, 0, -layout.stone.depth / 2);
    const rockMap = stoneTexture(layout.stone); const rock = new T.Mesh(rockGeo, new T.MeshPhongMaterial({ color: layout.stone.baseColor, shininess: 16, specular: 0x6a5b57 }));
    rock.name = 'main-plaza-stone'; rock.position.set(layout.stone.position[0], .28, layout.stone.position[1]); rock.rotation.y = angle; rock.scale.x = layout.stone.width / 5.75; rock.castShadow = rock.receiveShadow = true; scene.add(rock);
    const faceGeo = new T.ShapeGeometry(rockShape), pos = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 3.05) / 6.1, pos.getY(i) / 8.45);
    uv.needsUpdate = true;
    const face = new T.Mesh(faceGeo, new T.MeshPhongMaterial({ map: rockMap, bumpMap: rockMap, bumpScale: .045, shininess: 18, specular: 0x6a5b57, polygonOffset: true, polygonOffsetFactor: -2 }));
    face.position.z = layout.stone.depth / 2 + .215; face.castShadow = true; rock.add(face);

    const tree = new T.Group(); tree.name = 'main-plaza-tree'; tree.position.set(layout.tree.position[0], .25, layout.tree.position[1]);
    const bark = new T.MeshLambertMaterial({ color: 0x44302c }), white = new T.MeshLambertMaterial({ color: 0xd7d0c4 }), foliageBase = new T.Color(layout.tree.foliage);
    const leafMats = [[0,0,0],[.01,.08,.05],[-.015,.06,.1],[-.01,-.05,-.07]].map(shift => { const color = foliageBase.clone(); color.offsetHSL(shift[0], shift[1], shift[2]); return new T.MeshLambertMaterial({ color }); });
    cylinderBetween([0,0,0], [.18,3.0,.05], .47, layout.tree.whitewashedBase ? white : bark, tree, 9); cylinderBetween([.18,2.65,.05], [.15,10.8,.1], .42, bark, tree, 9);
    const branches = [[[.1,5.3,0],[-2.1,10.5,.3]], [[.12,5.8,.05],[2.7,11.7,-.5]], [[.1,7.1,.05],[-.6,14.3,-.1]], [[.1,8.0,.05],[1.0,15.0,.2]], [[-1.1,8.7,.15],[-3.3,12.4,.6]], [[1.3,9.4,-.2],[3.5,13.4,-.8]], [[-.5,10.1,.1],[-2.0,14.7,.8]], [[.7,10.5,0],[2.4,15.1,.35]]];
    branches.forEach((b, i) => cylinderBetween(b[0], b[1], .22 - i * .012, bark, tree, 7));
    const crowns = [[-2.8,11.5,.4,1.6],[-1.4,12.7,.2,1.45],[.1,13.6,0,1.7],[1.7,12.8,-.35,1.55],[3.0,12.1,-.65,1.45],[-1.3,14.6,.45,1.3],[.45,15.25,.1,1.45],[2.35,14.45,-.15,1.25],[3.6,13.65,-.8,1.1]];
    crowns.forEach((p, i) => { const m = new T.Mesh(new T.DodecahedronGeometry(p[3], 1), leafMats[i % leafMats.length]); m.position.set(p[0], p[1], p[2]); m.scale.set(1, 1.25, .82); m.rotation.set(rand(), rand() * 4, rand()); m.castShadow = true; tree.add(m); });
    tree.rotation.y = angle; scene.add(tree);
  }
  function mainLandmarkFacade(b, e, style) {
    const stone = new T.MeshPhongMaterial({ color: style.base, shininess: 20, specular: 0x4b4140 });
    const trim = new T.MeshLambertMaterial({ color: style.trim });
    const brick = new T.MeshLambertMaterial({ color: style.wallShadow });
    const glass = new T.MeshPhongMaterial({ color: style.glass, shininess: 115, specular: 0x9fb2c5, emissive: style.warmGlass, emissiveIntensity: .23 });
    nightMats.push(glass);
    const frontage = Math.min(e.len - 2, 138);
    facadeBox(e, frontage, 1.5, .5, .75, .36, 0, stone);
    facadeBox(e, frontage, .42, .58, 5.05, .38, 0, trim);
    facadeBox(e, frontage, .48, .65, b.h - 1.15, .4, 0, trim);
    const columns = [-54, -36, -21, -14, -7, 0, 7, 14, 21, 36, 54];
    columns.filter(v => Math.abs(v) < frontage / 2 - 2).forEach(v => facadeBox(e, .85, b.h - 2.2, .55, b.h / 2 + .7, .5, v, trim));
    facadeBox(e, 28, 1.1, .75, b.h + .1, .43, 0, trim);
    facadeBox(e, 32, 2.2, .65, b.h + .9, .42, 0, brick);

    const pedimentShape = new T.Shape(); pedimentShape.moveTo(-16, 0); pedimentShape.lineTo(16, 0); pedimentShape.lineTo(0, 5.1); pedimentShape.closePath();
    const pediment = new T.Mesh(new T.ShapeGeometry(pedimentShape), brick);
    pediment.position.set(e.mx + e.nx * .8, b.h + 2, e.mz + e.nz * .8); pediment.rotation.y = Math.atan2(e.nx, e.nz); scene.add(pediment);
    const pedimentTrim = new T.LineSegments(new T.EdgesGeometry(pediment.geometry), new T.LineBasicMaterial({ color: style.trim })); pediment.add(pedimentTrim);
    const crest = new T.Mesh(new T.CircleGeometry(1.25, 32), new T.MeshPhongMaterial({ color: 0xe8ded1, emissive: 0x5b312b, emissiveIntensity: .18 }));
    crest.position.set(e.mx + e.nx * .88, b.h + 4.1, e.mz + e.nz * .88); crest.rotation.y = Math.atan2(e.nx, e.nz); scene.add(crest);

    facadeBox(e, 18, 4.4, .7, 2.2, .72, 0, stone);
    [-5.4, 0, 5.4].forEach(v => facadeBox(e, 3.7, 3.25, .32, 1.82, 1.09, v, glass, false));
    [-7.7, -3.1, 3.1, 7.7].forEach(v => facadeBox(e, .55, 4.65, .55, 2.35, 1.15, v, trim));
    facadeBox(e, 20.5, .55, 1.0, 4.75, 1.03, 0, trim);

    const plaza = new T.Mesh(new T.PlaneGeometry(190, 92), new T.MeshPhongMaterial({
      color: 0x59636f, transparent: true, opacity: VS.getCinematicLighting().plazaReflectivity,
      specular: 0xffc995, shininess: 135, depthWrite: false,
    }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(e.mx + e.nx * 47, .045, e.mz + e.nz * 47); plaza.receiveShadow = true; scene.add(plaza);

    for (const side of [-1, 1]) {
      const lx = e.mx + e.tx * side * 11 + e.nx * 7.5, lz = e.mz + e.tz * side * 11 + e.nz * 7.5;
      const light = new T.PointLight(0xffa85c, VS.getCinematicLighting().entranceLightIntensity, 28, 2); light.position.set(lx, 4.2, lz); scene.add(light);
    }
    addMainPlazaLandmarks(e);
  }
  function entrance(e, big, h) {
    const w = big ? 12 : 3.2, hh = big ? 4.6 : 2.7;
    addBox(w, hh, .6, e.mx, hh / 2 + .15, e.mz + .35, MAT.glass, false);
    addBox(w + .5, .35, .7, e.mx, hh + .35, e.mz + .4, MAT.frame, false);
    addBox(w * .5, .12, hh, e.mx, hh / 2 + .15, e.mz + .55, MAT.frame, false).scale.x = .04;
    if (big) {
      const cd = 5.2;
      addBox(w + 6, .6, cd, e.mx, 5.6, e.mz + cd / 2, MAT.white);
      for (let i = 0; i < 5; i++) { const cx = e.mx - w / 2 - 2 + i * (w + 4) / 4; addBox(.7, 5.4, .7, cx, 2.85, e.mz + cd - .6, MAT.white); circAdd(cx, e.mz + cd - .6, .5, 6); }
      for (let i = 0; i < 4; i++) addBox(w + 8 + i * 1.4, .18, 1.1, e.mx, .09 + i * .18, e.mz + cd + .6 + (3 - i) * 1.1 - 2.6, MAT.step, false);
    } else {
      addBox(w + 1.6, .22, 2.0, e.mx, 3.2, e.mz + 1.1, MAT.frame);
      for (const s of [-1, 1]) addBox(.18, 3.1, .18, e.mx + s * (w / 2 + .6), 1.7, e.mz + 2.0, MAT.frame, false);
      addBox(w + 2, .18, 1.6, e.mx, .09, e.mz + 1.2, MAT.step, false);
    }
  }
  function gable(bb, y, hgt, over, axis, mat) {
    const w = (axis === 'z' ? bb.x1 - bb.x0 : bb.z1 - bb.z0) + over * 2, len = (axis === 'z' ? bb.z1 - bb.z0 : bb.x1 - bb.x0) + over * 2;
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, hgt); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
    const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true;
    const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2; m.position.set(cx, y, cz); if (axis === 'x') m.rotation.y = Math.PI / 2; scene.add(m);
  }
  function makeBuilding(b) {
    if (stadiumLayout.replacedBuildingIds.includes(b.id)) return;
    const P = b.pts, bb = bbox(P), visual = VS.getBuildingStyle(b), style = b.style || (b.kind === 'dormitory' ? 'dorm' : b.kind === 'university' ? 'uni' : 'plain');
    const heroStart = visual.preset === 'main-landmark' ? scene.children.length : -1;
    const shape = new T.Shape(P.map(p => new T.Vector2(p[0], -p[1])));
    const geo = new T.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false, steps: 1 }); geo.rotateX(-Math.PI / 2);
    const wall = b.wall || visual.wall || (b.kind === 'dormitory' ? '#d8cbb4' : b.kind === 'university' ? '#9b5a4f' : b.kind === 'residential' ? '#d9c9b0' : '#cfc7b8');
    const roofC = new T.Color(visual.roof || b.roof || '#888'); roofC.multiplyScalar(.58);
    const wallM = (visual.preset === 'main-landmark' || visual.preset === 'campus-grand') ? landmarkWallMat(visual) : (b.kind === 'service' || style === 'gate' || b.h < 5) ? new T.MeshLambertMaterial({ color: new T.Color(wall) }) : wallMat(wall);
    const m = new T.Mesh(geo, [new T.MeshLambertMaterial({ color: roofC }), wallM]); m.castShadow = m.receiveShadow = true; scene.add(m);
    const w = bb.x1 - bb.x0, d = bb.z1 - bb.z0, rect = isRect(P);
    // 勒脚基座
    if (b.h > 6) { const bg = new T.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false }); bg.rotateX(-Math.PI / 2); const baseMat = visual.base ? new T.MeshLambertMaterial({ color: visual.base }) : MAT.base; const bm = new T.Mesh(bg, baseMat); bm.scale.set(1.003, 1, 1.003); bm.position.set(-(bb.x0 + bb.x1) / 2 * .003, 0, -(bb.z0 + bb.z1) / 2 * .003); scene.add(bm); }
    // 屋顶
    if (style === 'hall') { gable(bb, b.h, 6, .8, b.axis || 'z', new T.MeshLambertMaterial({ color: b.roofColor || '#7a4a32' })); }
    else if (b.roofType === 'gable') { gable(bb, b.h, 3.2, .6, b.axis || 'x', new T.MeshLambertMaterial({ color: b.roofColor || '#c4553a' })); }
    else if ((style === 'dorm' || style === 'uni') && rect && w > 20) {
      frustum(bb.x0 - .6, bb.x1 + .6, bb.z0 - .6, bb.z1 + .6, b.h, 2.4, Math.min(4.2, d * .24), Math.min(4.2, d * .24), MAT.hip);
      addBox(w - 6, .5, d - 8.5, (bb.x0 + bb.x1) / 2, b.h + 2.2, (bb.z0 + bb.z1) / 2, new T.MeshLambertMaterial({ color: 0x77756f }));
    } else {
      const rg = new T.ExtrudeGeometry(shape, { depth: .8, bevelEnabled: false }); rg.rotateX(-Math.PI / 2); rg.translate(0, b.h, 0);
      const rm = new T.Mesh(rg, MAT.rim); rm.scale.set(1.004, 1, 1.004); rm.position.set(-(bb.x0 + bb.x1) / 2 * .004, 0, -(bb.z0 + bb.z1) / 2 * .004); rm.castShadow = true; scene.add(rm);
    }
    // 屋顶设备
    if (b.h > 9 && w * d > 500 && style !== 'hall') {
      const k = Math.min(6, Math.floor(w * d / 900) + 1);
      for (let i = 0; i < k; i++) {
        const x = bb.x0 + w * (.15 + rand() * .7), z = bb.z0 + d * (.25 + rand() * .5);
        if (!pip(x, z, P)) continue; addBox(2.5 + rand() * 3, 1.8 + rand() * 1.5, 2.5 + rand() * 2, x, b.h + (style === 'dorm' || style === 'uni' ? 3.4 : 1.4), z, MAT.equip);
      }
    }
    // 入口
    const se = southEdge(P);
    if (se && visual.preset === 'main-landmark') mainLandmarkFacade(b, se, visual);
    else if (se && visual.preset === 'campus-grand') grandBuildingFacade(b, se, visual);
    else if (se && style !== 'plain') entrance(se, style === 'office' || style === 'main', b.h);
    else if (se && w * d > 150 && b.h > 5) entrance(se, false, b.h);
    if (heroStart >= 0) scene.children.slice(heroStart).forEach(object => {
      if (object.isMesh && !object.name.startsWith('main-plaza-')) object.userData.heroFallback = 'mainBuilding';
    });
    // 宿舍端部红砖楼梯间
    if (style === 'dorm' && rect && w > 40) {
      const stairTowerMat = new T.MeshLambertMaterial({ color: visual.stairTowerWall || visual.wallShadow || '#542c33' });
      for (const sx of [bb.x0 + 3.2, bb.x1 - 3.2]) { /* 两端深红楼梯间 */
        addBox(6.4, b.h + .4, d + .8, sx, (b.h + .4) / 2, (bb.z0 + bb.z1) / 2, stairTowerMat);
      }
    }
    bld.push({ pts: P, bb, h: b.h + .5 });
    if (b.name) {
      const c = centroid(P), sp = labelSprite(b.name); sp.position.set(c[0], b.h + 9, c[1]); scene.add(sp);
      places.push({ name: b.name, x: c[0], z: c[1], r: Math.max(w, d) * .55 + 8, prio: 2 });
    }
  }

  // ================= 水面 =================
  function makeWater(w) {
    const bb = bbox(w.pts);
    const shape = new T.Shape(w.pts.map(p => new T.Vector2(p[0], -p[1])));
    const mat = new T.MeshPhongMaterial({ color: 0x2f6f8f, shininess: 140, specular: 0x99ccdd, transparent: true, opacity: .42, depthWrite: false });
    const mesh = new T.Mesh(new T.ShapeGeometry(shape), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.y = .08; mesh.renderOrder = 2; scene.add(mesh);
    waters.push({ pts: w.pts, bb, mat });
    window._waterMat = mat;
  }
  function inWater(x, z) {
    for (const w of waters) if (x > w.bb.x0 && x < w.bb.x1 && z > w.bb.z0 && z < w.bb.z1 && pip(x, z, w.pts)) return true;
    return false;
  }

  // ================= 碰撞：多边形(圆形角色) + 圆形障碍 =================
  const GRID = 24, circ = new Map();
  function circAdd(x, z, r, h) { const k = Math.floor(x / GRID) + ',' + Math.floor(z / GRID); (circ.get(k) || circ.set(k, []).get(k)).push([x, z, r, h]); }
  function pushSeg(x, z, r, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx, pz = a[1] + t * dz, ex = x - px, ez = z - pz, d2 = ex * ex + ez * ez;
    return { d2, ex, ez };
  }
  function collide(x, z, feetY, r) {
    for (let i = 0; i < bld.length; i++) {
      const B = bld[i]; if (feetY > B.h) continue;
      if (x < B.bb.x0 - r || x > B.bb.x1 + r || z < B.bb.z0 - r || z > B.bb.z1 + r) continue;
      const P = B.pts, inside = pip(x, z, P);
      let best = null, bd = 1e9;
      for (let k = 0, n = P.length; k < n; k++) {
        const s = pushSeg(x, z, r, P[k], P[(k + 1) % n]);
        if (s.d2 < bd) { bd = s.d2; best = s; }
      }
      if (inside) { const l = Math.sqrt(bd) + 1e-6; x -= best.ex / l * (l + r); z -= best.ez / l * (l + r); }
      else if (bd < r * r) { const l = Math.sqrt(bd) + 1e-6; x += best.ex / l * (r - l); z += best.ez / l * (r - l); }
    }
    const cx = Math.floor(x / GRID), cz = Math.floor(z / GRID);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = circ.get((cx + i) + ',' + (cz + j)); if (!arr) continue;
      for (const c of arr) {
        if (feetY > c[3]) continue;
        const dx = x - c[0], dz = z - c[1], rr = r + c[2], d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) { const l = Math.sqrt(d2) + 1e-6; x = c[0] + dx / l * rr; z = c[1] + dz / l * rr; }
      }
    }
    return [x, z];
  }
  function blockedPoint(x, z, pad) {
    for (const B of bld) if (x > B.bb.x0 - pad && x < B.bb.x1 + pad && z > B.bb.z0 - pad && z < B.bb.z1 + pad) {
      if (pip(x, z, B.pts)) return true;
      if (pad > 0) for (let k = 0, n = B.pts.length; k < n; k++) if (pushSeg(x, z, 0, B.pts[k], B.pts[(k + 1) % n]).d2 < pad * pad) return true;
    }
    return false;
  }
  // ================= 道路辅助（避让用）=================
  const roadSegs = [];
  function nearRoad(x, z, d) {
    for (const s of roadSegs) {
      if (x < s.x0 - d || x > s.x1 + d || z < s.z0 - d || z > s.z1 + d) continue;
      if (pushSeg(x, z, 0, s.a, s.b).d2 < d * d) return true;
    }
    return false;
  }

  // ================= 校园水泥道路 =================
  const roadMaterialCache = {};
  function roadConcreteMaterial(color, key) {
    if (roadMaterialCache[key]) return roadMaterialCache[key];
    const m = new T.MeshLambertMaterial({ color });
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRoadWorld;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 roadWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
roadWorld = instanceMatrix * roadWorld;
#endif
vRoadWorld = (modelMatrix * roadWorld).xz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vRoadWorld;
float roadHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float roadNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(roadHash(i), roadHash(i+vec2(1.0,0.0)), f.x), mix(roadHash(i+vec2(0.0,1.0)), roadHash(i+vec2(1.0,1.0)), f.x), f.y);
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
float roadGrain = roadNoise(vRoadWorld * .22) * .62 + roadNoise(vRoadWorld * 1.7) * .28 + roadNoise(vRoadWorld * 7.1) * .10;
diffuseColor.rgb *= .88 + roadGrain * .19;`);
    };
    m.customProgramCacheKey = () => 'campus-concrete-' + key;
    roadMaterialCache[key] = m;
    return m;
  }

  function roadInsideCampus(a, b) {
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    return x > BOUND.x0 && x < BOUND.x1 && z > BOUND.z0 && z < BOUND.z1;
  }

  function makeArrowGeometry() {
    const s = new T.Shape();
    s.moveTo(-.45, 1.6); s.lineTo(.45, 1.6); s.lineTo(.45, -.15); s.lineTo(1.1, -.15);
    s.lineTo(0, -1.7); s.lineTo(-1.1, -.15); s.lineTo(-.45, -.15); s.closePath();
    const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
  }

  function addRoadSurfaces() {
    const dummy = new T.Object3D();
    for (const kind of ['service', 'footway']) {
      const style = VS.getRoadSurfaceStyle(kind);
      if (!style.renderSurface) continue;
      const segments = [], joints = [], arrows = [];
      D.roads.filter(r => r.kind === kind).forEach(r => {
        for (let i = 0; i + 1 < r.pts.length; i++) {
          const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
          if (length < .35 || !roadInsideCampus(a, b)) continue;
          const yaw = Math.atan2(dx, dz);
          segments.push({ a, b, dx, dz, length, yaw });
          joints.push(a, b);
          VS.getRoadArrowDistances(kind, length).forEach(distance => {
            arrows.push({ x: a[0] + dx * distance / length, z: a[1] + dz * distance / length, yaw });
          });
        }
      });
      if (!segments.length) continue;

      const edge = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: style.edgeColor }), segments.length);
      const surface = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), roadConcreteMaterial(style.surfaceColor, kind), segments.length);
      segments.forEach((seg, i) => {
        dummy.position.set((seg.a[0] + seg.b[0]) / 2, .026, (seg.a[1] + seg.b[1]) / 2);
        dummy.rotation.set(0, seg.yaw, 0); dummy.scale.set(style.width + .65, .052, seg.length + .22); dummy.updateMatrix(); edge.setMatrixAt(i, dummy.matrix);
        dummy.position.y = .061; dummy.scale.set(style.width, .034, seg.length + .3); dummy.updateMatrix(); surface.setMatrixAt(i, dummy.matrix);
      });
      edge.receiveShadow = surface.receiveShadow = true; scene.add(edge, surface);

      const edgeJoint = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 18), edge.material, joints.length);
      const surfaceJoint = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 18), surface.material, joints.length);
      joints.forEach((p, i) => {
        dummy.position.set(p[0], .026, p[1]); dummy.rotation.set(0, 0, 0); dummy.scale.set((style.width + .65) / 2, .052, (style.width + .65) / 2); dummy.updateMatrix(); edgeJoint.setMatrixAt(i, dummy.matrix);
        dummy.position.y = .061; dummy.scale.set(style.width / 2, .034, style.width / 2); dummy.updateMatrix(); surfaceJoint.setMatrixAt(i, dummy.matrix);
      });
      edgeJoint.receiveShadow = surfaceJoint.receiveShadow = true; scene.add(edgeJoint, surfaceJoint);

      if (style.showCenterLine) {
        const lineMat = new T.MeshBasicMaterial({ color: style.centerLineColor });
        const lines = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), lineMat, segments.length);
        segments.forEach((seg, i) => {
          dummy.position.set((seg.a[0] + seg.b[0]) / 2, .087, (seg.a[1] + seg.b[1]) / 2);
          dummy.rotation.set(0, seg.yaw, 0); dummy.scale.set(.16, .018, Math.max(.2, seg.length - .5)); dummy.updateMatrix(); lines.setMatrixAt(i, dummy.matrix);
        });
        scene.add(lines);
      }

      if (style.showArrows && arrows.length) {
        const arrowMesh = new T.InstancedMesh(makeArrowGeometry(), new T.MeshBasicMaterial({ color: 0xf1eee4, side: T.DoubleSide }), arrows.length);
        arrows.forEach((arrow, i) => {
          dummy.position.set(arrow.x, .101, arrow.z); dummy.rotation.set(0, arrow.yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); arrowMesh.setMatrixAt(i, dummy.matrix);
        });
        scene.add(arrowMesh);
      }
    }
  }

  // ================= 总装 =================
  let loaded = 0, total = 0; const readyCbs = [];
  function onReady(cb) { if (total && loaded >= total) cb(); else readyCbs.push(cb); }
  function tileLoaded() { if (++loaded >= total) readyCbs.splice(0).forEach(f => f()); }

  function build(sc) {
    scene = sc;
    // 远景草地
    // Keep the fallback well below the photographic tiles.  At aerial camera
    // distances a five-centimetre gap z-fights, making whole tiles flicker.
    const far = new T.Mesh(new T.PlaneGeometry(5000, 5000), new T.MeshLambertMaterial({ color: 0x6f7a4a, depthWrite: false }));
    far.rotation.x = -Math.PI / 2; far.position.y = -1.5; far.renderOrder = -100; far.receiveShadow = true; scene.add(far);
    // 卫星影像地面
    total = SAT_TILES.length;
    const loader = new T.TextureLoader();
    SAT_TILES.forEach(t => {
      const tx = loader.load(t.src, tileLoaded); tx.encoding = T.sRGBEncoding; tx.anisotropy = 8; tx.minFilter = T.LinearMipmapLinearFilter;
      const gm = new T.MeshBasicMaterial({ map: tx, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); groundMats.push(gm);
      gm.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.)).xz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
float dist = length(vViewPosition_) ;
float nn = vn(vW * 3.1) * .5 + vn(vW * 11.3) * .3 + vn(vW * 37.0) * .2;
diffuseColor.rgb *= .84 + .32 * nn;`);
        sh.fragmentShader = sh.fragmentShader.replace('float dist = length(vViewPosition_) ;', '');
      };
      const mesh = new T.Mesh(new T.PlaneGeometry(t.x1 - t.x0, t.z1 - t.z0), gm);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set((t.x0 + t.x1) / 2, .02, (t.z0 + t.z1) / 2); mesh.renderOrder = -50; scene.add(mesh);
    });
    addRoadSurfaces();
    // 道路段索引
    D.roads.forEach(r => {
      if (r.kind === 'footway') return;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        roadSegs.push({ a, b, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]), kind: r.kind });
      }
    });
    D.water.forEach(makeWater);
    D.buildings.forEach(makeBuilding);
    makeStadiumGrandstands();

    // 足球场球门
    D.pitch.forEach(p => {
      const bb = bbox(p.pts), w = bb.x1 - bb.x0, h = bb.z1 - bb.z0;
      if (p.sport !== 'soccer' || Math.max(w, h) < 80) return;
      const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, alongZ = h > w, L = Math.max(w, h) / 2;
      const gm = new T.MeshLambertMaterial({ color: 0xffffff });
      for (const s of [-1, 1]) {
        const g = new T.Group(); g.position.set(alongZ ? cx : cx + s * (L - .5), 0, alongZ ? cz + s * (L - .5) : cz);
        if (alongZ) g.rotation.y = Math.PI / 2;
        for (const q of [-3.66, 3.66]) { const post = new T.Mesh(new T.CylinderGeometry(.06, .06, 2.44, 6), gm); post.position.set(0, 1.22, q); g.add(post); }
        const bar = new T.Mesh(new T.CylinderGeometry(.06, .06, 7.32, 6), gm); bar.rotation.x = Math.PI / 2; bar.position.y = 2.44; g.add(bar);
        scene.add(g);
      }
      places.push({ name: '田径场（足球场）', x: cx, z: cz, r: Math.max(w, h) * .8, prio: 1 });
    });
    D.places.forEach(p => places.push({ name: p.name, x: p.p[0], z: p.p[1], r: 55, prio: 0 }));

    const o = new T.Object3D();
    // ---- 普通校园植被可整体关闭；主楼石墩旁的标志树由地标模块独立保留 ----
    if (VS.shouldRenderVegetation('campus-tree')) {
    const seeds = D.treeSeeds || [], nMax = Math.min(seeds.length, 3200);
    const trunkM = new T.InstancedMesh(new T.CylinderGeometry(.2, .32, 3, 6), new T.MeshLambertMaterial({ color: 0x5a3d26 }), nMax);
    const crownG = new T.IcosahedronGeometry(2.4, 1); const cp = crownG.attributes.position;
    const hz = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), k = .82 + hz(x, y, z) * .36; cp.setXYZ(i, x * k, y * (.9 + .1 * k), z * k); }
    crownG.computeVertexNormals();
    const crownM = new T.InstancedMesh(crownG, new T.MeshLambertMaterial({ color: 0xffffff }), nMax);
    const coneM = new T.InstancedMesh(new T.ConeGeometry(2.1, 8, 8), new T.MeshLambertMaterial({ color: 0x2e6b3e }), nMax);
    const col = new T.Color(); let ti = 0, ci = 0;
    function treeOk(x, z) { return x > BOUND.x0 && x < BOUND.x1 && z > BOUND.z0 && z < BOUND.z1 && !blockedPoint(x, z, 2.5) && !nearRoad(x, z, 3.5) && !inWater(x, z); }
    for (let i = 0; i < seeds.length && ti < nMax; i++) {
      const x = seeds[i][0], z = seeds[i][1]; if (!treeOk(x, z)) continue;
      const s = .75 + rand() * .75, cone = rand() < .28;
      o.rotation.set(0, rand() * 6, 0);
      o.position.set(x, 1.5 * s, z); o.scale.set(s, s, s); o.updateMatrix(); trunkM.setMatrixAt(ti, o.matrix);
      if (cone) { o.position.set(x, 4.8 * s, z); o.updateMatrix(); coneM.setMatrixAt(ci++, o.matrix); o.scale.set(0, 0, 0); o.updateMatrix(); crownM.setMatrixAt(ti, o.matrix); col.setRGB(.1, .3, .15); crownM.setColorAt(ti, col); }
      else { o.position.set(x, 4.3 * s, z); o.scale.set(s, s * (.9 + rand() * .3), s); o.updateMatrix(); crownM.setMatrixAt(ti, o.matrix); col.setHSL(.17 + rand() * .12, .5, .2 + rand() * .12); crownM.setColorAt(ti, col); }
      ti++; circAdd(x, z, .4, 6);
    }
    trunkM.count = ti; crownM.count = ti; coneM.count = ci;
    [trunkM, crownM, coneM].forEach(m => { m.castShadow = true; scene.add(m); });
    }

    // ---- 运动场细部：跑道外缘护栏、篮球架、排球网 ----
    D.pitch.forEach(p => {
      const bb = bbox(p.pts), cxp = (bb.x0 + bb.x1) / 2, czp = (bb.z0 + bb.z1) / 2;
      if (p.sport === 'basketball') {
        // 6 块球场纵向排列：沿 z 每 ~20.6m 一块，球架在东西两端
        const n = 6, h = bb.z1 - bb.z0, sz = h / n;
        for (let k = 0; k < n; k++) for (const sx of [-1, 1]) {
          const x = cxp + sx * (bb.x1 - bb.x0) / 2 * .92, z = bb.z0 + (k + .5) * sz;
          addBox(.14, 3.2, .14, x, 1.6, z, MAT.steel, false); addBox(.1, 1.1, 1.7, x - sx * .6, 3.3, z, MAT.white, false); addBox(1.2, .1, .1, x - sx * .35, 3.3, z, MAT.steel, false);
          circAdd(x, z, .3, 4);
        }
      }
    });
    // 球场围网：沿足球场外环
    D.pitch.forEach(p => { if (p.sport === 'soccer' || p.sport === '') { const bb = bbox(p.pts); if (bb.x1 - bb.x0 > 100) {
      places.push({ name: '田径场', x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, r: 85, prio: 1 }); } } });

    // ---- 路灯：校内 service 路每 32m 一盏 ----
    const lampTotal = 220, postM = new T.InstancedMesh(new T.CylinderGeometry(.09, .13, 6, 6), new T.MeshLambertMaterial({ color: 0x33363b }), lampTotal);
    window._lampHeadMat = new T.MeshBasicMaterial({ color: 0x555555 });
    const headM = new T.InstancedMesh(new T.SphereGeometry(.42, 10, 8), window._lampHeadMat, lampTotal);
    D.roads.forEach(r => {
      if (r.kind !== 'service' && r.kind !== 'residential') return;
      let acc = 10;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (!L) continue;
        for (let s = acc; s < L; s += 32) {
          const x = a[0] + dx * s / L - dz / L * 3.2, z = a[1] + dz * s / L + dx / L * 3.2;
          if (lampPos.length >= lampTotal || blockedPoint(x, z, 1) || inWater(x, z)) continue;
          lampPos.push([x, z]);
        }
        acc = ((acc - L) % 32 + 32) % 32;
      }
    });
    lampPos.forEach((p, i) => {
      o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      o.position.set(p[0], 3, p[1]); o.updateMatrix(); postM.setMatrixAt(i, o.matrix);
      o.position.set(p[0], 6.2, p[1]); o.updateMatrix(); headM.setMatrixAt(i, o.matrix); circAdd(p[0], p[1], .25, 6);
    });
    postM.count = headM.count = lampPos.length; postM.castShadow = true; scene.add(postM, headM);
  }

  function groundY(x, z) { return inWater(x, z) ? -9 : 0; }
  // 默认出生点：校区南入口
  const spawn = D.places[0];
  return { build, collide, groundY, places, nightMats, groundMats, lampPos, BOUND, onReady, getMainPlazaTeleport: () => mainPlazaTeleport, getMainPlazaLandmarkLayout: () => mainPlazaLayout, getStadiumGrandstandLayout: () => stadiumLayout, ext: EXT, buildings: D.buildings, roads: D.roads, water: D.water, spawn, data: D };
})();
