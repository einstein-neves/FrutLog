/* =========================================================
   FRUTLOG - FEEDBACK VISUAL COMPARTILHADO
   Toasts, estado de carregamento dos botoes e validacao de
   campos obrigatorios. Usado por todas as telas do sistema.
   ========================================================= */

const FrutLogFeedback = (() => {
  const DURACAO = { sucesso: 4000, info: 4000, aviso: 6000, erro: 8000 };
  const ICONES = {
    sucesso: "fa-circle-check",
    erro: "fa-circle-exclamation",
    aviso: "fa-triangle-exclamation",
    info: "fa-circle-info",
  };
  // Mensagens repetidas em sequencia (ex.: o mesmo erro de rede em varias
  // requisicoes) viram um toast so, para nao empilhar a tela inteira.
  const JANELA_REPETICAO = 2500;

  let container = null;
  let ultima = { texto: "", em: 0 };

  /**
   * Devolve o container dos toasts, criando-o no <body> se ainda nao existir.
   * ATENCAO (DOM): o elemento e anexado ao final do <body> e reaproveitado
   * entre chamadas; nenhuma pagina precisa declara-lo no HTML.
   * @returns {HTMLDivElement} Container onde os toasts sao inseridos.
   */
  function obterContainer() {
    if (container?.isConnected) return container;
    container = document.getElementById("frutlog-toasts");
    if (!container) {
      container = document.createElement("div");
      container.id = "frutlog-toasts";
      container.className = "frutlog-toasts";
      document.body.append(container);
    }
    return container;
  }

  /**
   * Converte o tipo informado para um dos quatro aceitos pelo CSS.
   * Aceita tambem os nomes em ingles usados por bibliotecas externas.
   * @param {string} tipo - "sucesso" | "erro" | "aviso" | "info" (ou success/error/warning).
   * @returns {string} Um de: "sucesso", "erro", "aviso", "info".
   */
  function normalizarTipo(tipo) {
    const valor = String(tipo || "info").toLowerCase();
    if (valor === "sucesso" || valor === "success") return "sucesso";
    if (valor === "erro" || valor === "error") return "erro";
    if (valor === "aviso" || valor === "warning" || valor === "alerta") return "aviso";
    return "info";
  }

  /**
   * Fecha um toast com animacao de saida e o remove do DOM.
   * Ignora toasts ja removidos ou em processo de fechamento.
   * @param {HTMLElement|null} toast - Elemento do toast a fechar.
   * @returns {void}
   */
  function fechar(toast) {
    if (!toast?.isConnected || toast.dataset.fechando) return;
    toast.dataset.fechando = "1";
    toast.classList.add("saindo");
    // Remove depois da animacao; o timer e a rede de seguranca se ela nao rodar.
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  }

  /**
   * Exibe um aviso flutuante no canto da tela. Substitui alert() e console.log
   * para dar retorno visual ao usuario.
   * @param {string} mensagem - Texto a exibir. Vazio ou nulo nao gera toast.
   * @param {string} [tipo="info"] - "sucesso" | "erro" | "aviso" | "info".
   * @returns {HTMLElement|null} O toast criado, ou null se foi ignorado por
   *   estar vazio ou repetir a mensagem anterior dentro da janela de repeticao.
   */
  function toast(mensagem, tipo = "info") {
    const texto = String(mensagem ?? "").trim();
    if (!texto) return null;
    const classe = normalizarTipo(tipo);

    const agora = Date.now();
    if (ultima.texto === texto && agora - ultima.em < JANELA_REPETICAO) return null;
    ultima = { texto, em: agora };

    const elemento = document.createElement("div");
    elemento.className = `frutlog-toast ${classe}`;
    // Erro interrompe a leitura de tela; os demais esperam uma pausa natural.
    elemento.setAttribute("role", classe === "erro" ? "alert" : "status");
    elemento.setAttribute("aria-live", classe === "erro" ? "assertive" : "polite");

    const icone = document.createElement("i");
    icone.className = `fa-solid ${ICONES[classe]}`;
    icone.setAttribute("aria-hidden", "true");

    const corpo = document.createElement("p");
    corpo.className = "frutlog-toast-texto";
    corpo.textContent = texto;

    const fecharBotao = document.createElement("button");
    fecharBotao.type = "button";
    fecharBotao.className = "frutlog-toast-fechar";
    fecharBotao.setAttribute("aria-label", "Fechar aviso");
    fecharBotao.innerHTML = "&times;";
    fecharBotao.addEventListener("click", () => fechar(elemento));

    elemento.append(icone, corpo, fecharBotao);
    obterContainer().append(elemento);

    // O contador pausa enquanto o ponteiro estiver sobre o toast, para dar
    // tempo de ler mensagens longas.
    let temporizador = setTimeout(() => fechar(elemento), DURACAO[classe]);
    elemento.addEventListener("pointerenter", () => clearTimeout(temporizador));
    elemento.addEventListener("pointerleave", () => {
      temporizador = setTimeout(() => fechar(elemento), DURACAO[classe]);
    });

    return elemento;
  }

  /* ---- Estado de carregamento ----
     Guarda o conteudo original do botao e devolve a funcao que o restaura.
     Chamar duas vezes no mesmo botao nao perde o texto original. */
  /**
   * Coloca o botao em estado de carregamento: desabilita, marca aria-busy e
   * troca o conteudo por um spinner mais o texto informado. Evita cliques
   * multiplos e requisicoes duplicadas.
   * ATENCAO (DOM): o conteudo original fica guardado em data-conteudo-original;
   * nao altere o innerHTML do botao enquanto ele estiver ocupado.
   * @param {HTMLButtonElement|null} botao - Botao a travar.
   * @param {string} [texto="Salvando..."] - Texto exibido durante a espera.
   * @returns {() => void} Funcao que devolve o botao ao estado anterior.
   */
  function ocupar(botao, texto = "Salvando...") {
    if (!botao) return () => {};
    if (botao.dataset.ocupado) return () => liberar(botao);

    botao.dataset.ocupado = "1";
    botao.dataset.conteudoOriginal = botao.innerHTML;
    botao.dataset.desabilitadoOriginal = botao.disabled ? "1" : "";
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.innerHTML = `<span class="frutlog-spinner" aria-hidden="true"></span>${escaparHtml(texto)}`;
    return () => liberar(botao);
  }

  /**
   * Restaura o botao travado por ocupar(): devolve o conteudo e o disabled
   * originais. Nao faz nada se o botao nunca foi ocupado.
   * @param {HTMLButtonElement|null} botao - Botao a liberar.
   * @returns {void}
   */
  function liberar(botao) {
    if (!botao?.dataset.ocupado) return;
    botao.innerHTML = botao.dataset.conteudoOriginal || "";
    botao.disabled = Boolean(botao.dataset.desabilitadoOriginal);
    botao.removeAttribute("aria-busy");
    delete botao.dataset.ocupado;
    delete botao.dataset.conteudoOriginal;
    delete botao.dataset.desabilitadoOriginal;
  }

  // Envolve uma acao assincrona: trava o botao, mostra o erro em toast e
  // destrava no final, aconteca o que acontecer.
  /**
   * Executa uma acao assincrona com o botao travado, mostra o erro em toast e
   * garante a liberacao do botao no final, mesmo em caso de falha.
   * ATENCAO (API): use este wrapper em volta de chamadas FrutLog.apiFetch para
   * nao precisar repetir try/catch/finally em cada handler.
   * @param {HTMLButtonElement|null} botao - Botao que dispara a acao.
   * @param {string} texto - Texto exibido durante o carregamento.
   * @param {() => Promise<any>} acao - Funcao assincrona a executar.
   * @returns {Promise<any>} O retorno da acao, ou undefined se ela falhou.
   */
  async function executar(botao, texto, acao) {
    const restaurar = ocupar(botao, texto);
    try {
      return await acao();
    } catch (erro) {
      toast(erro?.message || "Não foi possível concluir a operação.", "erro");
      return undefined;
    } finally {
      restaurar();
    }
  }

  /* ---- Validacao de campos obrigatorios ----
     Roda antes do fetch: marca o campo, foca o primeiro problema e avisa. */
  /**
   * Valida os campos obrigatorios de um formulario ANTES de disparar o fetch.
   * Considera obrigatorio todo input/select/textarea com [required] ou
   * [data-obrigatorio="true"] que esteja habilitado e visivel.
   * ATENCAO (DOM): campos invalidos recebem a classe .campo-invalido, que some
   * sozinha no primeiro input/change do usuario.
   * @param {HTMLElement|string} escopo - Formulario, container ou id do elemento.
   * @param {{mensagem?: string}} [opcoes] - mensagem: texto alternativo do toast.
   * @returns {boolean} true se tudo preenchido; false se faltou algo (ja avisou
   *   o usuario e focou o primeiro campo com problema).
   */
  function validarObrigatorios(escopo, opcoes = {}) {
    const raiz = typeof escopo === "string" ? document.getElementById(escopo) : escopo;
    if (!raiz) return true;

    const campos = [...raiz.querySelectorAll("input, select, textarea")]
      .filter((campo) => (campo.required || campo.dataset.obrigatorio === "true") && !campo.disabled && campo.type !== "hidden");

    const invalidos = campos.filter((campo) => !campoPreenchido(campo));
    campos.forEach((campo) => marcar(campo, invalidos.includes(campo)));

    if (!invalidos.length) return true;

    const primeiro = invalidos[0];
    primeiro.focus();
    toast(opcoes.mensagem || `Preencha o campo "${rotuloDoCampo(primeiro)}" antes de continuar.`, "aviso");
    return false;
  }

  /**
   * Diz se um campo foi preenchido de forma aceitavel.
   * Checkbox precisa estar marcado; texto nao pode ser so espaco; numero
   * precisa ser finito e respeitar os atributos min e max do HTML.
   * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} campo
   * @returns {boolean} true se o valor do campo e valido.
   */
  function campoPreenchido(campo) {
    if (campo.type === "checkbox") return campo.checked;
    const valor = String(campo.value ?? "").trim();
    if (!valor) return false;
    if (campo.type === "number") {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return false;
      if (campo.min !== "" && numero < Number(campo.min)) return false;
      if (campo.max !== "" && numero > Number(campo.max)) return false;
    }
    return true;
  }

  /**
   * Liga ou desliga a marcacao visual de campo invalido.
   * @param {HTMLElement} campo - Campo a marcar.
   * @param {boolean} invalido - true marca; false limpa a marcacao.
   * @returns {void}
   */
  function marcar(campo, invalido) {
    campo.classList.toggle("campo-invalido", invalido);
    if (invalido) {
      campo.setAttribute("aria-invalid", "true");
      // A marca some assim que o usuario comeca a corrigir o campo.
      campo.addEventListener("input", () => marcar(campo, false), { once: true });
      campo.addEventListener("change", () => marcar(campo, false), { once: true });
    } else {
      campo.removeAttribute("aria-invalid");
    }
  }

  /**
   * Descobre o nome amigavel do campo para citar na mensagem de erro.
   * Tenta, nesta ordem: <label> associado, aria-label, placeholder e name.
   * @param {HTMLElement} campo - Campo cujo rotulo se quer descobrir.
   * @returns {string} Rotulo legivel, ou "obrigatório" como ultimo recurso.
   */
  function rotuloDoCampo(campo) {
    const rotulo = campo.labels?.[0]?.textContent || campo.getAttribute("aria-label") || campo.placeholder || campo.name;
    return String(rotulo || "obrigatório").replace(/\s+/g, " ").trim();
  }

  /**
   * Escapa caracteres de HTML. Usado no texto do botao em carregamento, que e
   * inserido via innerHTML junto com o spinner.
   * @param {*} valor - Valor a escapar.
   * @returns {string} Texto seguro para interpolar em HTML.
   */
  // HILCCER ROCHA DE ARAUJO MELO ALTERACAO: renomeada de escapar para escaparHtml (mesmo nome usado no resto do projeto)
  function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[caractere]);
  }

  return { toast, ocupar, liberar, executar, validarObrigatorios };
})();

// Atalhos globais.
// ATENÇÃO (equipe): showToast() existe para uso direto e rápido; FrutLog.toast,
// FrutLog.ocupar etc. ficam disponíveis para quem já trabalha com o módulo de
// sessão. O typeof é necessário porque auth.js declara `const FrutLog` no topo
// do script: const de topo NÃO vira propriedade de window, então testar
// `window.FrutLog` daria sempre undefined.
// Este arquivo precisa ser carregado DEPOIS de auth.js e ANTES das telas.
window.showToast = FrutLogFeedback.toast;
if (typeof FrutLog !== "undefined") Object.assign(FrutLog, FrutLogFeedback);
