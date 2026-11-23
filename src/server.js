const express = require("express");
const path = require("path");
const net = require("net");
const handler = require("../api/[...route]");

const app = express();
// Apenas IPs/CIDRs explicitamente configurados podem encaminhar o IP do cliente.
const proxies = (process.env.TRUSTED_PROXIES || "").split(",").map((v) => v.trim()).filter(Boolean);
for (const proxy of proxies) {
  const [endereco, prefixo, ...extra] = proxy.split("/");
  const familia = net.isIP(endereco);
  if (!familia || extra.length || (prefixo !== undefined &&
    (!/^\d+$/.test(prefixo) || Number(prefixo) < 1 || Number(prefixo) > (familia === 4 ? 32 : 128)))) {
    throw new Error("TRUSTED_PROXIES deve conter apenas IPs ou CIDRs explicitos de proxies confiaveis.");
  }
}
app.set("trust proxy", proxies.length ? proxies : false);
const port = Number(process.env.PORT || 3000);
const frontend = path.resolve(__dirname, "../publico"); //correwção de segurança o caminho antes era pasta raiz agora e a pasta espeificada do hmtl e css .
//item 12 da lista de icaro corrigido . 

// Todas as rotas da API passam pelo mesmo controle de origem, limite e sessao.
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
if (require.main === module) {
  app.listen(port, () => {
    console.log(`FrutLog em http://localhost:${port} (API: /api)`);
  });
}
module.exports = app;
