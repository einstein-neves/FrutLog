document.addEventListener("DOMContentLoaded", async () => {
  const formularios = [...document.querySelectorAll("[data-form-colheita]")];
  if (!formularios.length) return;

  const exibirMensagem = (formulario, texto, tipo = "") => {
    const mensagem = formulario.querySelector("[data-mensagem-colheita]");
    if (mensagem) {
      mensagem.textContent = texto;
      mensagem.className = `mensagem-feedback ${tipo}`.trim();
    }
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
  try {
    const painel = await FrutLog.apiFetch("/painel-tecnico");
    ciclosAtivos = painel.plantios || [];
  } catch (erro) {
    // O formulario de colheita continua disponivel mesmo se o resumo nao carregar.
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

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const botao = formulario.querySelector('[type="submit"]');
      botao.disabled = true;
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
        botao.disabled = false;
      }
    });
  }
});
