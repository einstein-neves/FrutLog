const { chromium } = require('./pulse-validation/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert/strict');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(process.cwd(), new URL(req.url, 'http://localhost').pathname);
    fs.readFile(file, (error, data) => {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.statusCode = error ? 404 : 200; res.end(data);
    });
  });
  await new Promise(resolve => server.listen(5521, resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe') });
    for (const width of [1440, 390]) for (const [file, role] of [['admin', 'admin'], ['eng', 'engenheiro'], ['tec', 'tecnico']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('http://localhost:1880/**', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
      await page.route('**/api/**', route => route.fulfill({ json: {
        usuarios: [{id: 2, nome: 'Teste', matricula: '1', cargo: 'Campo', perfil: 'tecnico', status: 'ativo', ativo: true}],
        sensores: [], talhoes: [], inspecoes: [], ocorrencias: [], plantios: [], tarefas: [], alertas: [], problemasSensores: [], colheitas: [],
        leituras: [{ dia: '2026-10-09', talhao: 'A1', codigo_metrica: 'temperatura', valor_medio: 28, valor_minimo: 26, valor_maximo: 30, leituras_contabilizadas: 4 }],
        mensal: [], relatorios: [], feeds: [],
      } }));
      await page.addInitScript(role => {
        if (location.origin !== 'http://localhost:5521') return;
        sessionStorage.setItem('frutlog_sessao', JSON.stringify({id:1, nome:'Teste', perfil:role}));
      }, role);
      await page.goto(`http://localhost:5521/${file}.html`, { waitUntil: 'networkidle' });
      const links = page.locator('.menu .nav-link');
      for (let i = 0; i < await links.count(); i++) {
        await links.nth(i).click();
        const hash = await links.nth(i).getAttribute('href');
        assert(await page.locator(hash).isVisible(), `${file}: ${hash}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} overflow ${width} ${hash}`);
      }
      if (file === 'eng') {
        await page.locator('.menu a[href="#historico"]').click();
        assert(await page.locator('#grafico-clima-mensal-engenheiro').isVisible());
        await links.first().click();
        assert(!await page.locator('#grafico-clima-mensal-engenheiro').isVisible());
      }
      if (file === 'tec') {
        await page.locator('.menu a[href="#aba-telemetria"]').click();
        assert.equal(await page.locator('.thingspeak-embeds iframe').count(), 2);
        assert((await page.locator('#tabela-telemetria-diaria').innerText()).includes('28'));
        assert(await page.locator('#tabela-telemetria-tecnico').count());
      }
      if (file === 'admin') {
        await page.locator('.menu a[href="#funcionarios"]').click();
        await page.locator('[data-editar-funcionario]').click();
        assert.equal(await page.locator('#funcionario-status').inputValue(), 'ativo');
      }
      assert.deepEqual(errors, []);
      console.log(`${file} ${width}px OK`); await page.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exit(1); });
