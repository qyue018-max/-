import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const url = `file:///${root.replace(/\\/g, '/')}/index.html?qa=cinematic&v=concrete-roads-1`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1' && document.body.dataset.heroAssets === 'ready', null, { timeout: 30000 });
await page.click('#startBtn');
await page.evaluate(() => {
  Object.assign(window._dbg.P, { x: -280, z: -145, y: 1.7, fly: false, yaw: 0 });
});
await page.keyboard.press('v');
await page.keyboard.press('v');
await page.waitForTimeout(700);
const output = path.join(root, 'qa', 'concrete-road-aerial.png');
await page.screenshot({ path: output });

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log(output);
