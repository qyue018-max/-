import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
if (!dependencyRoot) throw new Error('CODEX_NODE_MODULES is required');
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');
const root = path.resolve('.');
const source = pathToFileURL(path.join(root, 'qa', 'main-building-viewer.html')).href;
const output = path.join(root, 'qa', 'main-building-views');
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
for (const view of ['front', 'left', 'right', 'rear', 'close']) {
  await page.goto(`${source}?view=${view}`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, `${view}.png`) });
}
await browser.close();
console.log(output);
