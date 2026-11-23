const { db } = require("../../api/database");
const { criarMensagemEvento } = require("./eventos");

async function processarFila({ config, servico, banco = db, maximo = 10, baseUrl, clock = Date.now }) {
  if (!Number.isInteger(maximo) || maximo < 1 || maximo > 50) throw new Error("O lote deve ter entre 1 e 50 mensagens.");
  // Valida o link antes de retirar qualquer mensagem da fila.
  criarMensagemEvento({ tipo: "conta_criada" }, "admin", baseUrl);
  await servico.verificarConexao();
  const totais = { enviado: 0, falhou: 0, incerto: 0, descartado: 0 };
  for (let i = 0; i < maximo; i++) {
    const [evento] = await banco(config, "rpc/email_reservar", "POST", {});
    if (!evento) break;
    async function finalizar(status, erro = null) {
      const ok = await banco(config, "rpc/email_finalizar", "POST", { p_id: evento.id, p_reserva: evento.reserva, p_status: status, p_erro: erro });
      if (ok !== true) throw new Error("A reserva da notificacao nao pode ser confirmada. Confira a fila antes de repetir.");
      totais[status]++;
    }
    if (!Number.isFinite(Date.parse(evento.criado_em)) || clock() - Date.parse(evento.criado_em) > 24 * 60 * 60 * 1000) {
      await finalizar("descartado", "EVENTO_ANTIGO"); continue;
    }
    const [usuario] = evento.usuario_id ? await banco(config, "usuario", "GET", undefined,
      `?id=eq.${encodeURIComponent(evento.usuario_id)}&organizacao_id=eq.${encodeURIComponent(evento.organizacao_id)}&select=id,email,status,perfil,organizacao_id&limit=1`) : [];
    if (!usuario || usuario.id !== evento.usuario_id || usuario.status !== "ativo" || usuario.organizacao_id !== evento.organizacao_id ||
      usuario.email?.trim().toLowerCase() !== evento.destinatario ||
      !["admin", "administrador", "engenheiro", "tecnico"].includes(usuario.perfil) ||
      (evento.tipo === "relatorio_enviado" && !["admin", "administrador", "engenheiro"].includes(usuario.perfil))) {
      await finalizar("descartado", "DESTINATARIO_ALTERADO"); continue;
    }
    let conteudo;
    try { conteudo = criarMensagemEvento(evento, usuario.perfil, baseUrl); }
    catch { await finalizar("falhou", "MODELO_INVALIDO"); continue; }
    let status = "enviado", codigo = null;
    try { await servico.enviarNotificacao({ ...conteudo, para: evento.destinatario, identificador: evento.id }); }
    catch (error) {
      codigo = ["EMAIL_AUTH", "EMAIL_RECIPIENT", "EMAIL_CONFIG", "EMAIL_DISABLED", "EMAIL_INPUT"].includes(error.codigo) ? error.codigo : "SMTP_RESULTADO_INCERTO";
      status = codigo === "SMTP_RESULTADO_INCERTO" ? "incerto" : "falhou";
    }
    // Falha aqui deixa a reserva expirar para incerto, sem repetir SMTP.
    await finalizar(status, codigo);
  }
  return totais;
}
module.exports = { processarFila };
