const { db } = require("../../api/database");

function monitorarEmail({ config, usuario, tipo, servico, banco = db }) {
  return {
    async verificarConexao() {
      try { return await servico.verificarConexao(); }
      catch (error) {
        // Nenhuma mensagem foi enviada: falha de conexao pode ser reenviada com seguranca.
        await banco(config,"email_entrega","POST",{usuario_id:usuario.id,organizacao_id:usuario.organizacao_id,tipo,status:"falhou",erro_codigo:"SMTP_CONEXAO"});
        throw error;
      }
    },
    async enviarNotificacao(mensagem) {
      const [registro] = await banco(config, "email_entrega", "POST", {
        usuario_id: usuario.id, organizacao_id: usuario.organizacao_id, tipo, status: "pendente"
      });
      if (!registro?.id) throw Error("Registro do envio indisponivel.");
      let resultado;
      try {
        resultado = await servico.enviarNotificacao(mensagem);
      } catch (error) {
        const definitivo = ["EMAIL_AUTH", "EMAIL_RECIPIENT", "EMAIL_CONFIG", "EMAIL_DISABLED", "EMAIL_INPUT"].includes(error.codigo);
        await banco(config, `email_entrega?id=eq.${encodeURIComponent(registro.id)}`, "PATCH", {
          status: definitivo ? "falhou" : "incerto", erro_codigo: definitivo ? error.codigo : "SMTP_INCERTO", atualizado_em: new Date().toISOString()
        });
        throw error;
      }
      // SMTP pode aceitar e a confirmacao no banco falhar: nao repetir automaticamente.
      await banco(config, `email_entrega?id=eq.${encodeURIComponent(registro.id)}`, "PATCH", { status: "aceito", atualizado_em: new Date().toISOString() });
      return resultado;
    }
  };
}
module.exports = { monitorarEmail };
