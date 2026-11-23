const { criarServicoEmail } = require("../src/email");

async function executar(args = process.argv.slice(2), servico = criarServicoEmail()) {
  const [comando, destinatario, ...extras] = args;
  if (extras.length || !["verificar", "testar"].includes(comando) ||
    (comando === "verificar" && destinatario) || (comando === "testar" && !destinatario)) {
    throw new Error("Use npm run email:verificar ou npm run email:teste -- destinatario@exemplo.com");
  }
  try {
    if (comando === "verificar") {
      await servico.verificarConexao();
      console.log("Conexao e autenticacao no Gmail verificadas. Nenhuma mensagem foi enviada.");
    } else {
      await servico.enviarNotificacao({
        para: destinatario,
        titulo: "FrutLog - Teste de envio de e-mail",
        mensagem: "A infraestrutura de e-mail do FrutLog esta funcionando.\n\nEsta mensagem foi solicitada pelo comando de teste do servidor.",
      });
      console.log("Mensagem de teste aceita pelo Gmail. Confira a caixa de entrada e o spam do destinatario.");
    }
  } finally { servico.fechar(); }
}

if (require.main === module) executar().catch((error) => {
  console.error(error.codigo ? `${error.codigo}: ${error.message}` : error.message);
  process.exitCode = 1;
});
module.exports = { executar };
