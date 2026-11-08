const express = require("express");
const path = require("path");
const handler = require("../api/[...route]");
const relatorioRoutes = require("./routes/relatorio.routes"); // Importa as rotas de relatórios

const app = express();
const port = Number(process.env.PORT || 3000);
const frontend = path.resolve(__dirname, "../publico"); //correwção de segurança o caminho antes era pasta raiz agora e a pasta espeificada do hmtl e css .
//item 12 da lista de icaro corrigido . 

// 1. Rota modularizada de relatórios criada pelo aluno (Express Router / MVC)
// express.json() é aplicado especificamente a essa rota, evitando consumir o stream do handler de /api
app.use("/api/relatorios", express.json(), relatorioRoutes);

// 2. Demais rotas da API (mantém integração total com o backend existente em api/[...route].js)
app.use("/api", (req, res) => {
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  return handler(req, res);
});

// 3. Servir arquivos estáticos da pasta publico (CSS, JS, Imagens, HTMLs)
// - extensions: ["html"] permite acessar tanto /login quanto /login.html
// - setHeaders garante Content-Type text/css; charset=utf-8 para evitar bloqueio nosniff

app.use(express.static(frontend, {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    }
  }
}));

// 4. Redirecionamento da raiz para a página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(frontend, "index.html"));
});

// 5. Início do servidor
app.listen(port, () => {
  console.log(`FrutLog em http://localhost:${port} (API: /api)`);
});
