document.addEventListener("DOMContentLoaded", () => {
  const sessao = FrutLog.obterSessao();
  if (!sessao) {
    window.location.replace("login.html");
    return;
  }

  const formulario = document.getElementById("form-alterar-senha");
  const mensagem = document.getElementById("mensagem-alterar-senha");
  document.getElementById("btn-sair-senha-provisoria").addEventListener("click", FrutLog.encerrarSessao);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    if (
      typeof dados.senhaAtual !== "string" ||
      dados.senhaAtual.length < 8 ||
      dados.senhaAtual.length > 10
    ) {
      mensagem.textContent = "A senha atual deve possuir entre 8 e 10 caracteres.";
      mensagem.className = "mensagem-feedback erro";
      return;
    }
    if (dados.novaSenha.length < 8 || dados.novaSenha.length > 10) {
      mensagem.textContent = "A nova senha deve possuir entre 8 e 10 caracteres.";
      mensagem.className = "mensagem-feedback erro";
      return;
    }
    if (dados.novaSenha !== dados.confirmarSenha) {
      mensagem.textContent = "A confirmação da nova senha não corresponde.";
      mensagem.className = "mensagem-feedback erro";
      return;
    }

    const botao = formulario.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      const resposta = await FrutLog.apiFetch("/alterar-senha", {
        method: "POST",
        body: JSON.stringify({
          senhaAtual: dados.senhaAtual,
          novaSenha: dados.novaSenha,
        }),
      });
      FrutLog.salvarSessao(resposta.usuario, resposta.token);
      FrutLog.redirecionarPorPerfil(resposta.usuario.perfil);
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "mensagem-feedback erro";
    } finally {
      botao.disabled = false;
    }
  });
});
