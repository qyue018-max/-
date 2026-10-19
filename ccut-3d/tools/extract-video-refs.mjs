import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dependencyRoot = process.env.CODEX_NODE_MODULES;
if (!dependencyRoot) throw new Error('CODEX_NODE_MODULES is required');
const require = createRequire(path.join(dependencyRoot, 'package.json'));
const { chromium } = require('playwright');

const videos = [
  'D:\\学校建模\\照片视频\\70b9c0cd9c08eadbb06811fc530adbcb.mp4',
  'D:\\学校建模\\照片视频\\3f1424ece9857d545ca05f9c8b2f5ca2.mp4',
];
const output = path.resolve('qa', 'main-building-video-refs');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

for (const videoPath of videos) {
  await page.goto(pathToFileURL(videoPath).href);
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && Number.isFinite(video.duration) && video.duration > 0;
  });
  const duration = await page.locator('video').evaluate((video) => video.duration);
  for (const [index, ratio] of [.05, .32, .62, .92].entries()) {
    await page.locator('video').evaluate((video, time) => {
      video.pause();
      video.currentTime = time;
      return new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    }, duration * ratio);
    await page.locator('video').screenshot({ path: path.join(output, `${path.parse(videoPath).name}-${index + 1}.png`) });
  }
}

await browser.close();
console.log(output);
