const { test } = require("node:test");
const assert = require("node:assert/strict");
const { notificarContaCriada } = require("../../src/email/conta-criada");
const { DatabaseError } = require("../../api/database");
const usuario = { id: "u", organizacao_id: "org", email: "u@example.com", matricula: "T001", perfil: "tecnico", status: "ativo" };

function contexto({ semFila = false, reservado = true, confirmar = true } = {}) {
  const envios = [], consultas = [];
  let reserva;
  return { envios, consultas, args: {
    config: {}, usuario, servico: { async verificarConexao() {}, async enviarNotificacao(msg) { envios.push(msg); } },
    banco: async (config, recurso, metodo, dados) => {
      consultas.push({ recurso, metodo, dados });
      if (recurso.startsWith("email_fila?")) {
        if (semFila) throw new DatabaseError("Ausente", { resource: recurso, code: "PGRST205" });
        reserva = dados.reserva;
        return reservado ? [{ id: "00000000-0000-4000-8000-000000000001", ...usuario,
          usuario_id: usuario.id, destinatario: usuario.email, tipo: "conta_criada", dados: { matricula: usuario.matricula }, criado_em: new Date().toISOString(), reserva }] : [];
      }
      if (recurso === "usuario") return [usuario];
      if (recurso === "rpc/email_finalizar") { assert.equal(dados.p_reserva, reserva); return confirmar; }
      throw Error("Consulta inesperada");
    }
  } };
}

test("boas-vindas reserva apenas o evento da conta criada e confirma a reserva", async () => {
  const c = contexto();
  assert.equal((await notificarContaCriada(c.args)).status, "enviado");
  assert.equal(c.envios.length, 1);
  assert.match(c.consultas[0].recurso, /usuario_id=eq.u&organizacao_id=eq.org&tipo=eq.conta_criada&status=eq.pendente/);
  assert.ok(c.consultas.some((r) => r.recurso === "rpc/email_finalizar"));
  assert.equal(c.envios[0].para, usuario.email);
});

test("sem migracao opcional envia diretamente; evento ja reservado nao duplica email", async () => {
  const direto = contexto({ semFila: true });
  assert.equal((await notificarContaCriada(direto.args)).status, "enviado");
  assert.equal(direto.envios.length, 1);
  assert.ok(!direto.consultas.some((r) => r.recurso === "rpc/email_finalizar"));
  const reservado = contexto({ reservado: false });
  assert.equal((await notificarContaCriada(reservado.args)).status, "ja_processado");
  assert.equal(reservado.envios.length, 0);
});

test("falha de confirmacao ou de conexao nao faz envio direto duplicado", async () => {
  const c = contexto({ confirmar: false });
  assert.equal((await notificarContaCriada(c.args)).status, "nao_confirmado");
  assert.equal(c.envios.length, 1);
  const d = contexto();
  d.args.banco = async () => { throw new DatabaseError("Indisponivel", { resource: "email_fila" }); };
  assert.equal((await notificarContaCriada(d.args)).status, "nao_confirmado");
  assert.equal(d.envios.length, 0);
});

test("conta inativa nao recebe boas-vindas", async () => {
  const c = contexto();
  assert.equal((await notificarContaCriada({ ...c.args, usuario: { ...usuario, status: "inativo" } })).status, "descartado");
  assert.equal(c.envios.length, 0);
  assert.equal(c.consultas.length, 0);
});
