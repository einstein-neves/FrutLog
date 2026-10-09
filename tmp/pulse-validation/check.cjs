const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe') });
  const results = [];
  for (const width of [1600, 1024, 390]) {
    for (const [file, role] of [['admin', 'admin'], ['eng', 'engenheiro'], ['tec', 'tecnico'], ['login', null]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => route.fulfill({ json: {
        usuarios: [], sensores: [], talhoes: [], inspecoes: [], plantios: [], ocorrencias: [],
        problemasSensores: [], tarefas: [], alertas: [], colheitas: [], leituras: [], mensal: [],
        relatorios: [], feeds: [], channel: {}, fields: {},
      } }));
      if (role) await page.addInitScript(role => {
        if (location.origin !== 'http://localhost:3000') return;
        sessionStorage.setItem('frutlog_sessao', JSON.stringify({ id: 1, nome: 'Usuário de Validação', matricula: 'teste', perfil: role }));
        sessionStorage.setItem('frutlog_token', 'validation-only');
      }, role);
      await page.goto(`http://localhost:3000/${file}.html`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('h1').count(), 1);
      if (role) {
        assert.equal(await page.locator('.pulse-profile strong').textContent(), 'Usuário de Validação');
        const links = page.locator('.menu .nav-link');
        for (let index = 0; index < await links.count(); index++) {
          await links.nth(index).click();
          assert(await links.nth(index).evaluate(el => el.classList.contains('active')));
          const hash = await links.nth(index).getAttribute('href');
          assert(await page.locator(hash).isVisible(), `${file} ${hash} should be visible`);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          assert.equal(overflow, false, `overflow: ${file}, ${width}, ${hash}`);
        }
        if (width > 760) {
          await page.locator('.pulse-search input').fill('telemetria');
          assert.equal(await page.locator('.menu .nav-link:visible').count(), 1);
          await page.locator('.pulse-search input').fill('');
        }
        if (width >= 1500) {
          await page.locator('.pulse-rail-link').first().click();
          const hash = await page.locator('.pulse-rail-link').first().getAttribute('href');
          assert(await page.locator(hash).isVisible());
        }
        await links.first().click();
      } else {
        await page.locator('#senha').fill('12345678');
        await page.locator('#togglePassword').click();
        assert.equal(await page.locator('#senha').getAttribute('type'), 'text');
      }
      assert.deepEqual(errors, [], `JavaScript errors: ${file} ${width}`);
      await page.screenshot({ path: path.resolve(__dirname, `${file}-${width}.png`), fullPage: true });
      results.push(`${file} ${width}px: OK`);
      await page.close();
    }
  }
  await browser.close();
  console.log(results.join('\n'));
})().catch(error => { console.error(error); process.exit(1); });
