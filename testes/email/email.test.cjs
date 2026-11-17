const { test } = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const { criarServicoEmail, validarEndereco } = require("../../src/email");
const { criarNotificacao } = require("../../src/email/templates");
const { executar } = require("../../scripts/email");
const env = { EMAIL_ENABLED: "true", GMAIL_USER: "projeto@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop", EMAIL_FROM_NAME: "FrutLog" };
const notificacao = { para: "destino@example.com", titulo: "Aviso do FrutLog", mensagem: "Mensagem de teste" };

test("envio desativado e configuracao incompleta nao iniciam conexao", async () => {
  let chamadas = 0;
  for (const [config, codigo] of [
    [{}, "EMAIL_DISABLED"],
    [{ ...env, EMAIL_ENABLED: "talvez" }, "EMAIL_CONFIG"],
    [{ ...env, GMAIL_USER: "invalido" }, "EMAIL_CONFIG"],
    [{ ...env, GMAIL_APP_PASSWORD: "senha-normal" }, "EMAIL_CONFIG"],
    [{ ...env, EMAIL_FROM_NAME: "FrutLog\r\nBcc: alguem" }, "EMAIL_CONFIG"],
  ]) {
    const servico = criarServicoEmail({ env: config, criarTransporte() { chamadas++; } });
    await assert.rejects(servico.verificarConexao(), (e) => e.codigo === codigo);
  }
  assert.equal(chamadas, 0);
});

test("verificar usa Gmail com TLS validado, normaliza senha e nao envia mensagem", async () => {
  let opcoes, verificacoes = 0, envios = 0;
  const servico = criarServicoEmail({ env, criarTransporte(config) {
    opcoes = config;
    return { async verify() { verificacoes++; }, async sendMail() { envios++; }, close() {} };
  } });
  assert.deepEqual(await servico.verificarConexao(), { sucesso: true });
  assert.equal(opcoes.host, "smtp.gmail.com");
  assert.equal(opcoes.port, 465);
  assert.equal(opcoes.secure, true);
  assert.equal(opcoes.tls.rejectUnauthorized, true);
  assert.equal(opcoes.tls.minVersion, "TLSv1.2");
  assert.equal(opcoes.auth.pass, "abcdefghijklmnop");
  assert.equal(opcoes.disableFileAccess, true);
  assert.equal(opcoes.disableUrlAccess, true);
  assert.equal(opcoes.debug, false);
  assert.equal(verificacoes, 1);
  assert.equal(envios, 0);
  servico.fechar();
});

test("mensagem MIME real contem texto e HTML escapado com remetente fixo", async () => {
  const memoria = nodemailer.createTransport({ jsonTransport: true });
  let mensagem;
  const servico = criarServicoEmail({ env, criarTransporte() {
    return {
      async sendMail(dados) {
        const info = await memoria.sendMail(dados);
        mensagem = JSON.parse(info.message);
        return { ...info, accepted: [dados.to.address] };
      },
      close() { memoria.close(); },
    };
  } });
  const resultado = await servico.enviarNotificacao({ ...notificacao, mensagem: '<script>alert("x")</script>\nSegunda linha' });
  assert.equal(resultado.sucesso, true);
  assert.equal(mensagem.from.address, env.GMAIL_USER);
  assert.equal(mensagem.to[0].address, notificacao.para);
  assert.ok(mensagem.text.includes("Segunda linha"));
  assert.ok(mensagem.html.includes("&lt;script&gt;"));
  assert.ok(!mensagem.html.includes("<script>"));
  assert.ok(mensagem.html.includes("<br>Segunda linha"));
  assert.ok(mensagem.html.includes('src="cid:frutlog-logo"'));
  assert.equal(mensagem.attachments[0].cid, "frutlog-logo");
  assert.equal(mensagem.attachments[0].contentType, "image/jpeg");
  assert.ok(!JSON.stringify(mensagem).includes("abcdefghijklmnop"));
  servico.fechar();
});

test("recusa injecao de cabecalho, multiplos destinatarios e conteudo excessivo", async () => {
  const servico = criarServicoEmail({ env, criarTransporte() { throw Error("Nao deveria conectar"); } });
  for (const para of ["a@x.com\r\nBcc: b@x.com", "a@x.com,b@x.com", ["a@x.com"], "Nome <a@x.com>", "a..b@x.com"]) {
    assert.equal(validarEndereco(para), false);
    await assert.rejects(servico.enviarNotificacao({ ...notificacao, para }), (e) => e.codigo === "EMAIL_INPUT");
  }
  assert.throws(() => criarNotificacao({ titulo: "Aviso\r\nBcc: b@x.com", mensagem: "Texto" }));
  assert.throws(() => criarNotificacao({ titulo: "Aviso", mensagem: "a".repeat(20001) }));
});

test("falhas SMTP e rejeicao do destinatario nao expõem respostas ou senhas nem repetem envio", async () => {
  for (const [code, codigo] of [["EAUTH", "EMAIL_AUTH"], ["ETIMEDOUT", "EMAIL_UNAVAILABLE"], ["EENVELOPE", "EMAIL_RECIPIENT"]]) {
    let tentativas = 0;
    const servico = criarServicoEmail({ env, criarTransporte() {
      return { async sendMail() { tentativas++; throw Object.assign(new Error("SEGREDO-DO-SERVIDOR"), { code }); } };
    } });
    await assert.rejects(servico.enviarNotificacao(notificacao), (e) => e.codigo === codigo && !e.message.includes("SEGREDO"));
    assert.equal(tentativas, 1);
  }
  const servico = criarServicoEmail({ env, criarTransporte: () => ({ async sendMail() { return { accepted: [], rejected: [notificacao.para] }; } }) });
  await assert.rejects(servico.enviarNotificacao(notificacao), (e) => e.codigo === "EMAIL_RECIPIENT");
});

test("CLI verificar nao envia; CLI testar exige destinatario explicito", async () => {
  let verificacoes = 0, envios = 0, fechamentos = 0;
  const servico = {
    async verificarConexao() { verificacoes++; },
    async enviarNotificacao(dados) { envios++; assert.equal(dados.para, notificacao.para); },
    fechar() { fechamentos++; },
  };
  await executar(["verificar"], servico);
  assert.equal(envios, 0);
  await assert.rejects(executar(["testar"], servico));
  await executar(["testar", notificacao.para], servico);
  assert.equal(verificacoes, 1);
  assert.equal(envios, 1);
  assert.equal(fechamentos, 2);
});
