import { createRequire } from 'node:module';
import path from 'node:path';
const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4174/?qa=cinematic';
const output = new URL('../qa-main-building.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const sideOutput = new URL('../qa-main-building-side.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => {
  if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
await page.waitForFunction(() => ['ready', 'partial'].includes(document.body.dataset.heroAssets), null, { timeout: 30000 });
await page.click('#startBtn');
await page.keyboard.press('Digit2');
await page.waitForTimeout(1200);
await page.screenshot({ path: output });
await page.evaluate(() => {
  const camera = window._campusScene.children.find((object) => object.isPerspectiveCamera);
  window.__qaCameraLock = true;
  function lockCamera() {
    if (!window.__qaCameraLock) return;
    camera.position.set(205, 38, -28);
    camera.lookAt(61, 15, -128);
    requestAnimationFrame(lockCamera);
  }
  lockCamera();
});
await page.waitForTimeout(500);
await page.screenshot({ path: sideOutput });

const state = await page.evaluate(() => ({
  canvasCount: document.querySelectorAll('canvas').length,
  timeLabel: document.querySelector('#time')?.textContent,
  ready: document.body.dataset.ready,
  position: document.querySelector('#pos')?.textContent,
  cameraYaw: document.body.dataset.cameraYaw,
  mainPlazaTeleport: CAMPUS.getMainPlazaTeleport?.(),
  mainPlazaLayout: CAMPUS.getMainPlazaLandmarkLayout?.(),
  heroAssets: document.body.dataset.heroAssets,
  heroMainBuilding: document.body.dataset.heroMainBuilding,
  heroPlazaStone: document.body.dataset.heroPlazaStone,
  heroAutumnTree: document.body.dataset.heroAutumnTree,
}));

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
if (state.ready !== '1') throw new Error('Campus did not reach ready state');
if (state.heroAssets !== 'ready') throw new Error(`Blender hero assets did not all load: ${JSON.stringify(state)}`);
for (const id of ['heroMainBuilding', 'heroPlazaStone', 'heroAutumnTree']) {
  if (state[id] !== 'loaded') throw new Error(`${id} did not replace its procedural fallback`);
}
if (state.canvasCount < 2) throw new Error(`Expected WebGL and minimap canvases, got ${state.canvasCount}`);
if (state.timeLabel !== '黄昏') throw new Error(`Expected dusk label, got ${state.timeLabel}`);
if (!state.mainPlazaTeleport) throw new Error('Main plaza landmark layout was not built');
if (state.mainPlazaTeleport.position[1] < -60) throw new Error(`Main plaza viewpoint is too close to the stone: ${state.mainPlazaTeleport.position}`);
const [playerX, playerZ] = state.position.split(',').map(Number);
if (Math.abs(playerX - state.mainPlazaTeleport.position[0]) > 1 || Math.abs(playerZ - state.mainPlazaTeleport.position[1]) > 1) throw new Error(`Player did not reach main plaza viewpoint: ${state.position}`);
if (state.cameraYaw !== '0.000') throw new Error(`Player is not facing north toward the main building: ${state.cameraYaw}`);
if (!state.mainPlazaLayout) throw new Error('Main plaza layout is not exposed for collision verification');
const collision = await page.evaluate(() => {
  const layout = CAMPUS.getMainPlazaLandmarkLayout();
  return CAMPUS.collide(layout.planter.position[0], layout.planter.position[1], 0, .42);
});
if (Math.hypot(collision[0] - state.mainPlazaLayout.planter.position[0], collision[1] - state.mainPlazaLayout.planter.position[1]) < 1) throw new Error('Player can walk through the landmark planter');
await browser.close();
console.log(JSON.stringify({ ...state, screenshot: output, sideScreenshot: sideOutput }, null, 2));
