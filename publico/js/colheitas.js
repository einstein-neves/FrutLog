document.addEventListener("DOMContentLoaded", async () => {
  const formularios = [...document.querySelectorAll("[data-form-colheita]")];
  if (!formularios.length) return;

  /**
   * Mostra o retorno de uma operação de colheita no próprio formulário e,
   * quando é resultado de ação, também como toast.
   * ATENÇÃO (DOM): a linha de mensagem é o elemento [data-mensagem-colheita]
   * dentro do formulário, não um id fixo — há um formulário por tela.
   * @param {HTMLFormElement} formulario - Formulário onde escrever.
   * @param {string} texto - Mensagem a exibir.
   * @param {string} [tipo=""] - "sucesso" | "erro" | "" (status em andamento).
   * @returns {void}
   */
  const exibirMensagem = (formulario, texto, tipo = "") => {
    const mensagem = formulario.querySelector("[data-mensagem-colheita]");
    if (mensagem) {
      mensagem.textContent = texto;
      mensagem.className = `mensagem-feedback ${tipo}`.trim();
    }
    if (tipo === "erro" || tipo === "sucesso") FrutLogFeedback.toast(texto, tipo);
  };

  const optionsTalhoes = async () => {
    const resposta = await FrutLog.apiFetch("/talhoes");
    return (resposta.talhoes || []).map((talhao) => {
      const codigo = String(talhao.codigo);
      const seguro = codigo.replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[caractere]);
      return `<option value="${seguro}">${seguro}</option>`;
    }).join("");
  };

  let opcoes;
  let ciclosAtivos = [];
  let falhaAoCarregarCiclos = null;
  try {
    const painel = await FrutLog.apiFetch("/painel-tecnico");
    ciclosAtivos = painel.plantios || [];
  } catch (erro) {
    falhaAoCarregarCiclos = erro;
    console.error("Não foi possível carregar os ciclos ativos para o formulário de colheita:", erro);
  }
  try {
    opcoes = await optionsTalhoes();
  } catch (erro) {
    formularios.forEach((formulario) => {
      formulario.elements.talhao.innerHTML = '<option value="">Falha ao carregar talhões</option>';
      exibirMensagem(formulario, erro.message, "erro");
    });
    return;
  }

  for (const formulario of formularios) {
    const selectTalhao = formulario.elements.talhao;
    selectTalhao.innerHTML = '<option value="">Selecione o talhão</option>' + opcoes;

    const resumoCiclo = formulario.querySelector("[data-resumo-ciclo] p");
    let cicloSelecionado = null;
    const atualizarResumoCiclo = () => {
      if (falhaAoCarregarCiclos && resumoCiclo) {
        resumoCiclo.textContent = `Não foi possível consultar o ciclo ativo (${falhaAoCarregarCiclos.message}). O servidor validará o talhão ao registrar a colheita.`;
        resumoCiclo.setAttribute("role", "status");
        return null;
      }
      cicloSelecionado = ciclosAtivos.find((item) => item.talhao === selectTalhao.value) || null;
      if (resumoCiclo) {
        resumoCiclo.textContent = cicloSelecionado
          ? `${[cicloSelecionado.produto, cicloSelecionado.variedade].filter(Boolean).join(" / ") || "Produto sem identificação"} · plantado em ${cicloSelecionado.plantado_em || "--"} · previsão de colheita ${cicloSelecionado.previsao_colheita || "--"}.`
          : selectTalhao.value
            ? "Não há ciclo ativo neste talhão."
            : "Selecione um talhão para consultar o ciclo ativo.";
      }
      return cicloSelecionado;
    };
    selectTalhao.addEventListener("change", atualizarResumoCiclo);
    atualizarResumoCiclo();

    /**
     * Registra uma colheita do talhão selecionado.
     * ATENÇÃO (API): POST /colheitas pode encerrar o ciclo automaticamente
     * quando a colheita fecha a safra; a resposta traz cicloEncerrado e, nesse
     * caso, avisamos as outras telas pelos eventos de atualização.
     * @param {SubmitEvent} evento - Envio do formulário de colheita.
     * @returns {Promise<void>}
     */
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      // Validação pré-envio: evita bater na API com campo obrigatório vazio.
      if (!FrutLogFeedback.validarObrigatorios(formulario)) return;
      const botao = formulario.querySelector('[type="submit"]');
      const liberarBotao = FrutLogFeedback.ocupar(botao, "Registrando...");
      try {
        const dados = Object.fromEntries(new FormData(formulario));
        const resposta = await FrutLog.apiFetch("/colheitas", {
          method: "POST",
          body: JSON.stringify(dados),
        });
        exibirMensagem(
          formulario,
          `Colheita registrada: ${resposta.colheita.quantidade} ${resposta.colheita.unidade} em ${resposta.colheita.ano}.${resposta.cicloEncerrado ? " Ciclo encerrado; a Engenharia ja pode cadastrar o proximo produto neste talhao." : ""}`,
          "sucesso"
        );
        formulario.reset();
        window.dispatchEvent(new CustomEvent("frutlog:colheitas-atualizadas"));
        if (resposta.cicloEncerrado) {
          FrutLog.notificarAtualizacaoTalhoes();
          window.dispatchEvent(new Event("frutlog:talhoes-atualizados"));
        }
      } catch (erro) {
        exibirMensagem(formulario, erro.message, "erro");
      } finally {
        liberarBotao();
      }
    });
  }
});
