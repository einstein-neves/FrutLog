const crypto = require("node:crypto");
const QRCode = require("qrcode");
const { db } = require("./database");
const { passwordOk } = require("./password");
const { criarSegredo, criptografarSegredo, uri, criarCodigosRecuperacao, hashCodigoRecuperacao } = require("./totp");
const { validarEndereco } = require("../src/email");
const { monitorarEmail } = require("../src/email/monitor");
const { criarMensagemEvento } = require("../src/email/eventos");
const { paginacao } = require("./pagination");

const acoes = ["email", "sessoes", "recuperacao", "autenticador"];
const uuid = (value) => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
function credencialConta(u, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify([u.id, u.senha_hash, Number(u.sessao_versao || 0), u.email])).digest("hex");
}
const hashConfirmacao = (id, code, secret) => crypto.createHmac("sha256", secret).update(`conta:${id}:${code}`).digest("hex");

async function contaSeguranca({ req, res, c, user, route, origin, reply, parseBody, servico, versaoCredencialOtp }) {
  const adminRoute = route.startsWith("/admin/emails") || route === "/admin/auditoria";
  if (adminRoute) {
    if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Somente a Administracao pode consultar este painel." }, origin);
    const resend = route.match(/^\/admin\/emails\/([^/]+)\/reenviar$/);
    if (resend && req.method === "POST") {
      if (!uuid(resend[1])) return reply(res, 400, { mensagem: "Identificador invalido." }, origin);
      const registro = await db(c, "rpc/email_reservar_reenvio", "POST", { p_id: resend[1], p_org: user.organizacaoId });
      if (!registro) return reply(res, 409, { mensagem: "Reenvio indisponivel. Somente boas-vindas com falha confirmada podem ser reenviadas, apos um minuto." }, origin);
      const [destinatario] = await db(c, "usuario", "GET", undefined,
        `?id=eq.${encodeURIComponent(registro.usuario_id)}&organizacao_id=eq.${encodeURIComponent(user.organizacaoId)}&status=eq.ativo&select=id,email,perfil,matricula,organizacao_id&limit=1`);
      let status = "falhou";
      if (destinatario && validarEndereco(destinatario.email)) {
        try {
          const conteudo = criarMensagemEvento({ tipo: "conta_criada", dados: { matricula: destinatario.matricula } }, destinatario.perfil, process.env.EMAIL_APP_URL);
          await monitorarEmail({ config: c, usuario: destinatario, tipo: "boas_vindas", servico }).enviarNotificacao({ ...conteudo, para: destinatario.email });
          status = "reenviado";
        } catch { status = "incerto"; }
      }
      await db(c, `email_entrega?id=eq.${encodeURIComponent(registro.id)}&organizacao_id=eq.${encodeURIComponent(user.organizacaoId)}`, "PATCH", { status, atualizado_em: new Date().toISOString() });
      return reply(res, 200, { sucesso: status === "reenviado", mensagem: status === "reenviado" ? "Reenvio aceito pelo servidor de e-mail." : "Reenvio nao confirmado. Confira o registro antes de tentar novamente." }, origin);
    }
    if (req.method !== "GET" || !["/admin/emails", "/admin/auditoria"].includes(route)) return reply(res, 405, { mensagem: "Metodo nao permitido." }, origin);
    let page;
    try { page = paginacao(new URL(req.url, "http://localhost")); } catch (e) { return reply(res, 400, { mensagem: e.message }, origin); }
    const emails = route === "/admin/emails";
    const url = new URL(req.url, "http://localhost");
    const status = url.searchParams.get("status");
    if (status && !["pendente","aceito","falhou","incerto","reenviando","reenviado"].includes(status)) return reply(res, 400, { mensagem: "Status invalido." }, origin);
    const rows = await db(c, emails ? "email_entrega" : "auditoria_evento", "GET", undefined,
      `?organizacao_id=eq.${encodeURIComponent(user.organizacaoId)}&select=${emails ? "id,usuario_id,tipo,status,erro_codigo,criado_em,atualizado_em" : "id,ator_usuario_id,metodo,recurso,resultado,criado_em"}&order=criado_em.desc,id.desc&limit=${page.limite + 1}&offset=${page.offset}${emails && status ? `&status=eq.${status}` : ""}`);
    return reply(res, 200, { registros: rows.slice(0,page.limite), paginacao: { ...page, temProxima: rows.length > page.limite } }, origin);
  }

  const [u] = await db(c, "usuario", "GET", undefined,
    `?id=eq.${encodeURIComponent(user.sub)}&status=eq.ativo&select=id,matricula,email,email_verificado_em,perfil,organizacao_id,senha_hash,sessao_versao,totp_secret_ciphertext,totp_ativado_em&limit=1`);
  if (!u) return reply(res, 401, { mensagem: "Conta indisponivel." }, origin);
  if (route === "/conta/seguranca" && req.method === "GET") {
    const codes = await db(c, "usuario_codigo_recuperacao", "GET", undefined, `?usuario_id=eq.${encodeURIComponent(u.id)}&select=id&limit=10`);
    return reply(res, 200, { matricula: u.matricula, email: u.email || "", emailConfirmado: !!u.email_verificado_em,
      autenticadorAtivo: !!u.totp_secret_ciphertext, codigosRestantes: codes.length, sessaoVersao: Number(u.sessao_versao || 0) }, origin);
  }
  if (req.method !== "POST") return reply(res, 405, { mensagem: "Metodo nao permitido." }, origin);
  const d = await parseBody(req, 4096);
  if (route === "/conta/confirmacao/solicitar") {
    if (!acoes.includes(d.acao)) return reply(res, 400, { mensagem: "Acao invalida." }, origin);
    if (!(await passwordOk(d.senhaAtual, u.senha_hash))) return reply(res, 400, { mensagem: "Senha atual invalida." }, origin);
    if (!validarEndereco(u.email)) return reply(res, 400, { mensagem: "Solicite ao administrador o cadastro de um e-mail valido." }, origin);
    if (d.acao !== "email" && !u.email_verificado_em) return reply(res, 403, { mensagem: "Confirme seu e-mail primeiro." }, origin);
    if (d.acao === "recuperacao" && !u.totp_secret_ciphertext) return reply(res,400,{mensagem:"Configure o autenticador antes de gerar codigos de recuperacao."},origin);
    if (["recuperacao","autenticador"].includes(d.acao) && (!process.env.TOTP_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY.length<32)) return reply(res,503,{mensagem:"Configuracao do autenticador indisponivel."},origin);
    const id = crypto.randomUUID(), code = String(crypto.randomInt(0,1000000)).padStart(6,"0");
    const ok = await db(c, "rpc/conta_criar_desafio", "POST", { p_id: id, p_usuario: u.id, p_acao: d.acao,
      p_codigo: hashConfirmacao(id,code,c.jwt), p_credencial: credencialConta(u,c.jwt) });
    if (!ok) return reply(res, 429, { mensagem: "Aguarde um minuto antes de solicitar outra confirmacao." }, origin);
    try {
      await monitorarEmail({ config: c, usuario: u, tipo: "confirmacao_conta", servico }).enviarNotificacao({ para: u.email,
        titulo: "Confirme uma acao na sua conta FrutLog", categoria: "Seguranca",
        mensagem: `Codigo: ${code}. Valido por cinco minutos para a acao: ${({ email: "confirmar seu e-mail", sessoes: "encerrar todas as sessoes", recuperacao: "gerar novos codigos de recuperacao", autenticador: "configurar ou substituir autenticador" })[d.acao]}. Nao compartilhe. Se nao foi voce, altere sua senha.` });
    } catch {
      await db(c, `conta_desafio?id=eq.${id}&usuario_id=eq.${encodeURIComponent(u.id)}`, "DELETE");
      return reply(res, 503, { mensagem: "Nao foi possivel confirmar o envio. Tente novamente." }, origin);
    }
    return reply(res, 200, { desafio: id, expiraEm: new Date(Date.now()+300000).toISOString(), reenviarApos: 60, mensagem: `Codigo enviado para ${u.email[0]}***@${u.email.split("@")[1]}.` }, origin);
  }
  if (route !== "/conta/confirmacao/confirmar" || !uuid(d.desafio) || !/^\d{6}$/.test(d.codigo || "")) return reply(res, 400, { mensagem: "Informe o codigo de seis digitos." }, origin);
  const confirmacao = await db(c, "rpc/conta_consumir_desafio", "POST", { p_id: d.desafio, p_usuario: u.id,
    p_codigo: hashConfirmacao(d.desafio,d.codigo,c.jwt), p_credencial: credencialConta(u,c.jwt) });
  if (!confirmacao) return reply(res, 400, { mensagem: "Codigo incorreto, expirado ou ja utilizado. Apos cinco tentativas, solicite outro." }, origin);
  if (confirmacao.acao === "email") {
    const ok = await db(c, "rpc/conta_confirmar_email", "POST", { p_usuario: u.id,p_email: u.email,p_senha: u.senha_hash,p_versao: Number(u.sessao_versao || 0) });
    return reply(res, ok ? 200 : 409, { sucesso: ok, mensagem: ok ? "E-mail confirmado." : "A conta foi alterada. Solicite outra confirmacao." }, origin);
  }
  if (!u.email_verificado_em) return reply(res, 403, { mensagem: "Confirme o e-mail antes de continuar." }, origin);
  if (confirmacao.acao === "autenticador") {
    const id = crypto.randomUUID(), secret = criarSegredo();
    await db(c, "desafio_login_otp", "POST", { id,usuario_id:u.id,modo:u.totp_secret_ciphertext ? "reset" : "setup",codigo_hash:null,
      credencial_hash:versaoCredencialOtp(u,c.jwt),totp_secret_ciphertext:criptografarSegredo(secret,process.env.TOTP_ENCRYPTION_KEY),expira_em:new Date(Date.now()+300000).toISOString(),tentativas:0 });
    return reply(res,200,{ desafio:id,qrCode:await QRCode.toDataURL(uri(secret,u.matricula)),segredoManual:secret,mensagem:"Escaneie e confirme um codigo do novo autenticador. A confirmacao encerra as sessoes anteriores." },origin);
  }
  let ok;
  if (confirmacao.acao === "recuperacao") {
    const codes = criarCodigosRecuperacao();
    try {
      await monitorarEmail({ config:c,usuario:u,tipo:"codigos_recuperacao",servico }).enviarNotificacao({ para:u.email,titulo:"Novos codigos de recuperacao do FrutLog",categoria:"Seguranca",
        mensagem:`Guarde esta mensagem. Cada codigo funciona uma unica vez:\n\n${codes.join("\n")}\n\nUse somente os codigos da ultima renovacao confirmada. Nao compartilhe.` });
    } catch { return reply(res,503,{mensagem:"Envio nao confirmado. Os codigos anteriores foram preservados."},origin); }
    ok = await db(c,"rpc/conta_renovar_codigos","POST",{p_usuario:u.id,p_senha:u.senha_hash,p_versao:Number(u.sessao_versao||0),p_email:u.email,
      p_codigos:codes.map(code=>hashCodigoRecuperacao(u.id,code,process.env.TOTP_ENCRYPTION_KEY))});
  } else if (confirmacao.acao === "sessoes") {
    ok = await db(c,"rpc/conta_revogar_sessoes","POST",{p_usuario:u.id,p_versao:Number(u.sessao_versao||0)});
    if(ok) {
      try { await monitorarEmail({config:c,usuario:u,tipo:"seguranca",servico}).enviarNotificacao({para:u.email,titulo:"Sessoes encerradas no FrutLog",mensagem:"Todas as sessoes da sua conta foram encerradas apos uma confirmacao de identidade. Se nao foi voce, procure a Administracao.",categoria:"Seguranca"}); }
      catch { console.warn(JSON.stringify({evento:"AVISO_SEGURANCA_NAO_CONFIRMADO"})); }
    }
  }
  return reply(res,ok ? 200 : 409,{sucesso:!!ok,sair:!!ok,mensagem:ok ? "Acao concluida. Todas as sessoes foram encerradas. Entre novamente." : "A conta foi alterada. A acao nao foi concluida; desconsidere os codigos desta tentativa."},origin);
}
module.exports = { contaSeguranca, credencialConta, hashConfirmacao };
