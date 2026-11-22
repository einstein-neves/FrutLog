const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

test("interface permite escolher email e entrar somente depois do codigo", async () => {
  const elements = new Map(), requests = [], saved = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", hidden: true, listeners: {}, focus() {},
      removeAttribute(name) { delete this[name]; },
      addEventListener(event, callback) { this.listeners[event] = callback; },
      closest() { return element(`${id}-parent`); }, querySelector() { return element("submit"); }
    });
    return elements.get(id);
  }
  const responses = [{ otpRequerido: true, modo: "email", desafio: "email-desafio", mensagem: "Enviamos um codigo." },
    Object.assign(new Error("Tentativa encerrada."), { codigo: "OTP_DESAFIO_ENCERRADO" }),
    { otpRequerido: true, modo: "email", desafio: "email-desafio-novo" },
    { sucesso: true, usuario: { perfil: "tecnico" }, token: "email-token" }];
  vm.runInNewContext(readFileSync(require.resolve("../../publico/js/login.js"), "utf8"), {
    document: { getElementById: element, addEventListener(event, callback) { callback(); } },
    window: { location: { replace() {} } }, FrutLogFeedback: { toast() {} },
    FrutLog: { async apiFetch(path, options) { requests.push(JSON.parse(options.body)); const response = responses.shift(); if (response instanceof Error) throw response; return response; },
      salvarSessao(...args) { saved.push(args); }, redirecionarPorPerfil() {} }
  });
  const submit = () => element("formularioLogin").listeners.submit({ preventDefault() {} });
  element("matricula").value = "T001";
  element("senha").value = "Senha1234";
  element("metodo-2fa").value = "email";
  await submit();
  assert.equal(requests[0].metodo2fa, "email");
  assert.match(element("codigo-otp").placeholder, /e-mail/);
  assert.equal(element("alternar-recuperacao").hidden, true);
  assert.equal(element("configurar-totp").hidden, true);
  assert.equal(element("reiniciar-login").hidden, false);
  assert.equal(saved.length, 0);
  element("codigo-otp").value = "123456";
  await submit();
  assert.equal(requests[1].desafio, "email-desafio");
  assert.equal(requests[1].codigo, "123456");
  assert.equal(element("campo-otp").hidden, true);
  assert.equal(element("codigo-otp").disabled, true);
  assert.equal(element("escolha-2fa").hidden, false);
  assert.equal(element("submit").textContent, "Entrar");
  assert.equal(element("senha").value, "");
  assert.equal(saved.length, 0);
  element("senha").value = "Senha1234";
  await submit();
  assert.equal(requests[2].senha, "Senha1234");
  element("codigo-otp").value = "654321";
  await submit();
  assert.equal(requests[3].desafio, "email-desafio-novo");
  assert.equal(saved[0][1], "email-token");
});

test("interface confirma recuperacao, solicita novo TOTP e guarda codigos antes de entrar", async () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", hidden: true, listeners: {},
      addEventListener(event, callback) { this.listeners[event] = callback; },
      focus() {}, closest() { return element(`${id}-parent`); },
      removeAttribute(name) { delete this[name]; },
      querySelector() { return element("submit"); }
    });
    return elements.get(id);
  }
  const requests = [], saved = [], redirects = [];
  const final = { sucesso: true, usuario: { perfil: "tecnico" }, token: "token-teste", codigosRecuperacao: ["ABCD-EFGH-IJKL"] };
  const responses = [
    { otpRequerido: true, modo: "login", desafio: "primeiro" },
    { sucesso: true, otpRequerido: true, modo: "reset", desafio: "segundo", qrCode: "novo-qr", segredoManual: "novo-segredo" },
    final
  ];
  const document = { getElementById: element, addEventListener(event, callback) { callback(); } };
  vm.runInNewContext(readFileSync(require.resolve("../../publico/js/login.js"), "utf8"), {
    document, window: { location: { replace() {} } }, FrutLogFeedback: { toast() {} },
    FrutLog: {
      async apiFetch(path, options) { requests.push({ path, body: JSON.parse(options.body) }); return responses.shift(); },
      salvarSessao(...args) { saved.push(args); }, redirecionarPorPerfil(perfil) { redirects.push(perfil); }
    }
  });
  const submit = () => element("formularioLogin").listeners.submit({ preventDefault() {} });
  element("matricula").value = "T001";
  element("senha").value = "Senha1234";
  await submit();
  element("alternar-recuperacao").listeners.click();
  assert.equal(element("opcoes-recuperacao").hidden, false);
  element("substituir-autenticador").checked = true;
  element("codigo-otp").value = "ABCD-EFGH-IJKL";
  await submit();
  assert.equal(requests[1].body.substituirAutenticador, true);
  assert.equal(element("totp-qr").src, "novo-qr");
  assert.equal(element("configurar-totp").hidden, false);
  assert.equal(element("opcoes-recuperacao").hidden, true);
  assert.equal(element("codigo-otp").maxLength, 6);
  assert.equal(saved.length, 0);
  element("codigo-otp").value = "123456";
  await submit();
  assert.equal(requests[2].body.desafio, "segundo");
  assert.equal(requests[2].body.codigo, "123456");
  assert.equal(requests[2].body.codigoRecuperacao, undefined);
  assert.equal(element("configurar-totp").hidden, true);
  assert.equal(element("totp-segredo").textContent, "");
  assert.equal(element("codigos-recuperacao").hidden, false);
  assert.equal(element("submit").hidden, true);
  assert.equal(saved.length, 0);
  element("confirmar-codigos").listeners.change({ target: { checked: true } });
  assert.equal(element("continuar-login").disabled, false);
  element("continuar-login").listeners.click();
  assert.equal(saved[0][1], "token-teste");
  assert.deepEqual(redirects, ["tecnico"]);
});
