document.addEventListener("DOMContentLoaded", () => {
  const tabela = document.getElementById("tabela-relatorios");
  if (!tabela) return;

  const relatorios = [];
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

  function formatarDataHora(valor) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime())
      ? "--"
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
  }

  function atualizarLista() {
    const texto = document.getElementById("filtro-relatorio-texto")?.value.trim().toLocaleLowerCase("pt-BR") || "";
    const data = document.getElementById("filtro-relatorio-data")?.value || "";
    const status = document.getElementById("filtro-relatorio-status")?.value || "todos";
    const encontrados = relatorios.filter((relatorio) => {
      const contemTexto = `${relatorio.tecnico_nome} ${relatorio.conteudo}`.toLocaleLowerCase("pt-BR").includes(texto);
      return contemTexto && (!data || relatorio.data_relatorio === data) && (status === "todos" || relatorio.status === status);
    });

    if (!encontrados.length) {
      tabela.innerHTML = '<tr><td colspan="5">Nenhum relatorio correspondente.</td></tr>';
      return;
    }

    tabela.innerHTML = encontrados.map((relatorio) => {
      const statusVisivel = {
        enviado: "Enviado",
        em_analise: "Em analise",
        concluido: "Concluido",
      }[relatorio.status] || relatorio.status;
      return `
        <tr>
          <td>Relatório enviado por ${escapar(relatorio.tecnico_nome)}, em ${escapar(formatarDataHora(relatorio.criado_em))}</td>
          <td>${escapar(relatorio.tecnico_nome)}</td>
          <td class="conteudo-relatorio">${escapar(relatorio.conteudo)}</td>
          <td><span class="badge-status ${relatorio.status === "concluido" ? "normal" : "atencao"}">${escapar(statusVisivel)}</span></td>
          <td>
            <div class="acoes-relatorio">
              <select class="campo-formulario" data-status-relatorio="${escapar(relatorio.id)}" aria-label="Novo status do relatorio ${escapar(relatorio.tecnico_nome)}">
                <option value="em_analise" ${relatorio.status === "em_analise" ? "selected" : ""}>Em analise</option>
                <option value="concluido" ${relatorio.status === "concluido" ? "selected" : ""}>Concluido</option>
              </select>
              <button class="btn-filtro" type="button" data-salvar-relatorio="${escapar(relatorio.id)}">Atualizar</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  async function carregarRelatorios() {
    try {
      if (!FrutLog.AUTENTICACAO_API_ATIVA) {
        throw new Error("A API autenticada e necessaria para consultar relatorios.");
      }
      const resposta = await FrutLog.apiFetch("/relatorios-diarios");
      relatorios.splice(0, relatorios.length, ...(resposta.relatorios || []));
      atualizarLista();
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = `${relatorios.length} relatorio(s) recebido(s).`;
        mensagem.className = "mensagem-feedback";
      }
    } catch (erro) {
      console.error("Falha ao carregar relatorios diarios:", erro);
      tabela.innerHTML = `<tr><td colspan="5">${escapar(erro.message)}</td></tr>`;
      const mensagem = document.getElementById("mensagem-relatorios");
      if (mensagem) {
        mensagem.textContent = erro.message;
        mensagem.className = "mensagem-feedback erro";
      }
    }
  }

  ["filtro-relatorio-texto", "filtro-relatorio-data", "filtro-relatorio-status"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", atualizarLista);
    document.getElementById(id)?.addEventListener("change", atualizarLista);
  });

  tabela.addEventListener("click", async (evento) => {
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
        mensagem.textContent = "Acompanhamento do relatorio atualizado.";
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
