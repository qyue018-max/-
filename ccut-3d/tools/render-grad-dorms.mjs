import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRoot = process.env.CODEX_NODE_MODULES || 'C:/Users/win/.workbuddy/binaries/node/workspace';
const { chromium } = createRequire(path.join(dependencyRoot, 'package.json'))('playwright-core');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const url = `file:///${root.replace(/\\/g, '/')}/index.html?qa=cinematic&v=grad-dorms`;

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

async function render(name, x, z, y = 1.7, pitch = -0.08, yaw = 0) {
  await page.evaluate(({ x, z, y, pitch, yaw }) => {
    Object.assign(window._dbg.P, { x, z, yaw, pitch, y, fly: false });
  }, { x, z, y, pitch, yaw });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(root, 'qa', name) });
}

// 地面视角：站在两排宿舍之间的空地上
await render('grad-dorms-ground.png', 222, -230, 1.7, -0.02, 0);
// 高空俯瞰：整个东区东北角，覆盖两排宿舍 + 食堂
await render('grad-dorms-aerial.png', 222, -222, 190, -1.25, 0);

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log('done');
