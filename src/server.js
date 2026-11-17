const express = require("express");
const path = require("path");
const net = require("net");
const { validarSessao } = require("../api/session");
const handler = require("../api/[...route]");
const relatorioRoutes = require("./routes/relatorio.routes"); // Importa as rotas de relatórios

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

// 1. Rota modularizada de relatórios criada pelo aluno (Express Router / MVC)
// express.json() é aplicado especificamente a essa rota, evitando consumir o stream do handler de /api
app.use("/api/relatorios", async (req, res, next) => {
  const config = {
    jwt: process.env.JWT_SECRET,
    url: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.url || !config.key || !config.jwt || config.jwt.length < 32) {
    return res.status(503).json({ mensagem: "API ainda nao configurada." });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const usuario = await validarSessao(req, config);
    if (!usuario) return res.status(401).json({ mensagem: "Sessao expirada ou revogada. Faca login novamente." });
    if (usuario.mustChangePassword) return res.status(403).json({ mensagem: "Altere sua senha provisoria antes de continuar.", codigo: "SENHA_PROVISORIA" });
    return next();
  } catch {
    return res.status(503).json({ mensagem: "Nao foi possivel validar a sessao agora." });
  }
}, express.json(), relatorioRoutes);

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
if (require.main === module) {
  app.listen(port, () => {
    console.log(`FrutLog em http://localhost:${port} (API: /api)`);
  });
}
module.exports = app;
