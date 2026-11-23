const { criarServicoEmail } = require("../src/email");
const { processarFila } = require("../src/email/worker");

async function executar() {
  const config = {
    url: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.url || !config.key) throw new Error("Configure o Supabase do servidor antes de processar a fila.");
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--vigiar")) throw new Error("Use email:processar ou email:vigiar.");
  const servico = criarServicoEmail();
  let parar = false, timer, acordar;
  const encerrar = () => { parar = true; clearTimeout(timer); acordar?.(); };
  process.once("SIGINT", encerrar);
  process.once("SIGTERM", encerrar);
  try {
    do {
      try {
        const total = await processarFila({ config, servico, baseUrl: process.env.EMAIL_APP_URL });
        console.log("Fila de e-mail:", JSON.stringify(total));
      } catch (error) {
        console.error(error.codigo || "EMAIL_WORKER", "Falha ao processar e-mails. Confira a configuracao e a migracao 029; nenhuma mensagem sera repetida automaticamente.");
        if (!args.length) { process.exitCode = 1; break; }
      }
      if (args.length && !parar) await new Promise((resolve) => { acordar = resolve; timer = setTimeout(resolve, 30000); });
    } while (args.length && !parar);
  } finally {
    servico.fechar();
    process.removeListener("SIGINT", encerrar);
    process.removeListener("SIGTERM", encerrar);
  }
}
if (require.main === module) executar().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { executar };
