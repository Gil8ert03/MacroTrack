// Genera los PNG del icono a partir de public/icons/favicon.svg (requiere Playwright).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icons/favicon.svg'), 'utf8');
  const inner = svg.replace(/<rect[^>]*\/>/, '');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (size, file, { maskable = false, rounded = true } = {}) => {
    await page.setViewportSize({ width: size, height: size });
    const body = maskable
      ? `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#8B5CF6,#5B21B6);display:grid;place-items:center">${inner.replace('<svg', `<svg width="${size * 0.72}" height="${size * 0.72}"`)}</div>`
      : rounded
        ? svg.replace('<svg', `<svg width="${size}" height="${size}"`)
        : `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#8B5CF6,#5B21B6);display:grid;place-items:center">${inner.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>`;
    await page.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, '../public/icons', file), omitBackground: true });
  };
  await shot(192, 'icon-192.png');
  await shot(512, 'icon-512.png');
  await shot(512, 'icon-maskable-512.png', { maskable: true });
  await shot(180, 'apple-touch-icon.png', { rounded: false });
  await browser.close();
})();
