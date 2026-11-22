/* =========================================================
   FRUTLOG - LOGIN
   O frontend envia matricula e senha para a API.
   A autenticacao real deve ser feita pelo backend.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const campoMatricula = document.getElementById("matricula");
  const campoSenha = document.getElementById("senha");
  const botaoMostrarSenha = document.getElementById("togglePassword");
  const formularioLogin = document.getElementById("formularioLogin");
  const botaoLogin = formularioLogin.querySelector('[type="submit"]');
  const mensagemLogin = document.getElementById("mensagem-login");
  const campoOtp = document.getElementById("codigo-otp");
  const caixaOtp = document.getElementById("campo-otp");
  const caixaSetupTotp = document.getElementById("configurar-totp");
  const alternarRecuperacao = document.getElementById("alternar-recuperacao");
  const reiniciarLogin = document.getElementById("reiniciar-login");
  const campoCodigos = document.getElementById("codigos-recuperacao");
  let modoOtp = "login";
  let usarRecuperacao = false;
  let sessaoPendente = null;
  let desafioOtp = null;

  function reiniciarTentativa() {
    desafioOtp = null;
    modoOtp = "login";
    usarRecuperacao = false;
    sessaoPendente = null;
    campoMatricula.readOnly = false;
    campoSenha.value = "";
    campoSenha.closest(".input-field").hidden = false;
    botaoMostrarSenha.disabled = false;
    campoOtp.value = "";
    campoOtp.disabled = true;
    campoOtp.required = false;
    campoOtp.maxLength = 6;
    campoOtp.pattern = "[0-9]{6}";
    campoOtp.inputMode = "numeric";
    caixaOtp.hidden = true;
    caixaSetupTotp.hidden = true;
    campoCodigos.hidden = true;
    document.getElementById("totp-qr").removeAttribute("src");
    document.getElementById("totp-segredo").textContent = "";
    document.getElementById("opcoes-recuperacao").hidden = true;
    document.getElementById("escolha-2fa").hidden = false;
    document.getElementById("reiniciar-login").hidden = true;
    alternarRecuperacao.hidden = true;
    alternarRecuperacao.textContent = "Usar codigo de recuperacao";
    campoSenha.focus();
  }

  function exibirMensagem(texto, tipo = "") {
    if (mensagemLogin) {
      mensagemLogin.textContent = texto;
      mensagemLogin.className = `mensagem-feedback ${tipo}`.trim();
    }
    if (tipo === "erro") FrutLogFeedback.toast(texto, tipo);
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
    try {
      const dados = await FrutLog.apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ matricula, senha, metodo2fa: document.getElementById("metodo-2fa").value || "autenticador" }),
      });

      if (dados?.otpRequerido && dados.desafio) {
        desafioOtp = dados.desafio;
        modoOtp = dados.modo || "login";
        document.getElementById("escolha-2fa").hidden = true;
        document.getElementById("reiniciar-login").hidden = false;
        campoOtp.placeholder = modoOtp === "email" ? "Codigo de 6 digitos recebido por e-mail" : "Codigo de 6 digitos do autenticador";
        campoMatricula.readOnly = true;
        campoSenha.closest(".input-field").hidden = true;
        botaoMostrarSenha.disabled = true;
        campoOtp.disabled = false;
        campoOtp.required = true;
        caixaOtp.hidden = false;
        alternarRecuperacao.hidden = modoOtp !== "login";
        reiniciarLogin.hidden = false;
        if (modoOtp === "setup") {
          document.getElementById("totp-qr").src = dados.qrCode;
          document.getElementById("totp-segredo").textContent = dados.segredoManual;
          caixaSetupTotp.hidden = false;
        }
        campoOtp.focus();
        exibirMensagem(dados.mensagem || "Informe o codigo do aplicativo autenticador.");
        return;
      }

      if (!dados?.sucesso) {
        throw new Error(dados?.mensagem || "Matrícula ou senha inválida.");
      }

      if (!dados.usuario || !dados.usuario.perfil) {
        throw new Error("Resposta inválida do servidor.");
      }

      const perfisPermitidos = ["engenheiro", "tecnico", "admin"];

      if (!perfisPermitidos.includes(dados.usuario.perfil)) {
        throw new Error("Perfil de usuário não reconhecido.");
      }

      FrutLog.salvarSessao(dados.usuario, dados.token);
      if (dados.usuario.mustChangePassword) {
        window.location.replace("senha-temporaria.html");
      } else {
        FrutLog.redirecionarPorPerfil(dados.usuario.perfil);
      }
    } catch (erro) {
      campoSenha.value = "";
      exibirMensagem(erro.message, "erro");
    }
  }

  async function confirmarOtp() {
    const dados = await FrutLog.apiFetch("/login/otp", {
      method: "POST",
      body: JSON.stringify({
        desafio: desafioOtp, ...(usarRecuperacao
          ? { codigoRecuperacao: campoOtp.value.trim(), substituirAutenticador: document.getElementById("substituir-autenticador").checked }
          : { codigo: campoOtp.value.trim() })
      }),
    });
    if (dados?.sucesso && dados.otpRequerido && dados.modo === "reset" && dados.desafio) {
      desafioOtp = dados.desafio;
      modoOtp = "reset";
      usarRecuperacao = false;
      document.getElementById("opcoes-recuperacao").hidden = true;
      alternarRecuperacao.hidden = true;
      campoOtp.value = "";
      campoOtp.maxLength = 6;
      campoOtp.pattern = "[0-9]{6}";
      campoOtp.inputMode = "numeric";
      campoOtp.placeholder = "Codigo do novo autenticador";
      document.getElementById("totp-qr").src = dados.qrCode;
      document.getElementById("totp-segredo").textContent = dados.segredoManual;
      caixaSetupTotp.hidden = false;
      campoOtp.focus();
      exibirMensagem(dados.mensagem);
      return;
    }
    if (!dados?.sucesso || !dados.usuario || !dados.token) throw new Error(dados?.mensagem || "Codigo invalido.");
    if (Array.isArray(dados.codigosRecuperacao)) {
      sessaoPendente = dados;
      document.getElementById("reiniciar-login").hidden = true;
      caixaSetupTotp.hidden = true;
      document.getElementById("totp-qr").removeAttribute("src");
      document.getElementById("totp-segredo").textContent = "";
      caixaOtp.hidden = true;
      alternarRecuperacao.hidden = true;
      document.getElementById("opcoes-recuperacao").hidden = true;
      document.getElementById("lista-codigos-recuperacao").textContent = dados.codigosRecuperacao.join("\n");
      campoCodigos.hidden = false;
      campoOtp.required = false;
      formularioLogin.querySelector('[type="submit"]').hidden = true;
      document.getElementById("confirmar-codigos").focus();
      exibirMensagem("Autenticador configurado. Salve seus codigos de recuperacao antes de continuar.");
      return;
    }
    finalizarLogin(dados);
  }

  function finalizarLogin(dados) {
    FrutLog.salvarSessao(dados.usuario, dados.token);
    if (dados.usuario.mustChangePassword) window.location.replace("senha-temporaria.html");
    else FrutLog.redirecionarPorPerfil(dados.usuario.perfil);
  }

  alternarRecuperacao?.addEventListener("click", () => {
    if (modoOtp !== "login") return;
    usarRecuperacao = !usarRecuperacao;
    document.getElementById("opcoes-recuperacao").hidden = !usarRecuperacao;
    campoOtp.value = "";
    campoOtp.maxLength = usarRecuperacao ? 14 : 6;
    campoOtp.pattern = usarRecuperacao ? "[A-Za-z2-7-]{14}" : "[0-9]{6}";
    campoOtp.inputMode = usarRecuperacao ? "text" : "numeric";
    campoOtp.placeholder = usarRecuperacao ? "Codigo de recuperacao" : "Codigo de 6 digitos do autenticador";
    alternarRecuperacao.textContent = usarRecuperacao ? "Usar codigo do autenticador" : "Usar codigo de recuperacao";
    campoOtp.focus();
  });

  reiniciarLogin?.addEventListener("click", (evento) => {
    evento.preventDefault();
    reiniciarTentativa();
    botaoLogin.textContent = "Entrar";
    exibirMensagem("Informe sua matricula e senha para iniciar novamente.");
  });

  document.getElementById("confirmar-codigos")?.addEventListener("change", (evento) => {
    document.getElementById("continuar-login").disabled = !evento.target.checked;
  });
  document.getElementById("continuar-login")?.addEventListener("click", () => {
    if (sessaoPendente) finalizarLogin(sessaoPendente);
  });

  if (botaoMostrarSenha && campoSenha) {
    botaoMostrarSenha.addEventListener("click", alternarVisibilidadeSenha);
  }

  if (formularioLogin) {
    formularioLogin.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      if (desafioOtp) {
        if (usarRecuperacao ? !/^[A-Za-z2-7]{4}-?[A-Za-z2-7]{4}-?[A-Za-z2-7]{4}$/.test(campoOtp.value.trim()) : !/^\d{6}$/.test(campoOtp.value.trim())) {
          exibirMensagem(usarRecuperacao ? "Digite um codigo de recuperacao valido." : modoOtp === "email" ? "Digite o codigo de 6 digitos recebido por e-mail." : "Digite o codigo de 6 digitos do autenticador.", "erro");
          campoOtp.focus();
          return;
        }
        botaoLogin.disabled = true;
        botaoLogin.textContent = "Verificando...";
        try { await confirmarOtp(); }
        catch (erro) {
          campoOtp.value = "";
          if (erro.codigo === "OTP_DESAFIO_ENCERRADO") reiniciarTentativa();
          exibirMensagem(erro.message, "erro");
        }
        finally { botaoLogin.disabled = false; botaoLogin.textContent = desafioOtp ? "Verificar codigo" : "Entrar"; }
        return;
      }

      const matricula = campoMatricula.value.trim();
      const senha = campoSenha.value;

      if (!matricula) {
        exibirMensagem("Digite sua matrícula.", "erro");
        campoMatricula.focus();
        return;
      }

      if (!senha) {
        exibirMensagem("Digite sua senha.", "erro");
        campoSenha.focus();
        return;
      }

      if (senha.length < 8 || senha.length > 10) {
        exibirMensagem("A senha deve possuir entre 8 e 10 caracteres.", "erro");
        campoSenha.focus();
        return;
      }

      botaoLogin.disabled = true;
      botaoLogin.textContent = "Entrando...";
      exibirMensagem("Validando acesso...");

      await realizarLogin(matricula, senha);

      botaoLogin.disabled = false;
      botaoLogin.textContent = desafioOtp ? "Verificar codigo" : "Entrar";
    });
  }
});


