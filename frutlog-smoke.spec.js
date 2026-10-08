const { test, expect } = require("playwright/test");

const paginas = [
  { arquivo: "login.html", titulo: "FrutLog - Login" },
  { arquivo: "eng.html", titulo: "FrutLog - Engenheiro Agronomo", perfil: "engenheiro" },
  { arquivo: "tec.html", titulo: "FrutLog - Tecnico Agricola", perfil: "tecnico" },
  { arquivo: "admin.html", titulo: "FrutLog - Administracao", perfil: "admin" },
];

for (const pagina of paginas) {
  test(`carrega ${pagina.arquivo}`, async ({ page }) => {
    const erros = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        erros.push(msg.text());
      }
    });

    page.on("pageerror", (erro) => erros.push(erro.message));

    if (pagina.perfil) {
      await page.addInitScript((perfil) => {
        sessionStorage.setItem("frutlog_sessao", JSON.stringify({
          id: 1,
          matricula: "teste",
          nome: "Teste",
          perfil,
        }));
      }, pagina.perfil);
    }

    await page.goto(`http://localhost:5500/${pagina.arquivo}`, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(pagina.titulo);
    expect(erros).toEqual([]);
  });
}
