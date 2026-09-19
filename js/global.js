/* =========================================================
   FRUTLOG - CONFIGURACAO, API E SESSAO
   A seguranca real deve permanecer no backend.
   ========================================================= */

const FrutLog = (() => {
  const API_BASE_URL = "http://localhost:3000/api";
  const CHAVE_SESSAO = "frutlog_sessao";
  const CHAVE_TOKEN = "frutlog_token";

  // Altere para true quando o backend de autenticacao estiver disponivel.
  const AUTENTICACAO_API_ATIVA = false;

  const rotasPorPerfil = {
    engenheiro: "eng.html",
    tecnico: "tec.html",
    admin: "admin.html",
  };

  const nomesPorPerfil = {
    engenheiro: "Engenheiro de Demonstracao",
    tecnico: "Tecnico de Demonstracao",
    admin: "Administrador de Demonstracao",
  };

  function obterSessao() {
    const sessaoSalva = sessionStorage.getItem(CHAVE_SESSAO);

    if (!sessaoSalva) {
      return null;
    }

    try {
      return JSON.parse(sessaoSalva);
    } catch (erro) {
      console.error("Sessao invalida no navegador:", erro);
      sessionStorage.removeItem(CHAVE_SESSAO);
      sessionStorage.removeItem(CHAVE_TOKEN);
      return null;
    }
  }

  function salvarSessao(usuario, token) {
    const sessao = {
      id: usuario.id ?? null,
      matricula: usuario.matricula,
      nome: usuario.nome,
      perfil: usuario.perfil,
    };

    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));

    if (token) {
      sessionStorage.setItem(CHAVE_TOKEN, token);
    } else {
      sessionStorage.removeItem(CHAVE_TOKEN);
    }

    return sessao;
  }

  function criarSessaoDemonstracao(perfil = "engenheiro", matricula = "demo") {
    const perfilNormalizado = rotasPorPerfil[perfil] ? perfil : "engenheiro";

    return salvarSessao({
      id: 0,
      matricula,
      nome: nomesPorPerfil[perfilNormalizado],
      perfil: perfilNormalizado,
    });
  }

  function encerrarSessao() {
    sessionStorage.removeItem(CHAVE_SESSAO);
    sessionStorage.removeItem(CHAVE_TOKEN);
    window.location.replace("login.html");
  }

  function verificarSessao(perfisPermitidos = []) {
    let sessao = obterSessao();

    if (!sessao && !AUTENTICACAO_API_ATIVA) {
      sessao = criarSessaoDemonstracao(perfisPermitidos[0] || "engenheiro");
    }

    if (!sessao) {
      window.location.replace("login.html");
      return null;
    }

    if (perfisPermitidos.length > 0 && !perfisPermitidos.includes(sessao.perfil)) {
      alert("Seu perfil nao possui acesso a esta pagina.");
      redirecionarPorPerfil(sessao.perfil);
      return null;
    }

    return sessao;
  }

  function redirecionarPorPerfil(perfil) {
    window.location.replace(rotasPorPerfil[perfil] || "login.html");
  }

  async function apiFetch(caminho, opcoes = {}) {
    const token = sessionStorage.getItem(CHAVE_TOKEN);
    const headers = {
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    };

    if (AUTENTICACAO_API_ATIVA && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let resposta;

    try {
      resposta = await fetch(`${API_BASE_URL}${caminho}`, {
        ...opcoes,
        headers,
      });
    } catch (erro) {
      throw new Error("Servidor offline ou indisponivel.");
    }

    let dados = null;

    try {
      dados = await resposta.json();
    } catch (erro) {
      if (resposta.status !== 204) {
        throw new Error("Resposta JSON invalida recebida do servidor.");
      }
    }

    if (resposta.status === 401) {
      encerrarSessao();
      throw new Error("Sessao expirada. Faca login novamente.");
    }

    if (!resposta.ok) {
      throw new Error(dados?.mensagem || "Resposta HTTP invalida.");
    }

    return dados;
  }

  function configurarLogout() {
    const botaoLogout = document.getElementById("btn-logout");

    if (botaoLogout) {
      botaoLogout.addEventListener("click", encerrarSessao);
    }
  }

  return {
    API_BASE_URL,
    AUTENTICACAO_API_ATIVA,
    obterSessao,
    salvarSessao,
    criarSessaoDemonstracao,
    verificarSessao,
    redirecionarPorPerfil,
    apiFetch,
    configurarLogout,
    encerrarSessao,
  };
})();
