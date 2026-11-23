function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function criarNotificacao({ titulo, mensagem, categoria = "Notificação do sistema", nivel = "informacao", detalhes = [], acaoUrl } = {}) {
  if (typeof titulo !== "string" || !titulo.trim() || titulo.length > 160 || /[\r\n\x00-\x1f\x7f]/.test(titulo)) throw new Error("O titulo do e-mail deve ter entre 1 e 160 caracteres, sem quebras de linha.");
  if (typeof mensagem !== "string" || !mensagem.trim() || mensagem.length > 20000 || mensagem.includes("\0")) throw new Error("A mensagem do e-mail deve ter entre 1 e 20.000 caracteres.");
  if (typeof categoria !== "string" || categoria.length > 80 || !Array.isArray(detalhes) || detalhes.length > 10 || detalhes.some((d) => !Array.isArray(d) || d.length !== 2 || d.some((v) => typeof v !== "string" || v.length > 500))) throw new Error("Detalhes do e-mail invalidos.");
  if (acaoUrl) { const url = new URL(acaoUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error("O link do e-mail deve usar HTTPS sem credenciais."); }
  const cores = { informacao: ["#185c40", "#e8f3eb"], atencao: ["#95621b", "#fff4dd"], critico: ["#a43434", "#fceaea"], sucesso: ["#185c40", "#e8f3eb"] };
  const [cor, fundo] = cores[nivel] || cores.informacao;
  const corpo = escaparHtml(mensagem).replace(/\r?\n/g, "<br>");
  const linhas = detalhes.map(([chave, valor]) => `<tr><td style="padding:11px 0;border-bottom:1px solid #e6ebe7;color:#6a786e;font-size:13px;width:40%">${escaparHtml(chave)}</td><td style="padding:11px 0;border-bottom:1px solid #e6ebe7;color:#253b2d;font-size:13px;font-weight:bold;word-break:break-word">${escaparHtml(valor)}</td></tr>`).join("");
  return {
    texto: `FrutLog | ${categoria}\n\n${titulo}\n\n${mensagem}\n\n${detalhes.map(([k, v]) => `${k}: ${v}`).join("\n")}${acaoUrl ? `\n\nAbrir FrutLog: ${acaoUrl}` : ""}\n\nMensagem automática do FrutLog. Nunca solicitamos sua senha por e-mail.`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escaparHtml(titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f2f5f1;font-family:Arial,Helvetica,sans-serif;color:#253b2d">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escaparHtml(mensagem.slice(0, 120))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;table-layout:fixed;margin:0 auto"><tr><td style="padding:10px 4px 20px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="48"><img src="cid:frutlog-logo" alt="Folha FrutLog" width="40" height="40" style="display:block;border:0;border-radius:12px"></td><td><span style="font-size:23px;font-weight:bold;letter-spacing:-0.6px;color:#185c40">FrutLog</span><br><span style="font-size:11px;color:#6a786e">Gestão agrícola conectada</span></td></tr></table></td></tr>
<tr><td style="background:#fff;border:1px solid #dfe7df;border-top:4px solid ${cor};border-radius:16px;overflow:hidden"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr><td style="padding:28px 24px 12px"><span style="display:inline-block;padding:6px 10px;border-radius:6px;background:${fundo};color:${cor};font-size:11px;font-weight:bold;letter-spacing:0.6px">${escaparHtml(categoria)}</span><h1 style="margin:20px 0 14px;font-size:25px;line-height:1.3;letter-spacing:-0.5px;color:#203b2b">${escaparHtml(titulo)}</h1><p style="margin:0;font-size:15px;line-height:1.75;color:#5c6b61;word-break:break-word">${corpo}</p></td></tr>
${linhas ? `<tr><td style="padding:8px 24px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${linhas}</table></td></tr>` : ""}
${acaoUrl ? `<tr><td style="padding:10px 24px 26px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#185c40" style="border-radius:9px"><a href="${escaparHtml(acaoUrl)}" style="display:inline-block;padding:14px 22px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">Abrir no FrutLog &rarr;</a></td></tr></table><p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#7a877e">Acesse com sua matrícula e senha. Os detalhes completos ficam no sistema.</p></td></tr>` : ""}
<tr><td style="padding:16px 24px;background:#f8faf7;border-top:1px solid #e8eee6;font-size:12px;line-height:1.6;color:#6a786e">Nunca solicitamos sua senha por e-mail. Se você não reconhece esta atividade, entre em contato com a Administração.</td></tr></table></td></tr>
<tr><td style="padding:22px 14px;text-align:center;font-size:11px;line-height:1.7;color:#819086">Mensagem automática do FrutLog.<br>Monitoramento do campo. Informação para agir.</td></tr></table></body></html>`,
  };
}
module.exports = { criarNotificacao };
