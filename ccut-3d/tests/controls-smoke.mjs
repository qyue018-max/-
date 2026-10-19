import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4174/';
const output = new URL('../qa-controls.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const inGameOutput = new URL('../qa-controls-ingame.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1');
await page.click('#startBtn');

await page.keyboard.press('KeyF');
const altitudeBefore = await page.evaluate(() => window._dbg.P.y);
await page.keyboard.down('Space');
await page.waitForTimeout(160);
await page.keyboard.up('Space');
const altitudeAfter = await page.evaluate(() => window._dbg.P.y);
await page.keyboard.press('KeyV');
await page.keyboard.press('KeyN');
await page.keyboard.press('KeyM');
await page.keyboard.press('Digit6');
await page.waitForTimeout(120);

const active = await page.evaluate(() => ({
  fly: document.body.dataset.fly,
  night: document.body.dataset.night,
  view: document.body.dataset.view,
  map: document.body.dataset.map,
  mode: document.querySelector('#mode')?.textContent,
  minimap: getComputedStyle(document.querySelector('#minimap')).display,
  toast: document.querySelector('#toast')?.textContent,
}));

if (active.fly !== '1' || active.mode !== '飞行') throw new Error(`F did not enable flight: ${JSON.stringify(active)}`);
if (altitudeAfter <= altitudeBefore + .1) throw new Error(`Space did not raise the player in flight: ${altitudeBefore} -> ${altitudeAfter}`);
if (active.view !== '1') throw new Error(`V did not change view: ${JSON.stringify(active)}`);
if (active.night !== '1') throw new Error(`N did not change time mode: ${JSON.stringify(active)}`);
if (active.map !== '0' || active.minimap !== 'none') throw new Error(`M did not hide the minimap: ${JSON.stringify(active)}`);
if (!active.toast.includes('新闻传播学院')) throw new Error(`Digit6 did not teleport: ${JSON.stringify(active)}`);
await page.screenshot({ path: inGameOutput });

await page.keyboard.press('KeyH');
await page.waitForTimeout(80);
const help = await page.evaluate(() => ({
  paused: document.body.dataset.paused,
  display: getComputedStyle(document.querySelector('#overlay')).display,
  title: document.querySelector('.help-title')?.textContent,
}));
if (help.paused !== '1' || help.display !== 'flex' || !help.title.includes('键盘操作')) throw new Error(`H did not open integrated help: ${JSON.stringify(help)}`);

await page.screenshot({ path: output });
await browser.close();
if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
console.log(JSON.stringify({ active, altitudeBefore, altitudeAfter, help, screenshot: output, inGameScreenshot: inGameOutput }, null, 2));
