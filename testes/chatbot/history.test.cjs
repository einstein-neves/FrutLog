const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criarHistorico } = require("../../publico/js/chatbot-historico");
function storage() {
  const dados = new Map();
  return { getItem: (k) => dados.get(k), setItem: (k, v) => dados.set(k, v) };
}
test("historico persiste mensagens e links, isola usuarios e permite excluir", () => {
  const db = storage();
  const a = criarHistorico(db, "a:admin");
  a.registrar("conversa-1", "Como cadastrar sensor?", "pergunta");
  a.registrar("conversa-1", "Abra Sensores", "resposta", [{ href: "admin.html#sensores" }]);
  assert.equal(criarHistorico(db, "b:admin").listar().length, 0);
  const recarregado = criarHistorico(db, "a:admin");
  assert.equal(recarregado.listar()[0].mensagens.length, 2);
  assert.equal(recarregado.listar()[0].mensagens[1].links[0].href, "admin.html#sensores");
  recarregado.excluir("conversa-1");
  assert.equal(criarHistorico(db, "a:admin").listar().length, 0);
});
test("historico limita tamanho e coloca conversa retomada no topo", () => {
  const a = criarHistorico(storage(), "a");
  for (let i = 0; i < 35; i++) a.registrar(`c${i}`, "Pergunta", "pergunta");
  assert.equal(a.listar().length, 30);
  for (let i = 0; i < 110; i++) a.registrar("c5", `${i}`, "resposta");
  assert.equal(a.listar()[0].id, "c5");
  assert.equal(a.listar()[0].mensagens.length, 100);
});
test("dados corrompidos e armazenamento bloqueado nao interrompem conversa", () => {
  assert.deepEqual(criarHistorico({ getItem: () => "{invalido" }, "a").listar(), []);
  const a = criarHistorico({ getItem() { throw Error(); }, setItem() { throw Error(); } }, "a");
  assert.equal(a.registrar("c1", "Pergunta", "pergunta"), false);
  assert.equal(a.listar().length, 1);
});
