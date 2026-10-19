import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');

const pagePath = new URL('../index.html', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const url = process.env.PREVIEW_URL || `${pathToFileURL(pagePath).href}?qa=cinematic&v=stadium-grandstands-1`;
const frontOutput = new URL('../qa-stadium-grandstands-front.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const aerialOutput = new URL('../qa-stadium-grandstands-aerial.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
await page.click('#startBtn');
await page.evaluate(() => {
  Object.assign(window._dbg.P, { x: -336, y: 7.5, z: 89.6, yaw: Math.PI / 2, pitch: -.03, fly: true });
});
await page.waitForTimeout(700);
await page.screenshot({ path: frontOutput });
await page.evaluate(() => { Object.assign(window._dbg.P, { x: -414, y: 2, z: 89.6, yaw: Math.PI / 2, pitch: 0 }); });
await page.keyboard.press('KeyV');
await page.keyboard.press('KeyV');
await page.keyboard.press('KeyV');
await page.waitForTimeout(500);
await page.screenshot({ path: aerialOutput });

const state = await page.evaluate(() => ({
  layout: CAMPUS.getStadiumGrandstandLayout?.(),
  tierNames: window._campusScene.children.filter(object => object.name.startsWith('stadium-grandstand-')).map(object => object.name),
}));
if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
if (!state.layout) throw new Error('Stadium grandstand layout is not exposed');
if (state.tierNames.length !== state.layout.stands.length * state.layout.stands[0].tiers) {
  throw new Error(`Expected 14 stadium tiers, got ${state.tierNames.length}`);
}
await browser.close();
console.log(JSON.stringify({ ...state, frontOutput, aerialOutput }, null, 2));
