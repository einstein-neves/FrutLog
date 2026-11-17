const fs = require("node:fs");
const path = require("node:path");
const { criarMensagemEvento } = require("../src/email/eventos");
const { criarNotificacao } = require("../src/email/templates");
const diretorio = path.join(__dirname, "../documentacao/previews-email");
fs.mkdirSync(diretorio, { recursive: true });
const logo = fs.readFileSync(path.join(__dirname, "../publico/imagem/icone-frutlog.jpg")).toString("base64");
const tipos = ["conta_criada", "email_cadastrado", "senha_redefinida", "senha_alterada", "relatorio_enviado", "relatorio_status", "alerta_aberto", "alerta_resolvido"];
for (const tipo of tipos) {
  const evento = { tipo, criado_em: "2026-11-17T13:30:00Z", dados: { ...(["relatorio_enviado", "relatorio_status"].includes(tipo) ? { data: "2026-11-17", status: "concluido" } : tipo.startsWith("alerta") ? { talhao: "T04", severidade: "alta", titulo: "Temperatura acima do limite cadastrado" } : { matricula: "F00042" }) } };
  const mensagem = criarMensagemEvento(evento, "admin", "https://frutlog.example/");
  const { html } = criarNotificacao(mensagem);
  fs.writeFileSync(path.join(diretorio, `${tipo}.html`), html.replace("cid:frutlog-logo", `data:image/jpeg;base64,${logo}`));
}
fs.writeFileSync(path.join(diretorio, "index.html"), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mails FrutLog</title><body style="font-family:Arial;background:#f2f5f1;color:#185c40;padding:32px"><h1>E-mails FrutLog</h1><p>Prévia com dados fictícios. Nenhuma mensagem é enviada.</p><ul>${tipos.map((tipo) => `<li style="padding:8px"><a href="${tipo}.html">${criarMensagemEvento({ tipo, dados: { status: "concluido" } }, "admin").titulo}</a></li>`).join("")}</ul></body></html>`);
console.log("Previas geradas em documentacao/previews-email/index.html. Nenhum e-mail enviado.");
