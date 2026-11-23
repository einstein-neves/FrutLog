document.addEventListener("DOMContentLoaded", () => {
  const sessao = FrutLog.verificarSessao(["admin","engenheiro","tecnico"]);
  if (!sessao) return;
  document.body.dataset.consoleRole = sessao.perfil;
  document.getElementById("link-operacao").hidden = sessao.perfil !== "admin";
  document.getElementById("btn-logout").addEventListener("click", () => FrutLog.encerrarSessao());
  const el = id => document.getElementById(id);
  const mensagem = texto => { el("conta-mensagem").textContent = texto; };
  let desafio, desafioTotp, deadline, reenviarEm=0;
  el("voltar-painel").addEventListener("click",e=>{e.preventDefault();FrutLog.redirecionarPorPerfil(sessao.perfil);});
  async function atualizar() {
    const dados = await FrutLog.apiFetch("/conta/seguranca");
    el("conta-resumo").replaceChildren();
    for (const [titulo, valor] of [["Matrícula",dados.matricula],["E-mail cadastrado",dados.email || "Não cadastrado"],
      ["Confirmação de e-mail",dados.emailConfirmado ? "Confirmado" : "Pendente"],
      ["Aplicativo autenticador",dados.autenticadorAtivo ? "Ativo" : "Não configurado"],["Códigos de recuperação disponíveis",dados.codigosRestantes]]) {
      const item=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");
      item.className="conta-resumo-item";dt.textContent=titulo;dd.textContent=valor;
      if(["Confirmado","Ativo"].includes(valor))dd.className="resumo-positivo";
      if(["Pendente","Não configurado"].includes(valor))dd.className="resumo-pendente";
      item.append(dt,dd);el("conta-resumo").append(item);
    }
  }
  function formulario(id,handler) {
    el(id).addEventListener("submit",async e=>{
      e.preventDefault(); const botao=e.currentTarget.querySelector('[type="submit"]');botao.disabled=true;
      try { await handler(); } catch(error) { mensagem(error.message); }
      finally { botao.disabled=false; }
    });
  }
  formulario("conta-solicitar",async()=>{
    if(Date.now()<reenviarEm)throw Error("Aguarde um minuto antes de pedir outra confirmação.");
    const dados=await FrutLog.apiFetch("/conta/confirmacao/solicitar",{method:"POST",body:JSON.stringify({acao:el("conta-acao").value,senhaAtual:el("conta-senha").value})});
    el("conta-senha").value="";desafio=dados.desafio;deadline=Date.parse(dados.expiraEm);reenviarEm=Date.now()+60000;
    el("conta-confirmar").hidden=false;mensagem(dados.mensagem);el("conta-codigo").focus();
  });
  formulario("conta-confirmar",async()=>{
    const dados=await FrutLog.apiFetch("/conta/confirmacao/confirmar",{method:"POST",body:JSON.stringify({desafio,codigo:el("conta-codigo").value.trim()})});
    el("conta-codigo").value="";el("conta-confirmar").hidden=true;desafio=null;mensagem(dados.mensagem);
    if(dados.sair){FrutLog.encerrarSessao();return;}
    if(dados.qrCode){desafioTotp=dados.desafio;el("conta-qr").src=dados.qrCode;el("conta-segredo").textContent=dados.segredoManual;el("conta-totp").hidden=false;}
    await atualizar();
  });
  formulario("conta-totp",async()=>{
    const dados=await FrutLog.apiFetch("/login/otp",{method:"POST",body:JSON.stringify({desafio:desafioTotp,codigo:el("conta-totp-codigo").value.trim()})});
    if(!dados.sucesso)throw Error("Não foi possível confirmar o autenticador.");
    el("conta-qr").removeAttribute("src");el("conta-segredo").textContent="";
    FrutLog.encerrarSessao();
  });
  formulario("conta-alterar-senha",async()=>{
    if(el("senha-nova").value!==el("senha-confirmar").value)throw Error("As novas senhas não coincidem.");
    const dados=await FrutLog.apiFetch("/alterar-senha",{method:"POST",body:JSON.stringify({senhaAtual:el("senha-atual").value,novaSenha:el("senha-nova").value})});
    FrutLog.salvarSessao(dados.usuario,dados.token);el("conta-alterar-senha").reset();mensagem("Senha alterada. As outras sessões foram encerradas.");
  });
  const timer=setInterval(()=>{
    const segundos=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    if(desafio)el("conta-prazo").textContent=segundos ? `Código válido por ${Math.floor(segundos/60)}:${String(segundos%60).padStart(2,"0")}.` : "Código expirado. Solicite outra confirmação.";
    const falta=Math.max(0,Math.ceil((reenviarEm-Date.now())/1000));
    const botao=el("conta-solicitar").querySelector('[type="submit"]');
    botao.textContent=falta ? `Solicitar novamente em ${falta}s` : "Enviar confirmação por e-mail";
  },1000);
  window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
  el("atualizar-conta").addEventListener("click",()=>atualizar().catch(e=>mensagem(e.message)));
  atualizar().catch(e=>mensagem(e.message));
});
