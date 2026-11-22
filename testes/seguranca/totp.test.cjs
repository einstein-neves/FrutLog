const { test } = require("node:test");
const assert = require("node:assert/strict");
const totp = require("../../api/totp");

test("TOTP segue vetor RFC 6238 para seis digitos e tolerancia de relogio", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // apenas segredo sintetico do vetor publico
  assert.equal(totp.codigoNoPasso(secret, 1), "287082"); // t=59, passo=30 s
  assert.equal(totp.verificarCodigo(secret, "287082", 59_000, -1), 1);
  assert.equal(totp.verificarCodigo(secret, "287082", 59_000, 1), null, "passo ja consumido nao pode ser reutilizado");
  assert.equal(totp.verificarCodigo(secret, "12x456", 59_000, -1), null);
});

test("segredo TOTP e cifrado com autenticacao e rejeita alteracao", () => {
  const secret = totp.criarSegredo();
  const ciphertext = totp.criptografarSegredo(secret, "chave-de-teste-com-mais-de-trinta-e-dois-caracteres");
  assert.notEqual(ciphertext, secret);
  assert.equal(totp.descriptografarSegredo(ciphertext, "chave-de-teste-com-mais-de-trinta-e-dois-caracteres"), secret);
  assert.throws(() => totp.descriptografarSegredo(ciphertext, "outra-chave-de-teste-com-mais-de-trinta-e-dois"));
});

test("codigos de recuperacao sao unicos e vinculados ao usuario", () => {
  const codes = totp.criarCodigosRecuperacao();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  const key = "chave-de-teste-nao-usada-em-producao";
  assert.match(totp.hashCodigoRecuperacao("usuario-a", codes[0], key), /^[a-f0-9]{64}$/);
  assert.notEqual(totp.hashCodigoRecuperacao("usuario-a", codes[0], key), totp.hashCodigoRecuperacao("usuario-b", codes[0], key));
  assert.equal(totp.hashCodigoRecuperacao("usuario-a", "nao-e-valido", key), null);
});
