'use strict';
(function () {
  const T = THREE, LIGHT = CAMPUS_VISUAL_STYLE.getCinematicLighting();
  const canvas = document.getElementById('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  // A compact dusk cube environment gives the PBR brick, stone and glass a
  // shared architectural light rig without shipping a large HDR file.
  const reflectionFaces = [0x9f786f, 0x4d5874, 0x263d63, 0x4b3547, 0xd28a68, 0x353b55].map((color, index) => {
    const face = document.createElement('canvas'); face.width = face.height = 32;
    const g = face.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 32);
    const base = new T.Color(color), low = base.clone().multiplyScalar(index === 4 ? .78 : .52);
    grad.addColorStop(0, `#${base.getHexString()}`); grad.addColorStop(1, `#${low.getHexString()}`);
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); return face;
  });
  const reflectionEnvironment = new T.CubeTexture(reflectionFaces);
  reflectionEnvironment.name = 'architectural-reflection-environment';
  reflectionEnvironment.encoding = T.sRGBEncoding; reflectionEnvironment.needsUpdate = true;
  scene.environment = reflectionEnvironment;
  // A slightly larger near plane preserves depth precision in the 500 m aerial view.
  const camera = new T.PerspectiveCamera(70, innerWidth / innerHeight, .4, 4000);
  scene.add(camera);

  // ---- 光照与天空 ----
  const hemi = new T.HemisphereLight(LIGHT.hemisphereSky, LIGHT.hemisphereGround, LIGHT.hemisphereIntensity); scene.add(hemi);
  const ambient = new T.AmbientLight(LIGHT.ambientColor, LIGHT.ambientIntensity); scene.add(ambient);
  const sun = new T.DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 1; sc.far = 400; sun.shadow.bias = -.0006;
  scene.add(sun, sun.target);
  const skyGeo = new T.SphereGeometry(3000, 24, 16);
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(LIGHT.skyTop) }, bot: { value: new T.Color(LIGHT.skyBottom) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 p; void main(){ float h = clamp(normalize(p).y*1.4,0.,1.); gl_FragColor = vec4(mix(bot, top, pow(h,.7)),1.); }'
  });
  const sky = new T.Mesh(skyGeo, skyMat); scene.add(sky);
  scene.fog = new T.Fog(LIGHT.fog, 300, 1250);
  // 云
  const cloudMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, fog: false });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const g = new T.Group();
    for (let k = 0; k < 5; k++) { const s = new T.Mesh(new T.SphereGeometry(10 + Math.random() * 10, 8, 6), cloudMat); s.position.set(k * 14 - 28, Math.random() * 4, Math.random() * 8); s.scale.y = .5; g.add(s); }
    g.position.set((Math.random() - .5) * 1400, 160 + Math.random() * 60, (Math.random() - .5) * 1400); scene.add(g); clouds.push(g);
  }
  // 星空
  const starGeo = new T.BufferGeometry(); const sp = [];
  for (let i = 0; i < 700; i++) { const a = Math.random() * 6.283, b = Math.random() * 1.4; sp.push(Math.cos(a) * Math.cos(b) * 1400, Math.sin(b) * 1400, Math.sin(a) * Math.cos(b) * 1400); }
  starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  const starMat = new T.PointsMaterial({ color: 0xffffff, size: 3, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
  scene.add(new T.Points(starGeo, starMat));

  // ---- 构建校园 ----
  CAMPUS.build(scene);
  window._campusScene = scene;
  // 路灯点光（仅少量，避免性能开销）+ 发光灯头
  const nightLights = [];
  CAMPUS.lampPos.filter((_, i) => i % 8 === 0).slice(0, 12).forEach(l => {
    const pl = new T.PointLight(0xffd9a0, 0, 60, 2); pl.position.set(l[0], 6, l[1]); scene.add(pl); nightLights.push(pl);
  });

  // ---- 昼夜 ----
  let night = false, tNight = 0;
  const C = { dayTop: new T.Color(LIGHT.skyTop), dayBot: new T.Color(LIGHT.skyBottom), nTop: new T.Color(0x040816), nBot: new T.Color(0x142238) };
  function applyTime(k) {
    skyMat.uniforms.top.value.copy(C.dayTop).lerp(C.nTop, k);
    skyMat.uniforms.bot.value.copy(C.dayBot).lerp(C.nBot, k);
    scene.fog.color.copy(skyMat.uniforms.bot.value);
    hemi.intensity = LIGHT.hemisphereIntensity - .42 * k; hemi.color.setHex(k > .5 ? 0x5878b0 : LIGHT.hemisphereSky);
    ambient.intensity = LIGHT.ambientIntensity + .08 * k;
    sun.intensity = LIGHT.sunIntensity * (1 - k) + .22 * k; sun.color.setHex(k > .5 ? 0x9fb4ff : LIGHT.sunColor);
    CAMPUS.nightMats.forEach(m => m.emissiveIntensity = LIGHT.windowGlow + k * .42);
    window._lampHeadMat.color.setRGB(.33 + .67 * k, .33 + .55 * k, .33 + .3 * k);
    nightLights.forEach(l => l.intensity = k * 1.6);
    starMat.opacity = k; cloudMat.opacity = .8 - .55 * k;
    if (window._waterMat) window._waterMat.color.copy(new T.Color(0x2f6f8f)).lerp(new T.Color(0x0d2236), k);
    CAMPUS.groundMats.forEach(m => { const v = 1 - .78 * k; m.color.setRGB(v * (1 - .1 * k), v * (1 - .05 * k), v * (1 + .1 * k)); });
    document.getElementById('time').textContent = k > .5 ? '夜晚' : '黄昏';
  }
  function toggleNight() {
    night = !night;
    document.body.dataset.night = night ? '1' : '0';
    setHintActive('N', night);
    toast(night ? '夜晚模式 · 路灯已开启' : '黄昏模式');
  }

  // ---- 玩家 ----
  const SP = CAMPUS.spawn;
  const P = { x: SP.p[0], y: 1.7, z: SP.p[1], vy: 0, yaw: 0, pitch: 0, onGround: true, fly: false, run: false };
  const EYE = 1.7, RADIUS = .45;
  const keys = {};
  let started = false, locked = false, showMap = true;
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) { document.body.classList.add('touch'); helpDesk.style.display = 'none'; helpTouch.style.display = 'inline-block'; }

  const overlay = document.getElementById('overlay'), startBtn = document.getElementById('startBtn');
  startBtn.disabled = true; startBtn.textContent = '加载卫星影像…';
  CAMPUS.onReady(() => { startBtn.disabled = false; startBtn.textContent = '进入校园'; document.body.dataset.ready = '1'; });
  function closeHelp() {
    overlay.style.display = 'none'; started = true;
    document.body.dataset.started = '1'; document.body.dataset.paused = '0';
    if (!isTouch) canvas.requestPointerLock();
  }
  function openHelp() {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    overlay.style.display = 'flex'; startBtn.textContent = started ? '继续游览' : '进入校园';
    document.body.dataset.paused = '1';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  startBtn.onclick = closeHelp;
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && started && !isTouch) openHelp();
  });
  canvas.addEventListener('click', () => { if (started && !isTouch && !locked) canvas.requestPointerLock(); });
  document.addEventListener('mousemove', e => {
    if (!locked) return;
    P.yaw -= e.movementX * .0022; P.pitch -= e.movementY * .0022;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
  });
  const TOGGLE_KEYS = new Set(['KeyF', 'KeyN', 'KeyV', 'KeyT', 'KeyG', 'KeyM', 'KeyH', 'Escape']);
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.repeat && TOGGLE_KEYS.has(e.code)) return;
    if (e.code === 'KeyF') setFly(!P.fly);
    if (e.code === 'KeyN') toggleNight();
    if (e.code === 'KeyV') setView(view + 1);
    if (e.code === 'KeyT') setView(0);
    if (e.code === 'KeyG') { setFly(true); P.y = 120; P.pitch = -.7; setView(0); toast('高空飞行 · WASD 移动，空格/C 升降'); }
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyH' || e.code === 'Escape') openHelp();
    if (/^Digit[1-6]$/.test(e.code)) teleport(+e.code.slice(5) - 1);
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => keys[e.code] = false);
  function teleport(i) {
    const pl = CAMPUS_DATA.places[i]; if (!pl) return;
    const mainPlaza = i === 1 && CAMPUS.getMainPlazaTeleport ? CAMPUS.getMainPlazaTeleport() : null;
    const point = mainPlaza ? mainPlaza.position : pl.p;
    P.x = point[0]; P.z = point[1]; P.yaw = mainPlaza ? mainPlaza.yaw : (pl.yaw || 0); P.pitch = 0; P.vy = 0;
    document.body.dataset.cameraYaw = P.yaw.toFixed(3);
    if (!P.fly) P.y = EYE; toast('传送：' + pl.name);
  }
  function setHintActive(key, active) {
    const el = document.querySelector(`#controlHint [data-key="${key}"]`);
    if (el) el.classList.toggle('active', !!active);
  }
  function setFly(active) {
    P.fly = !!active; P.vy = 0;
    document.body.dataset.fly = P.fly ? '1' : '0';
    setMode(); setHintActive('F', P.fly);
    const flyButton = document.getElementById('bFly'), downButton = document.getElementById('bDown');
    if (flyButton) flyButton.classList.toggle('on', P.fly);
    if (downButton) downButton.style.display = P.fly ? 'block' : 'none';
    toast(P.fly ? '飞行已开启 · 空格上升 / C下降' : '已返回步行模式');
  }
  function toggleMap() {
    showMap = !showMap; mini.style.display = showMap ? 'block' : 'none';
    document.body.dataset.map = showMap ? '1' : '0'; setHintActive('M', !showMap);
    toast(showMap ? '小地图已显示' : '小地图已隐藏');
  }
  function setMode() { document.getElementById('mode').textContent = P.fly ? '飞行' : '步行'; }

  // ---- 触屏控制 ----
  const joy = { id: null, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
  const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
  joyEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; joy.id = t.identifier; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = (t.clientX - cx) / 50, dy = (t.clientY - cy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
      } else if (t.identifier === look.id) {
        P.yaw -= (t.clientX - look.x) * .005; P.pitch -= (t.clientY - look.y) * .005; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
        look.x = t.clientX; look.y = t.clientY;
      }
    }
  }, { passive: false });
  addEventListener('touchstart', e => {
    for (const t of e.changedTouches) if (look.id === null && t.identifier !== joy.id && !t.target.closest('#joy,.mbtn,#overlay')) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }, { passive: true });
  addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
      if (t.identifier === look.id) look.id = null;
    }
  });
  function hold(id, code) { const b = document.getElementById(id); const on = e => { e.preventDefault(); keys[code] = true; }; const off = e => { e.preventDefault(); keys[code] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); }
  hold('bJump', 'Space'); hold('bDown', 'KeyC');
  const tap = (id, fn) => document.getElementById(id).addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
  tap('bRun', () => { P.run = !P.run; bRun.classList.toggle('on', P.run); });
  tap('bFly', () => setFly(!P.fly));
  tap('bNight', toggleNight);
  tap('bView', () => setView(view + 1));

  // ---- UI ----
  const toastEl = document.getElementById('toast'), placeEl = document.getElementById('place');
  let toastT = 0, curPlace = '';
  function toast(s) { toastEl.textContent = s; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => toastEl.style.opacity = 0, 1500); }
  function updatePlace() {
    let best = null, bd = 1e9;
    for (const p of CAMPUS.places) { const d = Math.hypot(P.x - p.x, P.z - p.z); if (d < p.r && d < bd) { bd = d; best = p; } }
    const n = best ? best.name : '';
    if (n !== curPlace) { curPlace = n; if (n) { placeEl.textContent = n; placeEl.style.opacity = 1; } else placeEl.style.opacity = 0; }
  }

  // ---- 小地图 ----
  const mini = document.getElementById('minimap'), mg = mini.getContext('2d');
  const MS = .6; // 像素/米
  function poly(pts) { mg.beginPath(); pts.forEach((p, i) => i ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])); mg.closePath(); }
  function drawMini() {
    mg.fillStyle = '#6b7a4a'; mg.fillRect(0, 0, 400, 400);
    mg.save(); mg.translate(200, 200); mg.rotate(P.yaw + Math.PI); mg.scale(MS, MS); mg.translate(-P.x, -P.z);
    mg.fillStyle = '#2f6f8f'; CAMPUS.water.forEach(w => { poly(w.pts); mg.fill(); });
    mg.strokeStyle = '#e6e2d6'; CAMPUS.roads.forEach(r => { mg.lineWidth = r.kind === 'footway' ? 1.2 : r.kind === 'service' ? 5 : 10; mg.beginPath(); r.pts.forEach((p, i) => i ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])); mg.stroke(); });
    mg.fillStyle = '#c9876a'; CAMPUS.buildings.forEach(b => { poly(b.pts); mg.fill(); });
    mg.restore();
    mg.fillStyle = '#ff3b30'; mg.beginPath(); mg.moveTo(200, 186); mg.lineTo(192, 208); mg.lineTo(208, 208); mg.closePath(); mg.fill();
    mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.stroke();
  }

  // ---- 主循环 ----
  const clock = new T.Clock(); let fpsT = 0, fpsN = 0, frame = 0;
  const fwd = new T.Vector3(), rgt = new T.Vector3();
  function step(dt) {
    dt = Math.min(dt, .05);
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    mx += joy.x; mz += joy.y;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const run = keys.ShiftLeft || keys.ShiftRight || P.run;
    const turbo = keys.ControlLeft || keys.ControlRight;
    const speed = (P.fly ? (run ? 130 : 55) * (turbo ? 2.5 : 1) : (run ? 28 : 12) * (turbo ? 2 : 1));
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let dx, dz;
    if (P.fly) { // 飞行时沿视线方向前进
      const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
      fwd.set(-sy * cp, sp, -cy * cp); rgt.set(cy, 0, -sy);
      dx = (fwd.x * -mz + rgt.x * mx) * speed * dt; dz = (fwd.z * -mz + rgt.z * mx) * speed * dt;
      P.y += fwd.y * -mz * speed * dt;
      if (keys.Space) P.y += speed * .7 * dt; if (keys.KeyC) P.y -= speed * .7 * dt;
      P.y = Math.max(EYE + .1, Math.min(500, P.y));
    } else {
      dx = (-sy * -mz + cy * mx) * speed * dt; dz = (-cy * -mz - sy * mx) * speed * dt;
      const gy = CAMPUS.groundY(P.x, P.z) + EYE;
      if (keys.Space && P.onGround) { P.vy = 6.2; P.onGround = false; }
      P.vy -= 18 * dt; P.y += P.vy * dt;
      if (P.y <= gy) { P.y = gy; P.vy = 0; P.onGround = true; }
    }
    // 分轴移动 + 碰撞 + 水域阻挡
    const feet = P.y - EYE;
    let nx = P.x + dx, nz = P.z;
    if (!P.fly && CAMPUS.groundY(nx, nz) < -1) nx = P.x;
    let r = CAMPUS.collide(nx, nz, feet, RADIUS); nx = r[0]; nz = r[1];
    let mz2 = nz + dz;
    if (!P.fly && CAMPUS.groundY(nx, mz2) < -1) mz2 = nz;
    r = CAMPUS.collide(nx, mz2, feet, RADIUS); nx = r[0]; mz2 = r[1];
    const B = CAMPUS.BOUND;
    P.x = Math.max(B.x0 + 1, Math.min(B.x1 - 1, nx)); P.z = Math.max(B.z0 + 1, Math.min(B.z1 - 1, mz2));
    // 步行颠簸 + 多视图相机
    const bob = (!P.fly && P.onGround && ml > .1 && view === 0) ? Math.sin(performance.now() * (run ? .014 : .009)) * .035 * (run ? 1.4 : 1) : 0;
    placeCamera(bob, ml, dt);
  }
  // ---- 视图：0 第一人称 1 第三人称 2 俯视 3 鸟瞰斜视 4 环绕自动 ----
  const VIEWS = ['第一人称', '第三人称', '正上方俯视', '鸟瞰斜视', '自动环绕'];
  let view = 0, orbitA = 0, camDist = 9, zoom = 1;
  const avatar = (function () {
    const g = new T.Group(), skin = new T.MeshLambertMaterial({ color: 0xf0c8a0 }), cloth = new T.MeshLambertMaterial({ color: 0x2f6fbf }), pants = new T.MeshLambertMaterial({ color: 0x33384a });
    const body = new T.Mesh(new T.BoxGeometry(.55, .75, .3), cloth); body.position.y = 1.15; body.castShadow = true; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(.18, 12, 10), skin); head.position.y = 1.7; head.castShadow = true; g.add(head);
    const legs = [], arms = [];
    for (const sx of [-1, 1]) {
      const l = new T.Mesh(new T.BoxGeometry(.2, .78, .22), pants); l.geometry.translate(0, -.39, 0); l.position.set(sx * .14, .78, 0); l.castShadow = true; g.add(l); legs.push(l);
      const a = new T.Mesh(new T.BoxGeometry(.14, .65, .16), cloth); a.geometry.translate(0, -.3, 0); a.position.set(sx * .37, 1.5, 0); a.castShadow = true; g.add(a); arms.push(a);
    }
    g.userData = { legs, arms }; g.visible = false; scene.add(g); return g;
  })();
  let walkPh = 0;
  function placeCamera(bob, ml, dt) {
    const fy = P.y - EYE;
    avatar.visible = view !== 0;
    avatar.position.set(P.x, fy, P.z); avatar.rotation.y = P.yaw + Math.PI;
    walkPh += (ml > .1 ? 1 : 0) * dt * (keys.ShiftLeft || P.run ? 11 : 7); const sw = ml > .1 ? Math.sin(walkPh) * .7 : 0;
    avatar.userData.legs[0].rotation.x = sw; avatar.userData.legs[1].rotation.x = -sw; avatar.userData.arms[0].rotation.x = -sw * .8; avatar.userData.arms[1].rotation.x = sw * .8;
    camera.rotation.order = 'YXZ';
    if (view === 0) { camera.position.set(P.x, P.y + bob, P.z); camera.rotation.set(P.pitch, P.yaw, 0); }
    else if (view === 1) {
      const d = camDist * zoom, cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
      camera.position.set(P.x + Math.sin(P.yaw) * cp * d, fy + 1.6 + Math.max(0.3, sp * d + 1.4), P.z + Math.cos(P.yaw) * cp * d);
      camera.lookAt(P.x, fy + 1.4, P.z);
    }
    else if (view === 2) { camera.position.set(P.x, 180 * zoom + 20, P.z + .01); camera.rotation.set(-Math.PI / 2, P.yaw, 0); avatar.scale.setScalar(3); }
    else if (view === 3) {
      const d = 150 * zoom; camera.position.set(P.x + Math.sin(P.yaw) * d * .7, fy + d * .8 + 10, P.z + Math.cos(P.yaw) * d * .7); camera.lookAt(P.x, fy, P.z); avatar.scale.setScalar(2.4);
    }
    else if (view === 4) {
      orbitA += dt * .12; const d = 190 * zoom; camera.position.set(P.x + Math.sin(orbitA) * d, 85 * zoom + 20, P.z + Math.cos(orbitA) * d); camera.lookAt(P.x, 10, P.z); avatar.scale.setScalar(2.4);
    }
    if (view <= 1) avatar.scale.setScalar(1);
    if (view === 1) { const camY = camera.position.y; const gy = CAMPUS.groundY(camera.position.x, camera.position.z); if (camY < gy + .5) camera.position.y = gy + .5; }
  }
  function setView(v) {
    view = ((v % VIEWS.length) + VIEWS.length) % VIEWS.length;
    document.body.dataset.view = String(view);
    document.getElementById('view').textContent = VIEWS[view];
    setHintActive('V', view !== 0); toast('视图：' + VIEWS[view]);
  }
  addEventListener('wheel', e => {
    if (view >= 1) { zoom = Math.max(.25, Math.min(3, zoom * (1 + Math.sign(e.deltaY) * .1))); toast('镜头距离 ' + Math.round(zoom * 100) + '%'); }
  });
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta(); frame++;
    if (started) step(dt);
    // 昼夜渐变
    const target = night ? 1 : 0; if (Math.abs(tNight - target) > .001) { tNight += Math.sign(target - tNight) * Math.min(Math.abs(target - tNight), dt * .8); applyTime(tNight); }
    // 太阳跟随玩家，保证阴影分辨率
    sun.position.set(P.x + 120, 160, P.z + 80); sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld();
    clouds.forEach(c => { c.position.x += dt * 2; if (c.position.x > 800) c.position.x = -800; });
    sky.position.copy(camera.position);
    if (window._waterMat) window._waterMat.opacity = .42 + Math.sin(performance.now() * .0015) * .04;
    if (frame % 6 === 0) { updatePlace(); document.getElementById('pos').textContent = P.x.toFixed(0) + ', ' + P.z.toFixed(0); if (showMap) drawMini(); }
    fpsT += dt; fpsN++; if (fpsT > .5) { document.getElementById('fps').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsT = fpsN = 0; }
    renderer.render(scene, camera);
  }
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  // 可选：#x,z,yaw角度,pitch角度,高度[,n] 直接定位视点（便于分享/调试）
  if (location.hash.length > 1) {
    const a = location.hash.slice(1).split(',');
    if (a.length >= 4) {
      P.x = +a[0]; P.z = +a[1]; P.yaw = +a[2] * Math.PI / 180; P.pitch = +a[3] * Math.PI / 180;
      if (a[4]) { P.y = +a[4]; P.fly = P.y > 5; setMode(); }
      if (a[5] === 'n') { night = true; tNight = 1; }
      if (a[6]) setView(+a[6]);
      overlay.style.display = 'none'; started = true; document.body.dataset.started = '1'; document.body.dataset.paused = '0';
    }
  }
  document.body.dataset.fly = P.fly ? '1' : '0'; document.body.dataset.night = night ? '1' : '0';
  document.body.dataset.view = String(view); document.body.dataset.map = showMap ? '1' : '0';
  setHintActive('F', P.fly); setHintActive('N', night); setHintActive('V', view !== 0); setHintActive('M', !showMap);
  applyTime(tNight); animate();
  window._dbg = { P, CAMPUS, camera, scene, renderer, step };
})();
