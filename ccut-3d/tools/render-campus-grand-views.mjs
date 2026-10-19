import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot ? createRequire(path.join(dependencyRoot, 'package.json')) : createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const url = process.env.PREVIEW_URL || `file:///${root.replace(/\\/g, '/')}/index.html?qa=cinematic&v=campus-grand-4`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1' && document.body.dataset.heroAssets === 'ready', null, { timeout: 30000 });
await page.click('#startBtn');

async function render(name, x, z, yaw = 0) {
  await page.evaluate(({ x, z, yaw }) => {
    Object.assign(window._dbg.P, { x, z, yaw, pitch: -0.08, y: 1.7, fly: false });
  }, { x, z, yaw });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(root, 'qa', name) });
}

await render('campus-grand-dorms.png', -280, -145, 0);
await render('campus-grand-academic.png', 270, -42, 0);

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log(path.join(root, 'qa', 'campus-grand-dorms.png'));
console.log(path.join(root, 'qa', 'campus-grand-academic.png'));
