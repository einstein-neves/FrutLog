document.addEventListener("DOMContentLoaded", () => {
  const tabela = document.getElementById("tabela-relatorios");
  if (!tabela) return;

  const relatorios = [];
  const relatoriosSelecionados = new Set();
  const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);

  function formatarData(valor) {
    const correspondencia = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return correspondencia ? `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}` : "--";
  }

  function formatarMesAno(valor) {
    const correspondencia = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!correspondencia) return "Data não informada";
    const data = new Date(Number(correspondencia[1]), Number(correspondencia[2]) - 1, Number(correspondencia[3]));
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(data);
  }

  function garantirModal() {
    let modal = document.getElementById("modal-leitura-relatorio");
    if (modal) return modal;

    // O modal compartilhado é criado aqui para manter o mesmo leitor no Admin e na Engenharia.
    modal = document.createElement("dialog");
    modal.id = "modal-leitura-relatorio";
    modal.className = "modal-leitura-relatorio";
    modal.setAttribute("aria-labelledby", "modal-leitura-titulo");
    modal.innerHTML = `
      <div class="modal-leitura-cabecalho">
        <div>
          <p class="modal-leitura-sobretitulo">Relatório de campo</p>
          <h2 id="modal-leitura-titulo">Leitura do relatório</h2>
        </div>
        <button type="button" class="modal-leitura-fechar" data-fechar-relatorio aria-label="Fechar relatório">&times;</button>
      </div>
      <dl class="modal-leitura-metadados">
        <div><dt>Técnico</dt><dd data-relatorio-tecnico></dd></div>
        <div><dt>Matrícula</dt><dd data-relatorio-matricula></dd></div>
        <div><dt>Data do relatório</dt><dd data-relatorio-data></dd></div>
      </dl>
      <section class="modal-leitura-corpo" aria-label="Conteúdo do relatório">
        <h3>Relato</h3>
        <div class="modal-leitura-texto" data-relatorio-conteudo></div>
      </section>
      `;
    document.body.append(modal);

    // Reutiliza o mesmo botão para fechar e também permite fechar ao clicar fora do painel.
    modal.addEventListener("click", (evento) => {
      if (evento.target.closest("[data-fechar-relatorio]")) modal.close();
      if (evento.target === modal) modal.close();
    });
    return modal;
  }

  function abrirRelatorio(id) {
    const relatorio = relatorios.find((item) => String(item.id) === String(id));
    if (!relatorio) return;
    const modal = garantirModal();
    modal.querySelector("[data-relatorio-tecnico]").textContent = relatorio.tecnico_nome || "Técnico não identificado";
    modal.querySelector("[data-relatorio-matricula]").textContent = relatorio.tecnico_matricula || "Não informada";
    modal.querySelector("[data-relatorio-data]").textContent = formatarMesAno(relatorio.data_relatorio);
    // textContent mantém o relatório como texto, mesmo se contiver caracteres HTML.
    modal.querySelector("[data-relatorio-conteudo]").textContent = relatorio.conteudo || "Sem detalhes.";
    if (!modal.open) modal.showModal();
  }

  function atualizarLista() {
    const texto = document.getElementById("filtro-relatorio-texto")?.value.trim().toLocaleLowerCase("pt-BR") || "";
    const data = document.getElementById("filtro-relatorio-data")?.value || "";
    const status = document.getElementById("filtro-relatorio-status")?.value || "todos";
    const visibilidade = document.getElementById("filtro-visibilidade-relatorios")?.value || "ativos";
    const encontrados = relatorios.filter((relatorio) => {
      const contemTexto = `${relatorio.tecnico_nome} ${relatorio.tecnico_matricula} ${relatorio.conteudo}`.toLocaleLowerCase("pt-BR").includes(texto);
      const visibilidadeCorresponde = visibilidade === "todos"
        || (visibilidade === "arquivados" ? Boolean(relatorio.arquivado_em) : !relatorio.arquivado_em);
      return contemTexto && visibilidadeCorresponde && (!data || relatorio.data_relatorio === data) && (status === "todos" || relatorio.status === status);
    });

    const idsVisiveis = new Set(encontrados.map((item) => String(item.id)));
    relatoriosSelecionados.forEach((id) => { if (!idsVisiveis.has(id)) relatoriosSelecionados.delete(id); });

    if (!encontrados.length) {
      tabela.innerHTML = '<tr><td colspan="7">Nenhum relatório correspondente.</td></tr>';
      atualizarControlesSelecao(encontrados);
      return;
    }

    tabela.innerHTML = encontrados.map((relatorio) => {
      const statusVisivel = {
        enviado: "Enviado",
        em_analise: "Em análise",
        concluido: "Concluído",
      }[relatorio.status] || relatorio.status;
      const resumo = String(relatorio.conteudo || "Sem detalhes.").replace(/\s+/g, " ").trim();
      const trecho = resumo.length > 110 ? `${resumo.slice(0, 110)}…` : resumo;
      return `
        <tr>
          <td><input type="checkbox" data-selecionar-relatorio="${escapar(relatorio.id)}" aria-label="Selecionar relatório de ${escapar(relatorio.tecnico_nome)}" ${relatoriosSelecionados.has(String(relatorio.id)) ? "checked" : ""}></td>
          <td>${escapar(formatarData(relatorio.data_relatorio))}</td>
          <td><strong>${escapar(relatorio.tecnico_nome || "Técnico não identificado")}</strong><br><small>Matrícula ${escapar(relatorio.tecnico_matricula || "não informada")}</small></td>
          <td class="conteudo-relatorio"><span>${escapar(trecho)}</span><br><button class="btn-abrir-relatorio" type="button" data-abrir-relatorio="${escapar(relatorio.id)}">Abrir relatório</button></td>
          <td><span class="badge-status ${relatorio.status === "concluido" ? "normal" : "atencao"}">${escapar(statusVisivel)}</span></td>
          <td>
            <div class="acoes-relatorio">
              <select class="campo-formulario" data-status-relatorio="${escapar(relatorio.id)}" aria-label="Novo status do relatório de ${escapar(relatorio.tecnico_nome)}">
                <option value="em_analise" ${relatorio.status === "em_analise" ? "selected" : ""}>Em análise</option>
                <option value="concluido" ${relatorio.status === "concluido" ? "selected" : ""}>Concluído</option>
              </select>
              <button class="btn-filtro" type="button" data-salvar-relatorio="${escapar(relatorio.id)}">Atualizar</button>
            </div>
          </td>
          <td><button class="btn-excluir-relatorio" type="button" data-excluir-relatorio="${escapar(relatorio.id)}" aria-label="Excluir relatório de ${escapar(relatorio.tecnico_nome)}">Excluir</button></td>
        </tr>`;
    }).join("");
    atualizarControlesSelecao(encontrados);
  }

  function atualizarControlesSelecao(encontrados) {
    const seletorTodos = document.getElementById("selecionar-todos-relatorios");
    const visiveisSelecionados = encontrados.filter((item) => relatoriosSelecionados.has(String(item.id)));
    if (seletorTodos) {
      seletorTodos.checked = encontrados.length > 0 && visiveisSelecionados.length === encontrados.length;
      seletorTodos.indeterminate = visiveisSelecionados.length > 0 && visiveisSelecionados.length < encontrados.length;
    }
    const quantidadeArquivavel = visiveisSelecionados.filter((item) => !item.arquivado_em).length;
    const quantidadeRestauravel = visiveisSelecionados.filter((item) => item.arquivado_em).length;
    const botaoArquivar = document.querySelector("[data-arquivar-selecionados]");
    const botaoRestaurar = document.querySelector("[data-restaurar-selecionados]");
    const botaoExcluir = document.querySelector("[data-excluir-selecionados]");
    if (botaoArquivar) botaoArquivar.disabled = quantidadeArquivavel === 0;
    if (botaoRestaurar) botaoRestaurar.disabled = quantidadeRestauravel === 0;
    if (botaoExcluir) botaoExcluir.disabled = visiveisSelecionados.length === 0;
  }

  // O arquivamento em lote é reversível: nenhum conteúdo enviado pelo técnico é apagado.
  async function alterarArquivamentoSelecionados(arquivar) {
    const selecionados = relatorios.filter((relatorio) => relatoriosSelecionados.has(String(relatorio.id))
      && Boolean(relatorio.arquivado_em) !== arquivar);
    if (!selecionados.length) return;
    const botoes = [document.querySelector("[data-arquivar-selecionados]"), document.querySelector("[data-restaurar-selecionados]")];
    botoes.forEach((botao) => { if (botao) botao.disabled = true; });
    const resultados = await Promise.allSettled(selecionados.map((relatorio) => FrutLog.apiFetch(
      `/relatorios-diarios/${encodeURIComponent(relatorio.id)}`,
      { method: "PATCH", body: JSON.stringify({ arquivado: arquivar }) }
    )));
    let atualizados = 0;
    resultados.forEach((resultado, indice) => {
      if (resultado.status !== "fulfilled") return;
      selecionados[indice].arquivado_em = arquivar ? new Date().toISOString() : null;
      atualizados += 1;
    });
    relatoriosSelecionados.clear();
    atualizarLista();
    const falhas = selecionados.length - atualizados;
    const mensagem = document.getElementById("mensagem-relatorios");
    if (mensagem) {
      mensagem.textContent = falhas
        ? `${atualizados} relatório(s) atualizado(s); ${falhas} não puderam ser alterados.`
        : `${atualizados} relatório(s) ${arquivar ? "arquivado(s) e preservado(s)" : "restaurado(s)"}.`;
      mensagem.className = falhas ? "mensagem-feedback erro" : "mensagem-feedback sucesso";
    }
  }

  // Exclusão definitiva exige confirmação e só remove da lista os registros confirmados pela API.
  async function excluirSelecionados() {
    const selecionados = relatorios.filter((relatorio) => relatoriosSelecionados.has(String(relatorio.id)));
    if (!selecionados.length) return;
    const confirmacao = window.confirm(`Excluir permanentemente ${selecionados.length} relatório(s)? Esta ação não pode ser desfeita.`);
    if (!confirmacao) return;
    const botoes = [document.querySelector("[data-arquivar-selecionados]"), document.querySelector("[data-restaurar-selecionados]"), document.querySelector("[data-excluir-selecionados]")];
    botoes.forEach((botao) => { if (botao) botao.disabled = true; });
    const resultados = await Promise.allSettled(selecionados.map((relatorio) => FrutLog.apiFetch(
      `/relatorios-diarios/${encodeURIComponent(relatorio.id)}`,
      { method: "DELETE" }
    )));
    const primeiroErro = resultados.find((resultado) => resultado.status === "rejected")?.reason?.message;
    const removidos = new Set();
    resultados.forEach((resultado, indice) => {
      if (resultado.status === "fulfilled") removidos.add(String(selecionados[indice].id));
    });
    for (let indice = relatorios.length - 1; indice >= 0; indice -= 1) {
      if (removidos.has(String(relatorios[indice].id))) relatorios.splice(indice, 1);
    }
    relatoriosSelecionados.clear();
    atualizarLista();
    const falhas = selecionados.length - removidos.size;
    const mensagem = document.getElementById("mensagem-relatorios");
    if (mensagem) {
      mensagem.textContent = falhas
        ? `${removidos.size} relatório(s) excluído(s); ${falhas} não puderam ser excluídos.${primeiroErro ? ` Erro: ${primeiroErro}` : ""}`
        : `${removidos.size} relatório(s) excluído(s) permanentemente.`;
      mensagem.className = falhas ? "mensagem-feedback erro" : "mensagem-feedback sucesso";
    }
  }

  async function carregarRelatorios() {
    try {
      if (!FrutLog.AUTENTICACAO_API_ATIVA) {
        throw new Error("A API autenticada é necessária para consultar relatórios.");
      }
      const resposta = await FrutLog.apiFetch("/relatorios-diarios");
      relatorios.splice(0, relatorios.length, ...(resposta.relatorios || []));
      atualizarLista();
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = `${relatorios.length} relatório(s) recebido(s).`;
        mensagem.className = "mensagem-feedback";
      }
    } catch (erro) {
      console.error("Falha ao carregar relatórios diários:", erro);
      tabela.innerHTML = `<tr><td colspan="7">${escapar(erro.message)}</td></tr>`;
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = erro.message;
        mensagem.className = "mensagem-feedback erro";
      }
    }
  }

  ["filtro-relatorio-texto", "filtro-relatorio-data", "filtro-relatorio-status", "filtro-visibilidade-relatorios"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", atualizarLista);
    document.getElementById(id)?.addEventListener("change", atualizarLista);
  });

  document.getElementById("selecionar-todos-relatorios")?.addEventListener("change", (evento) => {
    tabela.querySelectorAll("[data-selecionar-relatorio]").forEach((checkbox) => {
      const id = String(checkbox.dataset.selecionarRelatorio);
      if (evento.currentTarget.checked) relatoriosSelecionados.add(id);
      else relatoriosSelecionados.delete(id);
    });
    atualizarLista();
  });
  tabela.addEventListener("change", (evento) => {
    const checkbox = evento.target.closest("[data-selecionar-relatorio]");
    if (!checkbox) return;
    const id = String(checkbox.dataset.selecionarRelatorio);
    if (checkbox.checked) relatoriosSelecionados.add(id);
    else relatoriosSelecionados.delete(id);
    atualizarLista();
  });
  document.querySelector("[data-arquivar-selecionados]")?.addEventListener("click", () => alterarArquivamentoSelecionados(true));
  document.querySelector("[data-restaurar-selecionados]")?.addEventListener("click", () => alterarArquivamentoSelecionados(false));
  document.querySelector("[data-excluir-selecionados]")?.addEventListener("click", excluirSelecionados);

  // A delegação permite abrir o relatório mesmo quando a lista é redesenhada pelos filtros.
  tabela.addEventListener("click", async (evento) => {
    const abrir = evento.target.closest("[data-abrir-relatorio]");
    if (abrir) {
      abrirRelatorio(abrir.dataset.abrirRelatorio);
      return;
    }
    const botaoExcluir = evento.target.closest("[data-excluir-relatorio]");
    if (botaoExcluir) {
      const idExcluir = botaoExcluir.dataset.excluirRelatorio;
      const relatorio = relatorios.find((item) => String(item.id) === String(idExcluir));
      if (!relatorio || !window.confirm(`Excluir permanentemente o relatório de ${relatorio.tecnico_nome || "este técnico"}, de ${formatarData(relatorio.data_relatorio)}? Esta ação não pode ser desfeita.`)) return;
      botaoExcluir.disabled = true;
      try {
        await FrutLog.apiFetch(`/relatorios-diarios/${encodeURIComponent(idExcluir)}`, { method: "DELETE" });
        const indice = relatorios.findIndex((item) => String(item.id) === String(idExcluir));
        if (indice >= 0) relatorios.splice(indice, 1);
        relatoriosSelecionados.delete(String(idExcluir));
        atualizarLista();
        const mensagem = document.getElementById("mensagem-relatorios");
        if (mensagem) {
          mensagem.textContent = "Relatório excluído permanentemente.";
          mensagem.className = "mensagem-feedback sucesso";
        }
      } catch (erro) {
        botaoExcluir.disabled = false;
        const mensagem = document.getElementById("mensagem-relatorios");
        if (mensagem) {
          mensagem.textContent = erro.message;
          mensagem.className = "mensagem-feedback erro";
        }
      }
      return;
    }
    const botao = evento.target.closest("[data-salvar-relatorio]");
    if (!botao) return;
    const id = botao.dataset.salvarRelatorio;
    const seletor = tabela.querySelector(`[data-status-relatorio="${CSS.escape(id)}"]`);
    if (!seletor) return;
    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/relatorios-diarios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: seletor.value }),
      });
      const relatorio = relatorios.find((item) => String(item.id) === String(id));
      if (relatorio) relatorio.status = seletor.value;
      atualizarLista();
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = "Acompanhamento do relatório atualizado.";
        mensagem.className = "mensagem-feedback sucesso";
      }
    } catch (erro) {
      botao.disabled = false;
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = erro.message;
        mensagem.className = "mensagem-feedback erro";
      }
    }
  });

  carregarRelatorios();
  window.setInterval(carregarRelatorios, 30000);
});
