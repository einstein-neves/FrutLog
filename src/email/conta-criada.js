const crypto = require("node:crypto");
const { db, DatabaseError } = require("../../api/database");
const { criarMensagemEvento } = require("./eventos");
const { processarFila } = require("./worker");

// Reserva apenas a notificacao desta conta, sem enviar avisos de outros usuarios.
// Se a migracao opcional 029 nao existe, envia diretamente apos o cadastro.
async function notificarContaCriada({ config, usuario, servico, banco = db, baseUrl }) {
  if (usuario.status !== "ativo") return { status: "descartado" };
  try {
    let reservou = false;
    const totais = await processarFila({ config, servico, baseUrl, maximo: 1,
      banco: async (c, recurso, metodo, dados, query) => {
        if (recurso !== "rpc/email_reservar") return banco(c, recurso, metodo, dados, query);
        const eventos = await banco(c,
          `email_fila?usuario_id=eq.${encodeURIComponent(usuario.id)}&organizacao_id=eq.${encodeURIComponent(usuario.organizacao_id)}&tipo=eq.conta_criada&status=eq.pendente`,
          "PATCH", { status: "processando", reserva: crypto.randomUUID(), reservado_em: new Date().toISOString(), tentativas: 1 });
        reservou = eventos.length > 0;
        return eventos;
      }
    });
    if (!reservou) return { status: "ja_processado" };
    return { status: Object.keys(totais).find((status) => totais[status] > 0) || "incerto" };
  } catch (error) {
    if (!(error instanceof DatabaseError) || error.resource !== "email_fila" || !["PGRST205", "42P01"].includes(error.code)) {
      // Uma falha apos a reserva pode ocorrer depois da aceitacao SMTP: nao repetir.
      return { status: "nao_confirmado" };
    }
  }
  try {
    const conteudo = criarMensagemEvento({ tipo: "conta_criada", criado_em: new Date().toISOString(),
      dados: { matricula: usuario.matricula } }, usuario.perfil, baseUrl);
    await servico.enviarNotificacao({ ...conteudo, para: usuario.email });
    return { status: "enviado" };
  } catch {
    return { status: "nao_confirmado" };
  }
}

module.exports = { notificarContaCriada };
