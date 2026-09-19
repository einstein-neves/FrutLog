/* =========================================================
   FRUTLOG - LOGIN
   O frontend envia matricula e senha para a API.
   A autenticacao real deve ser feita pelo backend.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const campoMatricula = document.getElementById("matricula");
  const campoSenha = document.getElementById("senha");
  const campoPerfilDemo = document.getElementById("perfil-demo");
  const areaPerfilDemo = document.getElementById("campo-perfil-demo");
  const botaoMostrarSenha = document.getElementById("togglePassword");
  const formularioLogin = document.getElementById("formularioLogin");
  const botaoLogin = document.querySelector(".btn-login");
  const mensagemLogin = document.getElementById("mensagem-login");

  if (areaPerfilDemo && FrutLog.AUTENTICACAO_API_ATIVA) {
    areaPerfilDemo.hidden = true;
  }

  function exibirMensagem(texto, tipo = "") {
    if (!mensagemLogin) {
      return;
    }

    mensagemLogin.textContent = texto;
    mensagemLogin.className = `mensagem-feedback ${tipo}`.trim();
  }

  function alternarVisibilidadeSenha() {
    const icone = botaoMostrarSenha?.querySelector("i");
    const senhaVisivel = campoSenha.type === "text";

    campoSenha.type = senhaVisivel ? "password" : "text";
    botaoMostrarSenha.setAttribute("aria-label", senhaVisivel ? "Mostrar senha" : "Ocultar senha");

    if (icone) {
      icone.classList.toggle("fa-eye", senhaVisivel);
      icone.classList.toggle("fa-eye-slash", !senhaVisivel);
    }
  }

  async function realizarLogin(matricula, senha) {
    if (!FrutLog.AUTENTICACAO_API_ATIVA) {
      const perfil = campoPerfilDemo?.value || "engenheiro";

      FrutLog.criarSessaoDemonstracao(perfil, matricula);
      FrutLog.redirecionarPorPerfil(perfil);
      return;
    }

    try {
      const dados = await FrutLog.apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ matricula, senha }),
      });

      if (!dados?.sucesso) {
        throw new Error(dados?.mensagem || "Matricula ou senha invalida.");
      }

      if (!dados.usuario || !dados.usuario.perfil) {
        throw new Error("Resposta invalida do servidor.");
      }

      const perfisPermitidos = ["engenheiro", "tecnico", "admin"];

      if (!perfisPermitidos.includes(dados.usuario.perfil)) {
        throw new Error("Perfil de usuario nao reconhecido.");
      }

      FrutLog.salvarSessao(dados.usuario, dados.token);
      FrutLog.redirecionarPorPerfil(dados.usuario.perfil);
    } catch (erro) {
      campoSenha.value = "";
      exibirMensagem(erro.message, "erro");
    }
  }

  if (botaoMostrarSenha && campoSenha) {
    botaoMostrarSenha.addEventListener("click", alternarVisibilidadeSenha);
  }

  if (formularioLogin) {
    formularioLogin.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const matricula = campoMatricula.value.trim();
      const senha = campoSenha.value;

      if (!matricula) {
        exibirMensagem("Digite sua matricula.", "erro");
        campoMatricula.focus();
        return;
      }

      if (!senha) {
        exibirMensagem("Digite sua senha.", "erro");
        campoSenha.focus();
        return;
      }

      if (senha.length < 8) {
        exibirMensagem("A senha deve possuir no minimo 8 caracteres.", "erro");
        campoSenha.focus();
        return;
      }

      botaoLogin.disabled = true;
      botaoLogin.textContent = "Entrando...";
      exibirMensagem("Validando acesso...");

      await realizarLogin(matricula, senha);

      botaoLogin.disabled = false;
      botaoLogin.textContent = "Entrar";
    });
  }
}); 






