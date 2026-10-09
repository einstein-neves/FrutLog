/* =========================================================
   FRUTLOG - AUTENTICACAO, API E SESSAO
   A seguranca real deve permanecer no backend.
   ========================================================= */

const FrutLog = (() => {
  const API_BASE_URL = `${window.location.origin}/api`;
  const CHAVE_SESSAO = "frutlog_sessao";
  const CHAVE_TOKEN = "frutlog_token";
  const CANAL_ATUALIZACOES_TALHOES = "frutlog:atualizacoes-talhoes";
  const canalAtualizacoesTalhoes = "BroadcastChannel" in window
    ? new BroadcastChannel(CANAL_ATUALIZACOES_TALHOES)
    : null;

  const AUTENTICACAO_API_ATIVA = true;
  const emitirAtualizacaoTalhoes = () => {
    window.dispatchEvent(new CustomEvent("frutlog:talhoes-atualizados"));
  };
  if (canalAtualizacoesTalhoes) {
    canalAtualizacoesTalhoes.addEventListener("message", emitirAtualizacaoTalhoes);
  } else {
    window.addEventListener("storage", (evento) => {
      if (evento.key === CANAL_ATUALIZACOES_TALHOES) emitirAtualizacaoTalhoes();
    });
  }
  [
    "frutlog_admin_funcionarios_demo",
    "frutlog_admin_sensores_demo",
  ].forEach((chave) => {
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  });

  const rotasPorPerfil = {
    engenheiro: "eng.html",
    tecnico: "tec.html",
    admin: "admin.html",
  };

  function obterSessao() {
    const sessaoSalva = sessionStorage.getItem(CHAVE_SESSAO);

    if (!sessaoSalva) {
      return null;
    }

    try {
      const sessao = JSON.parse(sessaoSalva);
      if (sessao.mustChangePassword && !window.location.pathname.endsWith("/senha-temporaria.html")) {
        window.location.replace("senha-temporaria.html");
        return null;
      }
      return sessao;
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
      mustChangePassword: Boolean(usuario.mustChangePassword),
    };

    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));

    if (token) {
      sessionStorage.setItem(CHAVE_TOKEN, token);
    } else {
      sessionStorage.removeItem(CHAVE_TOKEN);
    }

    return sessao;
  }

  function encerrarSessao() {
    sessionStorage.removeItem(CHAVE_SESSAO);
    sessionStorage.removeItem(CHAVE_TOKEN);
    window.location.replace("login.html");
  }

  function verificarSessao(perfisPermitidos = []) {
    const sessao = obterSessao();

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
    if (resposta.status !== 204) {
      const corpo = await resposta.text();
      try {
        dados = corpo ? JSON.parse(corpo) : null;
      } catch {
        const tipo = resposta.headers.get("content-type") || "desconhecido";
        throw new Error(
          `A API respondeu sem JSON (HTTP ${resposta.status}; ${tipo}). ` +
          "Abra o sistema pela URL do servidor FrutLog, nao pelo Live Server."
        );
      }
    }

    if (resposta.status === 401 && caminho !== "/login") {
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

  function configurarAbasSidebar() {
    const links = [...document.querySelectorAll(".menu .nav-link")];
    const paineis = links
      .map((link) => document.getElementById(link.hash.slice(1)))
      .filter(Boolean);
    if (!links.length || !paineis.length) return;

    function ativar(painelAtivo, atualizarHash = false) {
      paineis.forEach((painel) => {
        painel.hidden = painel !== painelAtivo;
      });
      links.forEach((link) => {
        const ativo = document.getElementById(link.hash.slice(1)) === painelAtivo;
        link.classList.toggle("active", ativo);
        if (ativo) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      if (atualizarHash) history.replaceState(null, "", `#${painelAtivo.id}`);
      window.dispatchEvent(new Event("resize"));
    }

    links.forEach((link) => {
      link.addEventListener("click", (evento) => {
        const painel = document.getElementById(link.hash.slice(1));
        if (!painel || !paineis.includes(painel)) return;
        evento.preventDefault();
        ativar(painel, true);
      });
    });

    const painelInicial = paineis.find((painel) => painel.id === window.location.hash.slice(1)) || paineis[0];
    ativar(painelInicial);
  }

  function notificarAtualizacaoTalhoes() {
    if (canalAtualizacoesTalhoes) {
      canalAtualizacoesTalhoes.postMessage({ atualizadoEm: Date.now() });
    } else {
      localStorage.setItem(CANAL_ATUALIZACOES_TALHOES, String(Date.now()));
    }
  }

  return {
    API_BASE_URL,
    AUTENTICACAO_API_ATIVA,
    obterSessao,
    salvarSessao,
    verificarSessao,
    redirecionarPorPerfil,
    apiFetch,
    configurarLogout,
    configurarAbasSidebar,
    encerrarSessao,
    notificarAtualizacaoTalhoes,
  };
})();
