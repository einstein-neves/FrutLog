const {test}=require("node:test");
const assert=require("node:assert/strict");
const {monitorarEmail}=require("../../src/email/monitor");
function contexto(erro, falhaBanco){
  const registros=[],envios=[];
  return {registros,envios,servico:monitorarEmail({config:{},usuario:{id:"u",organizacao_id:"org"},tipo:"login",
    banco:async(c,table,method,dados)=>{registros.push({table,method,dados});if(falhaBanco)throw Error("offline");return [{id:"registro"}];},
    servico:{async verificarConexao(){if(erro)throw erro;},async enviarNotificacao(m){envios.push(m);if(erro)throw erro;return {sucesso:true};}}})};
}
test("registro de email guarda somente metadados e aceitacao SMTP",async()=>{
  const c=contexto();await c.servico.enviarNotificacao({para:"u@example.com",mensagem:"CODIGO-PRIVADO"});
  assert.equal(c.envios.length,1);assert.equal(c.registros.at(-1).dados.status,"aceito");
  assert.ok(!JSON.stringify(c.registros).includes("CODIGO-PRIVADO"));assert.ok(!JSON.stringify(c.registros).includes("u@example.com"));
});
test("falha definitiva e resultado incerto sao distinguidos sem guardar resposta SMTP",async()=>{
  for(const [codigo,status]of [["EMAIL_AUTH","falhou"],["ETIMEDOUT","incerto"]]){
    const c=contexto(Object.assign(Error("SEGREDO-SMTP"),{codigo}));
    await assert.rejects(c.servico.enviarNotificacao({mensagem:"CODIGO-PRIVADO"}));
    assert.equal(c.registros.at(-1).dados.status,status);assert.ok(!JSON.stringify(c.registros).includes("SEGREDO-SMTP"));
  }
});
test("erro de conexao antes do envio fica registrado como falha",async()=>{
  const c=contexto(Error("offline"));await assert.rejects(c.servico.verificarConexao());
  assert.equal(c.envios.length,0);assert.equal(c.registros[0].dados.status,"falhou");
});
test("sem registro inicial nao envia mensagem",async()=>{
  const c=contexto(null,true);await assert.rejects(c.servico.enviarNotificacao({mensagem:"codigo"}));assert.equal(c.envios.length,0);
});
