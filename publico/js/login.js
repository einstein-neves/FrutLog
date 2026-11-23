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
  let prazoOtp = null;
  let podeReenviarEm = 0;
  let timerOtp;
  const modoEmail = () => ["email", "verificar_email"].includes(modoOtp);
  function atualizarPrazo(dados) {
    if (typeof clearInterval === "function") clearInterval(timerOtp);
    prazoOtp = Date.parse(dados.expiraEm);
    if (!Number.isFinite(prazoOtp)) return;
    podeReenviarEm = Date.now() + (dados.reenviarApos || 60) * 1000;
    const prazo = document.getElementById("prazo-otp"), reenviar = document.getElementById("reenviar-otp");
    prazo.hidden = false; reenviar.hidden = !modoEmail();
    const render = () => {
      const restante = Math.max(0,Math.ceil((prazoOtp-Date.now())/1000));
      const espera = Math.max(0,Math.ceil((podeReenviarEm-Date.now())/1000));
      prazo.textContent = restante ? `${dados.destino ? `Destino: ${dados.destino}. ` : ""}Esta tentativa expira em ${Math.floor(restante/60)}:${String(restante%60).padStart(2,"0")}.` : "Tentativa expirada. Reinicie o login.";
      reenviar.disabled = espera > 0 || restante === 0;
      reenviar.textContent = espera ? `Reenviar em ${espera}s` : "Reenviar codigo";
    };
    render();
    if (typeof setInterval === "function") timerOtp = setInterval(render,1000);
  }

  function reiniciarTentativa() {
    if (typeof clearInterval === "function") clearInterval(timerOtp);
    document.getElementById("prazo-otp").hidden = true;
    document.getElementById("reenviar-otp").hidden = true;
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

  function apresentarDesafio(dados) {
    desafioOtp = dados.desafio;
    modoOtp = dados.modo || "login";
    usarRecuperacao = false;
    atualizarPrazo(dados);
    document.getElementById("escolha-2fa").hidden = true;
    document.getElementById("opcoes-recuperacao").hidden = true;
    campoOtp.value = "";
    campoOtp.maxLength = 6;
    campoOtp.pattern = "[0-9]{6}";
    campoOtp.inputMode = "numeric";
    campoOtp.placeholder = modoEmail() ? "Codigo de 6 digitos recebido por e-mail" : "Codigo de 6 digitos do autenticador";
    campoMatricula.readOnly = true;
    campoSenha.value = "";
    campoSenha.closest(".input-field").hidden = true;
    botaoMostrarSenha.disabled = true;
    campoOtp.disabled = false;
    campoOtp.required = true;
    caixaOtp.hidden = false;
    alternarRecuperacao.hidden = modoOtp !== "login";
    alternarRecuperacao.textContent = "Usar codigo de recuperacao";
    reiniciarLogin.hidden = false;
    caixaSetupTotp.hidden = !["setup", "reset"].includes(modoOtp);
    if (!caixaSetupTotp.hidden) {
      document.getElementById("totp-qr").src = dados.qrCode;
      document.getElementById("totp-segredo").textContent = dados.segredoManual;
    } else {
      document.getElementById("totp-qr").removeAttribute("src");
      document.getElementById("totp-segredo").textContent = "";
    }
    campoOtp.focus();
    exibirMensagem(dados.mensagem || "Informe o codigo do aplicativo autenticador.");
  }

  async function realizarLogin(matricula, senha) {
    try {
      const dados = await FrutLog.apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ matricula, senha, metodo2fa: document.getElementById("metodo-2fa").value || "autenticador" }),
      });

      if (dados?.otpRequerido && dados.desafio) {
        apresentarDesafio(dados);
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
    if (dados?.emailConfirmado && !dados.otpRequerido) {
      reiniciarTentativa();
      exibirMensagem(dados.mensagem, "sucesso");
      return;
    }
    if (dados?.sucesso && dados.otpRequerido && dados.desafio) {
      apresentarDesafio(dados);
      return;
    }
    if (!dados?.sucesso || !dados.usuario || !dados.token) throw new Error(dados?.mensagem || "Codigo invalido.");
    if (dados.recuperacaoEmailEnviado === true) {
      sessaoPendente = dados;
      if (typeof clearInterval === "function") clearInterval(timerOtp);
      document.getElementById("prazo-otp").hidden = true;
      document.getElementById("reenviar-otp").hidden = true;
      document.getElementById("reiniciar-login").hidden = true;
      caixaSetupTotp.hidden = true;
      document.getElementById("totp-qr").removeAttribute("src");
      document.getElementById("totp-segredo").textContent = "";
      caixaOtp.hidden = true;
      alternarRecuperacao.hidden = true;
      document.getElementById("opcoes-recuperacao").hidden = true;
      document.getElementById("mensagem-codigos-recuperacao").textContent = dados.mensagem;
      campoCodigos.hidden = false;
      campoOtp.required = false;
      formularioLogin.querySelector('[type="submit"]').hidden = true;
      document.getElementById("continuar-login").focus();
      exibirMensagem("Autenticador configurado. Confira os codigos de recuperacao no seu e-mail, inclusive no spam.");
      return;
    }
    finalizarLogin(dados);
  }

  function finalizarLogin(dados) {
    FrutLog.salvarSessao(dados.usuario, dados.token);
    if (dados.usuario.mustChangePassword) window.location.replace("senha-temporaria.html");
    else FrutLog.redirecionarPorPerfil(dados.usuario.perfil);
  }

  document.getElementById("reenviar-otp")?.addEventListener("click", async () => {
    const botao = document.getElementById("reenviar-otp");
    if (botao.disabled || !modoEmail()) return;
    botao.disabled = true;
    try {
      const dados = await FrutLog.apiFetch("/login/reenviar", { method:"POST", body:JSON.stringify({desafio:desafioOtp}) });
      desafioOtp = dados.desafio; campoOtp.value = "";
      atualizarPrazo(dados); exibirMensagem(dados.mensagem); campoOtp.focus();
    } catch (erro) {
      if (erro.codigo === "OTP_DESAFIO_ENCERRADO") reiniciarTentativa();
      else podeReenviarEm = Date.now() + 60000;
      exibirMensagem(erro.message,"erro");
    }
  });

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
          exibirMensagem(usarRecuperacao ? "Digite um codigo de recuperacao valido." : modoEmail() ? "Digite o codigo de 6 digitos recebido por e-mail." : "Digite o codigo de 6 digitos do autenticador.", "erro");
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

      if (senha.length < 8 || senha.length > 128) {
        exibirMensagem("A senha deve possuir entre 8 e 128 caracteres.", "erro");
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


