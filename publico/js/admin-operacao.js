document.addEventListener("DOMContentLoaded",()=>{
  if(!FrutLog.verificarSessao(["admin"]))return;
  document.getElementById("btn-logout").addEventListener("click",()=>FrutLog.encerrarSessao());
  const el=id=>document.getElementById(id),mensagem=text=>el("conta-mensagem").textContent=text;
  const paginas={emails:1,auditoria:1};
  async function carregar(tipo){
    const filtro=tipo==="emails"&&el("email-status").value ? `&status=${encodeURIComponent(el("email-status").value)}` : "";
    const dados=await FrutLog.apiFetch(`/admin/${tipo}?pagina=${paginas[tipo]}&limite=25${filtro}`);
    const lista=el(`${tipo}-lista`);lista.replaceChildren();
    for(const item of dados.registros){
      const linha=document.createElement("tr");
      const values=tipo==="emails" ? [item.criado_em,item.usuario_id,item.tipo,item.status] : [item.criado_em,item.ator_usuario_id,item.metodo,item.recurso,`${item.resultado} — ${item.resultado<400?"Concluído":"Recusado ou falhou"}`];
      values[0]=new Date(values[0]).toLocaleString("pt-BR");
      for(const [index,value] of values.entries()){
        const td=document.createElement("td");
        if((tipo==="emails"&&index===3)||(tipo==="auditoria"&&index===4)){
          const badge=document.createElement("span");badge.className="operacao-status";
          const positivo=tipo==="emails"?["aceito","reenviado"].includes(item.status):item.resultado<400;
          const erro=tipo==="emails"?item.status==="falhou":item.resultado>=400;
          badge.classList.add(positivo?"status-positivo":erro?"status-erro":"status-alerta");
          badge.textContent=tipo==="emails"?String(value).replace(/^./,s=>s.toUpperCase()):value;td.append(badge);
        }else td.textContent=value||"—";
        linha.append(td);
      }
      if(tipo==="emails"){
        const td=document.createElement("td");
        if(item.tipo==="boas_vindas"&&item.status==="falhou"){
          const botao=document.createElement("button");botao.className="btn-secundario";botao.type="button";botao.textContent="Reenviar boas-vindas";
          botao.addEventListener("click",async()=>{
            if(!window.confirm("Enviar novamente as boas-vindas ao e-mail atual desta conta?"))return;
            botao.disabled=true;
            try{const resposta=await FrutLog.apiFetch(`/admin/emails/${encodeURIComponent(item.id)}/reenviar`,{method:"POST",body:"{}"});mensagem(resposta.mensagem);await carregar(tipo);}
            catch(e){mensagem(e.message);botao.disabled=false;}
          });td.append(botao);
        } else td.textContent="—";
        linha.append(td);
      }
      lista.append(linha);
    }
    if(!dados.registros.length){const tr=document.createElement("tr"),td=document.createElement("td");td.className="estado-vazio";td.colSpan=5;td.textContent="Nenhum registro encontrado.";tr.append(td);lista.append(tr);}
    el(`${tipo}-pagina`).textContent=`Página ${paginas[tipo]}`;
    el(`${tipo}-anterior`).disabled=paginas[tipo]===1;el(`${tipo}-proxima`).disabled=!dados.paginacao.temProxima;
  }
  for(const tipo of ["emails","auditoria"]){
    for(const [acao,delta]of [["anterior",-1],["proxima",1],["atualizar",0]])el(`${tipo}-${acao}`).addEventListener("click",()=>{paginas[tipo]=Math.max(1,paginas[tipo]+delta);carregar(tipo).catch(e=>mensagem(e.message));});
    carregar(tipo).catch(e=>mensagem(e.message));
  }
  el("email-status").addEventListener("change",()=>{paginas.emails=1;carregar("emails").catch(e=>mensagem(e.message));});
});
