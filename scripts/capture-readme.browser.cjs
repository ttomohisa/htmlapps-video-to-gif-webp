'use strict';
// Documentation only. Big Buck Bunny: (c) copyright 2008, Blender Foundation /
// www.bigbuckbunny.org, CC BY 3.0. Do not use synthetic regression captures here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
async function main() {
  const source = process.argv[2];
  assert.ok(source && fs.statSync(source).size === 4139823, 'Expected pinned Big Buck Bunny 480p sample');
  const target = path.resolve(process.argv[3] || 'test-results/readme-screenshots');
  fs.mkdirSync(target, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const language of ['ja', 'en']) {
      const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: language, reducedMotion: 'reduce', offline: true });
      try {
        const page = await context.newPage();
        const requests = [], errors = [];
        page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
        await page.locator('#helpButton').waitFor();
        if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
        await page.locator('#videoInput').setInputFiles({ name: 'BigBuckBunny.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(source) });
        await page.waitForFunction(() => { const v = document.querySelector('#videoPreview'); return v.readyState >= 2 && v.duration > 24 && v.videoWidth > 0; });
        await page.locator('#endRange').evaluate(el => { el.value = '23'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.locator('#startRange').evaluate(el => { el.value = '18'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.locator('#jumpStart').click();
        await page.waitForFunction(() => { const v = document.querySelector('#videoPreview'); return !v.seeking && Math.abs(v.currentTime - 18) < 0.2; });
        await page.locator('input[name="format"][value="webp"]').check();
        await page.locator('#widthSelect').selectOption('480');
        await page.locator('#fpsSelect').selectOption('15');
        await page.locator('#runButton').click();
        await page.waitForFunction(() => { const img = document.querySelector('#resultPreview'); return !document.querySelector('#runButton').disabled && img.complete && img.naturalWidth > 0 && img.alt === 'WEBP' && document.querySelector('#resultSection').classList.contains('is-visible'); }, {}, { timeout: 120000 });
        await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
        assert.deepEqual(requests, [], 'Runtime HTTP requests');
        assert.deepEqual(errors, [], 'Page errors');
        assert.equal(await page.locator('html').getAttribute('lang'), language);
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        const name = language === 'ja' ? 'screenshot.png' : 'screenshot-en.png';
        await page.screenshot({ path: path.join(target, name), fullPage: true });
        console.log('BIG_BUCK_BUNNY_SCREENSHOT ' + language + ' ' + name);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
