const { test } = require("node:test");
const assert = require("node:assert/strict");
const { processarFila } = require("../../src/email/worker");
const { criarMensagemEvento } = require("../../src/email/eventos");
const baseEvento = { id: "00000000-0000-4000-8000-000000000001", reserva: "reserva", usuario_id: "u", organizacao_id: "org", destinatario: "u@example.com", tipo: "relatorio_enviado", dados: {}, criado_em: new Date().toISOString() };
function contexto({ evento = baseEvento, usuario = { id: "u", organizacao_id: "org", email: "u@example.com", status: "ativo", perfil: "admin" }, falha, confirmar = true } = {}) {
  const registros = [], envios = [];
  let consumido = false;
  return { registros, envios, args: {
    config: {},
    servico: { async verificarConexao() {}, async enviarNotificacao(dados) { envios.push(dados); if (falha) throw falha; } },
    banco: async (_, table, method, dados) => {
      if (table === "rpc/email_reservar") { if (consumido) return []; consumido = true; return [evento]; }
      if (table === "usuario") return usuario ? [usuario] : [];
      if (table === "rpc/email_finalizar") { registros.push(dados); return confirmar; }
      throw Error("Consulta inesperada");
    },
  } };
}
test("worker envia uma vez e confirma somente a propria reserva", async () => {
  const c = contexto();
  const r = await processarFila(c.args);
  assert.equal(r.enviado, 1);
  assert.equal(c.envios.length, 1);
  assert.equal(c.registros[0].p_reserva, baseEvento.reserva);
  assert.equal(c.envios[0].identificador, baseEvento.id);
});
test("mudanca de organizacao, email, perfil ou bloqueio descarta aviso", async () => {
  for (const u of [null, { status: "inativo" }, { organizacao_id: "outra" }, { email: "novo@example.com" }, { perfil: "tecnico" }]) {
    const c = contexto({ usuario: u === null ? null : { organizacao_id: "org", email: "u@example.com", status: "ativo", perfil: "admin", ...u } });
    assert.equal((await processarFila(c.args)).descartado, 1);
    assert.equal(c.envios.length, 0);
  }
});
test("SMTP ambiguo e falha de confirmacao nao provocam repeticao automatica", async () => {
  const c = contexto({ falha: new Error("timeout") });
  assert.equal((await processarFila(c.args)).incerto, 1);
  assert.equal(c.envios.length, 1);
  const d = contexto({ confirmar: false });
  await assert.rejects(processarFila(d.args));
  assert.equal(d.envios.length, 1);
});
test("verificacao SMTP falha antes de retirar eventos; eventos antigos nao sao enviados", async () => {
  const c = contexto();
  c.args.servico.verificarConexao = async () => { throw Error("Auth"); };
  await assert.rejects(processarFila(c.args));
  assert.equal(c.envios.length, 0);
  assert.equal(c.registros.length, 0);
  const d = contexto({ evento: { ...baseEvento, criado_em: "2020-01-01" } });
  assert.equal((await processarFila(d.args)).descartado, 1);
});
test("modelos nao incluem senhas nem HTML de registros e links exigem HTTPS", () => {
  const { criarNotificacao } = require("../../src/email/templates");
  const msg = criarMensagemEvento({ tipo: "alerta_aberto", dados: { titulo: '<img src="x" onerror="alert(1)">', senha: "NAO-PUBLICAR" } }, "admin", "https://frutlog.example/");
  const template = criarNotificacao(msg);
  assert.ok(template.html.includes("&lt;img"));
  assert.ok(!template.html.includes("NAO-PUBLICAR"));
  assert.throws(() => criarMensagemEvento(baseEvento, "admin", "javascript:alert(1)"));
  assert.throws(() => criarNotificacao({ titulo: "Teste", mensagem: "Teste", acaoUrl: "http://frutlog.example" }));
});
