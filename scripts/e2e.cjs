// Prueba de extremo a extremo en tamaño de teléfono. Simula las APIs externas (sin red en CI).
const { chromium, devices } = require('playwright');
const OUT = process.env.SHOTS || '/tmp/shots';
const URL = process.env.APP_URL || 'http://localhost:4173/';
const offFixture = {
  products: [
    { code: '0818290014153', product_name: 'Greek Yogurt Plain Nonfat', brands: 'Chobani', quantity: '907 g', serving_size: '170 g', serving_quantity: 170,
      nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10.6, carbohydrates_100g: 3.5, fat_100g: 0 } },
    { code: '96619962015', product_name: 'Yogurt griego natural', brands: 'Kirkland Signature', quantity: '1.36 kg',
      nutriments: { 'energy-kcal_100g': 100, proteins_100g: 9, carbohydrates_100g: 4, fat_100g: 5 } },
    { code: '111', product_name: 'Yogurt sin datos', brands: 'X', nutriments: {} },
  ],
};
const usdaFixture = { foods: [{ fdcId: 171284, description: 'Yogurt, Greek, plain, nonfat', dataType: 'SR Legacy', foodNutrients: [
  { nutrientNumber: '208', unitName: 'KCAL', value: 59 }, { nutrientNumber: '203', unitName: 'G', value: 10.2 },
  { nutrientNumber: '205', unitName: 'G', value: 3.6 }, { nutrientNumber: '204', unitName: 'G', value: 0.39 }] }] };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'Pixel 7'], defaultBrowserType: undefined });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.route('**/world.openfoodfacts.org/**', (r) => r.fulfill({ json: offFixture, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/api.nal.usda.gov/**', (r) => r.fulfill({ json: usdaFixture, headers: { 'access-control-allow-origin': '*' } }));

  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
  const noHScroll = async (label) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 0) errors.push(`overflow horizontal en ${label}: ${o}px`);
  };
  const step = (s) => console.log('✓', s);

  await page.goto(URL);
  await page.waitForSelector('.cal-card');
  await shot('01-inicio-vacio'); await noHScroll('inicio'); step('inicio vacío');

  // Agregar desde OFF (150 g)
  await page.click('.fab');
  await page.fill('.searchbar input', 'yogurt');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Greek Yogurt Plain Nonfat');
  await page.waitForSelector('text=Yogurt, Greek, plain, nonfat');
  await shot('02-busqueda'); await noHScroll('busqueda'); step('búsqueda OFF + USDA');
  await page.click('text=Kirkland Signature');
  await page.waitForSelector('.qty-input');
  await page.click('.chip:has-text("g")>> nth=0').catch(() => {});
  await page.locator('.chips .chip', { hasText: /^g$/ }).first().click();
  await page.fill('.qty-input', '150');
  await page.locator('.chips .chip', { hasText: 'Desayuno' }).click();
  const prev = await page.textContent('.preview-kcal span');
  if (prev.trim() !== '150') errors.push('preview kcal esperado 150, fue ' + prev);
  await shot('03-cantidad'); step('hoja de cantidad: 150 g → ' + prev + ' kcal');
  await page.click('.sheet-foot .btn-primary');
  await page.waitForSelector('.entry-row');
  const ring = await page.textContent('.cal-val');
  if (!ring.includes('150')) errors.push('consumidas esperado 150: ' + ring);
  step('registro aparece y totales: ' + ring);

  // Alimento incompleto → formulario prellenado
  await page.click('.fab');
  await page.fill('.searchbar input', 'yogurt');
  await page.keyboard.press('Enter');
  await page.click('text=Yogurt sin datos');
  await page.waitForSelector('.notice');
  await shot('04-incompleto'); step('incompleto abre formulario');
  await page.goBack(); await page.waitForTimeout(200);
  await page.goBack(); await page.waitForTimeout(300);
  if (await page.locator('.sheet').count()) errors.push('el botón atrás no cerró las hojas');
  else step('botón atrás cierra hojas');

  // Crear alimento propio con etiquetas y favorito desde Alimentos
  await page.click('.tab:has-text("Alimentos")');
  await page.click('button:has-text("Nuevo")');
  await page.fill('input[placeholder^="p. ej. Yogurt"]', 'Huevo cocido');
  await page.locator('.seg button', { hasText: 'unidad' }).click();
  await page.fill('.base-amt', '1');
  const nut = page.locator('.nut-grid input');
  await nut.nth(0).fill('72'); await nut.nth(1).fill('6.3'); await nut.nth(2).fill('0,4'); await nut.nth(3).fill('4.8');
  await page.fill('input[aria-label="Nueva etiqueta"]', 'Alto en proteína');
  await page.keyboard.press('Enter');
  await page.fill('input[aria-label="Nueva etiqueta"]', 'Casero');
  await page.keyboard.press('Enter');
  await page.locator('.switch').check();
  await shot('05-form-alimento'); await noHScroll('form');
  await page.click('.sheet-foot .btn-primary');
  await page.waitForSelector('.food-row:has-text("Huevo cocido")');
  await shot('06-alimentos'); await noHScroll('alimentos'); step('alimento propio creado');
  // filtro por etiqueta
  await page.locator('.tag-filter .chip', { hasText: '#Casero' }).click();
  const n = await page.locator('.list-card .food-row').count();
  if (n !== 1) errors.push('filtro etiqueta esperado 1, fue ' + n);
  step('filtro por etiqueta');
  // registrar 3 huevos en la cena
  await page.click('.food-row:has-text("Huevo cocido") .add-btn');
  await page.fill('.qty-input', '3');
  await page.locator('.chips .chip', { hasText: 'Cena' }).click();
  await page.click('.sheet-foot .btn-primary');
  await page.waitForTimeout(300);

  // Inicio: editar registro (cambiar categoría) y borrar con deshacer
  await page.click('.tab:has-text("Inicio")');
  await page.waitForSelector('.meal-card:has-text("Cena") .entry-row');
  const total = await page.textContent('.cal-val');
  if (!total.includes('366')) errors.push('total esperado 366: ' + total);
  step('total con 2 registros: ' + total);
  await page.click('.meal-card:has-text("Desayuno") .entry-row');
  await page.locator('.chips .chip', { hasText: 'Colación matutina' }).click();
  await page.fill('.qty-input', '200');
  await page.click('.sheet-foot .btn-primary');
  await page.waitForSelector('.meal-card:has-text("Colación matutina") .entry-row');
  step('editar cantidad y mover de categoría');
  await shot('07-inicio-con-datos');
  await page.click('.meal-card:has-text("Cena") .entry-row');
  await page.click('.btn-danger-ghost');
  await page.waitForSelector('.toast:has-text("eliminado")');
  if (await page.locator('.meal-card:has-text("Cena") .entry-row').count()) errors.push('no se eliminó');
  await page.click('.toast button:has-text("Deshacer")');
  await page.waitForSelector('.meal-card:has-text("Cena") .entry-row');
  step('eliminar + deshacer');

  // Persistencia
  await page.reload();
  await page.waitForSelector('.meal-card:has-text("Cena") .entry-row');
  const after = await page.textContent('.cal-val');
  if (!after.includes('416')) errors.push('tras recargar esperado 416: ' + after);
  step('persistencia tras recargar: ' + after);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('08-inicio-abajo');

  // Meta superada
  await page.click('.tab:has-text("Ajustes")');
  const g = page.locator('.goal-grid input');
  await g.nth(0).fill('300'); await g.nth(1).fill('20');
  await page.click('button:has-text("Guardar metas")');
  await shot('09-ajustes'); await noHScroll('ajustes');
  await page.click('.tab:has-text("Inicio")');
  await page.waitForSelector('.ring-lbl:has-text("de más")');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await shot('10-meta-superada'); step('meta superada se refleja');

  // Historial
  await page.click('.tab:has-text("Historial")');
  await page.waitForSelector('.wchart');
  await page.waitForTimeout(700);
  await shot('11-historial'); await noHScroll('historial'); step('historial con gráfica');

  // Tema oscuro
  await page.click('.tab:has-text("Ajustes")');
  await page.locator('.seg button', { hasText: 'Oscuro' }).click();
  await page.click('.tab:has-text("Inicio")');
  await page.waitForTimeout(200);
  await shot('12-oscuro'); step('tema oscuro');
  await page.click('.fab');
  await page.waitForTimeout(400);
  await shot('13-agregar-oscuro');

  // Pantalla pequeña (iPhone SE)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goBack(); await page.waitForTimeout(300);
  await noHScroll('320px');
  await shot('14-320px'); step('320 px sin desplazamiento horizontal');

  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'SIN ERRORES');
  await browser.close();
})();
