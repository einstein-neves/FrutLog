const fs = require("node:fs");
const path = require("node:path");
const migrations = ["030_login_otp.sql","031_totp_idor.sql","032_recuperacao_autenticador.sql","033_login_2fa_email.sql","034_conta_seguranca_operacao.sql"];
async function executar({ local = false, env = process.env, fetcher = fetch } = {}) {
  for (const file of migrations) if (!fs.existsSync(path.join(__dirname,"../supabase",file))) throw Error(`Migracao ausente: ${file}`);
  if (local) return;
  const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!env.SUPABASE_URL||!key)throw Error("Configure a conexao do banco para conferir as migracoes aplicadas.");
  const r=await fetcher(`${env.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/`,{signal:AbortSignal.timeout(10000),headers:{apikey:key,...(key.startsWith("sb_secret_")?{}:{Authorization:`Bearer ${key}`})}});
  if(!r.ok)throw Error("Nao foi possivel conferir o esquema publicado.");
  const schema=await r.json(),missing=[];
  for(const rpc of ["configurar_autenticador_seguro","substituir_autenticador","conta_criar_desafio","conta_consumir_desafio","conta_confirmar_email","conta_revogar_sessoes","conta_renovar_codigos","login_reservar_reenvio","email_reservar_reenvio"])
    if(!schema.paths?.[`/rpc/${rpc}`])missing.push(rpc);
  for(const table of ["email_entrega","auditoria_evento","conta_desafio"])if(!schema.paths?.[`/${table}`])missing.push(table);
  const u=schema.definitions?.usuario?.properties||schema.components?.schemas?.usuario?.properties;
  for(const column of ["sessao_versao","email_verificado_em"])if(!u?.[column])missing.push(`usuario.${column}`);
  if(missing.length)throw Error(`Esquema pendente. Aplique as migracoes ate 034 e recarregue o PostgREST. Ausentes: ${missing.join(", ")}`);
}
if(require.main===module)executar({local:process.argv.includes("--local")}).then(()=>console.log("Migracoes conferidas."),e=>{console.error(e.message);process.exitCode=1;});
module.exports={executar};
