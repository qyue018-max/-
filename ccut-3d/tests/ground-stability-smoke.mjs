import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4174/';
const output = new URL('../qa-ground-stable.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
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
await page.waitForFunction(() => document.body.dataset.ready === '1');
await page.click('#startBtn');
await page.evaluate(() => {
  Object.assign(window._dbg.P, { x: 35, y: 1.7, z: 185, yaw: Math.PI, pitch: -.55 });
});
await page.keyboard.press('KeyV');
await page.keyboard.press('KeyV');
await page.keyboard.press('KeyV');
await page.waitForTimeout(600);

const frames = [];
for (let i = 0; i < 6; i++) {
  frames.push(await page.screenshot());
  await page.waitForTimeout(90);
}
await page.screenshot({ path: output });

async function sample(buffer) {
  return sharp(buffer).extract({ left: 430, top: 420, width: 740, height: 330 }).resize(37, 17).removeAlpha().raw().toBuffer();
}
const reference = await sample(frames[0]);
let maxMeanDifference = 0;
for (const frame of frames.slice(1)) {
  const current = await sample(frame);
  let total = 0;
  for (let i = 0; i < reference.length; i++) total += Math.abs(reference[i] - current[i]);
  maxMeanDifference = Math.max(maxMeanDifference, total / reference.length);
}

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
if (maxMeanDifference > 1.25) throw new Error(`Aerial ground changed between fixed-camera frames: mean difference ${maxMeanDifference}`);
await browser.close();
console.log(JSON.stringify({ frames: frames.length, maxMeanDifference, screenshot: output }, null, 2));
