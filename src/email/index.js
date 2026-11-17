const nodemailer = require("nodemailer");
const fs = require("node:fs");
const path = require("node:path");
const { criarNotificacao } = require("./templates");

class EmailError extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = "EmailError";
    this.codigo = codigo;
  }
}

function validarEndereco(valor) {
  if (typeof valor !== "string" || valor.length > 254 || /[\s,;<>\r\n]/.test(valor)) return false;
  const partes = valor.split("@");
  return partes.length === 2 && partes[0].length > 0 && partes[0].length <= 64 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(partes[0]) &&
    !partes[0].startsWith(".") && !partes[0].endsWith(".") && !partes[0].includes("..") &&
    partes[1].includes(".") && partes[1].split(".").every((p) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(p));
}

function lerConfiguracao(env) {
  const habilitado = String(env.EMAIL_ENABLED || "false").trim().toLowerCase();
  if (!["true", "false"].includes(habilitado)) {
    throw new EmailError("EMAIL_CONFIG", "EMAIL_ENABLED deve ser true ou false.");
  }
  if (habilitado !== "true") throw new EmailError("EMAIL_DISABLED", "Envio de e-mail desativado. Configure EMAIL_ENABLED=true no servidor.");
  const usuario = String(env.GMAIL_USER || "").trim();
  const senha = String(env.GMAIL_APP_PASSWORD || "").replace(/[ \t]/g, "");
  const nome = String(env.EMAIL_FROM_NAME || "FrutLog").trim();
  if (!validarEndereco(usuario)) throw new EmailError("EMAIL_CONFIG", "Preencha GMAIL_USER com o endereco da conta do projeto.");
  if (!/^[a-z0-9]{16}$/i.test(senha)) throw new EmailError("EMAIL_CONFIG", "Preencha GMAIL_APP_PASSWORD com a senha de aplicativo de 16 caracteres do Google.");
  if (!nome || nome.length > 80 || /[\r\n\x00-\x1f\x7f]/.test(nome)) {
    throw new EmailError("EMAIL_CONFIG", "EMAIL_FROM_NAME deve ter entre 1 e 80 caracteres, sem quebras de linha.");
  }
  return { usuario, senha, nome };
}

function erroPublico(error) {
  if (error?.code === "EAUTH" || [534, 535].includes(error?.responseCode)) {
    return new EmailError("EMAIL_AUTH", "O Gmail recusou a autenticacao. Confira a conta e a senha de aplicativo no servidor.");
  }
  if (error?.code === "EENVELOPE") {
    return new EmailError("EMAIL_RECIPIENT", "O servidor de e-mail recusou o destinatario ou remetente.");
  }
  return new EmailError("EMAIL_UNAVAILABLE", "Nao foi possivel concluir a operacao de e-mail. Verifique a conexao SMTP e a disponibilidade do Gmail.");
}

function criarServicoEmail({ env = process.env, criarTransporte = nodemailer.createTransport } = {}) {
  let transporte, configuracao;
  function preparar() {
    if (!transporte) {
      configuracao = lerConfiguracao(env);
      try {
        transporte = criarTransporte({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: configuracao.usuario, pass: configuracao.senha },
          tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
          dnsTimeout: 10000,
          disableFileAccess: true,
          disableUrlAccess: true,
          logger: false,
          debug: false,
        });
      } catch (error) { throw erroPublico(error); }
    }
    return transporte;
  }
  return {
    async verificarConexao() {
      const smtp = preparar();
      try { await smtp.verify(); return { sucesso: true }; }
      catch (error) { throw erroPublico(error); }
    },
    async enviarNotificacao({ para, titulo, mensagem, categoria, nivel, detalhes, acaoUrl, identificador } = {}) {
      if (!validarEndereco(para)) throw new EmailError("EMAIL_INPUT", "Informe um unico endereco de e-mail valido para o destinatario.");
      const conteudo = criarNotificacao({ titulo, mensagem, categoria, nivel, detalhes, acaoUrl });
      const logo = fs.readFileSync(path.join(__dirname, "../../publico/imagem/icone-frutlog.jpg"));
      if (identificador !== undefined && !/^[a-f0-9-]{36}$/i.test(identificador)) throw new EmailError("EMAIL_INPUT", "Identificador de notificacao invalido.");
      const smtp = preparar();
      let resultado;
      try {
        resultado = await smtp.sendMail({
          from: { name: configuracao.nome, address: configuracao.usuario },
          to: { address: para },
          subject: titulo,
          text: conteudo.texto,
          html: conteudo.html,
          ...(identificador ? { messageId: `<${identificador}@frutlog.local>` } : {}),
          attachments: [{ filename: "frutlog.jpg", content: logo, cid: "frutlog-logo", contentType: "image/jpeg" }],
          disableFileAccess: true,
          disableUrlAccess: true,
        });
      } catch (error) { throw erroPublico(error); }
      if (!Array.isArray(resultado.accepted) || !resultado.accepted.some((item) => String(item).toLowerCase() === para.toLowerCase())) {
        throw new EmailError("EMAIL_RECIPIENT", "O servidor de e-mail nao confirmou a aceitacao do destinatario.");
      }
      // Aceitacao SMTP nao garante chegada na caixa de entrada.
      return { sucesso: true, messageId: resultado.messageId };
    },
    fechar() { transporte?.close(); transporte = undefined; },
  };
}

module.exports = { criarServicoEmail, EmailError, validarEndereco };
