document.addEventListener("DOMContentLoaded", () => {
  const painel = document.querySelector("[data-thingspeak-panel]");
  if (!painel) return;

  const status = painel.querySelector("[data-thingspeak-status]");
  const resumo = painel.querySelector("[data-thingspeak-summary]");
  const corpoTabela = painel.querySelector("[data-thingspeak-rows]");
  const canvas = painel.querySelector("canvas");
  const embeds = [...painel.querySelectorAll("[data-thingspeak-embed]")];
  const quadrosNodeRed = [...painel.querySelectorAll("iframe[data-nodered-page]")];
  const avisoNodeRed = painel.querySelector("[data-nodered-aviso]");

  // Endereco do Node-RED em um lugar so, em vez de repetido no HTML de cada painel.
  // Prioridade: window.FRUTLOG_NODERED_URL > localStorage > <meta name="frutlog-nodered"> > padrao local.
  const BASE_NODE_RED_PADRAO = "http://localhost:1880";

  function baseNodeRed() {
    let salvo = "";
    try {
      salvo = window.localStorage.getItem("frutlog:nodered") || "";
    } catch (_) {
      salvo = "";
    }
    const meta = document.querySelector("meta[name=\"frutlog-nodered\"]");
    const escolhido = window.FRUTLOG_NODERED_URL || salvo || meta?.content || BASE_NODE_RED_PADRAO;
    return String(escolhido).trim().replace(/\/+$/, "");
  }

  function aplicarEnderecoNodeRed() {
    if (!quadrosNodeRed.length) return;
    const base = baseNodeRed();
    quadrosNodeRed.forEach((iframe) => {
      const destino = base + "/dashboard/" + iframe.dataset.noderedPage;
      if (iframe.getAttribute("src") !== destino) iframe.setAttribute("src", destino);
    });

    if (!avisoNodeRed) return;
    // Pagina em HTTPS nao consegue abrir um iframe em HTTP: o navegador bloqueia sem avisar.
    const bloqueadoPorMixedContent = window.location.protocol === "https:" && base.startsWith("http://");
    avisoNodeRed.hidden = !bloqueadoPorMixedContent;
    if (bloqueadoPorMixedContent) {
      avisoNodeRed.textContent = "Os graficos do Node-RED (" + base + ") nao aparecem porque esta pagina "
        + "esta em HTTPS e o navegador bloqueia conteudo HTTP. Abra o painel por http://localhost "
        + "ou publique o Node-RED com HTTPS.";
    }
  }

  let grafico = null;
  let atualizando = false;
  // Unica lista de metricas exibidas: cartoes de resumo, colunas da tabela e series
  // do grafico saem daqui. Para voltar a mostrar a chuva, basta adicionar a linha.
  const nomes = {
    temperatura: "Temperatura (C)",
    umidadeAr: "Umidade do ar (%)",
    umidadeSolo: "Umidade do solo (%)",
  };
  const colunas = Object.keys(nomes);
  const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
  const formatarDataHora = (valor) => {
    const data = new Date(valor);
    return Number.isNaN(data.getTime())
      ? "--"
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
  };

  function renderizarResumo(feeds) {
    resumo.innerHTML = Object.entries(nomes).map(([chave, nome]) => {
      const leitura = [...feeds].reverse().find((feed) => Number.isFinite(feed.values?.[chave]));
      return `
        <article>
          <span>${escapar(nome)}</span>
          <strong>${escapar(leitura?.values[chave] ?? "--")}</strong>
        </article>
      `;
    }).join("");
  }

  function mostrarErro(mensagem) {
    status.textContent = mensagem;
    status.className = "mensagem-feedback erro";
    corpoTabela.innerHTML = `<tr><td colspan="${colunas.length + 1}">Não foi possível atualizar as leituras.</td></tr>`;
  }

  async function atualizar() {
    if (atualizando) return;
    atualizando = true;
    try {
      const resposta = await FrutLog.apiFetch("/telemetria/thingspeak");
      const feeds = Array.isArray(resposta.feeds) ? resposta.feeds : [];
      const metricas = Object.entries(nomes).filter(([chave]) =>
        feeds.some((feed) => Number.isFinite(feed.values?.[chave]))
      );
      const maisRecente = feeds[feeds.length - 1];
      renderizarResumo(feeds);
      status.textContent = `${resposta.channel?.name || "ThingSpeak"} · atualizado ${formatarDataHora(maisRecente?.created_at)}`;
      status.className = "mensagem-feedback sucesso";
      embeds.forEach((iframe) => {
        const channelId = Number(resposta.channel?.id);
        const campo = Number(resposta.fields?.[iframe.dataset.thingspeakEmbed]);
        if (!Number.isSafeInteger(channelId) || !Number.isInteger(campo) || campo < 1 || campo > 8) return;
        const url = new URL(`https://thingspeak.com/channels/${channelId}/charts/${campo}`);
        url.searchParams.set("dynamic", "true");
        url.searchParams.set("results", "60");
        url.searchParams.set("type", "line");
        iframe.src = url.toString();
      });

      // Tabela de registros corrigida e estruturada
      corpoTabela.innerHTML = feeds.length
        ? feeds.slice(-12).reverse().map((feed) => `
          <tr>
            <td>${escapar(formatarDataHora(feed.created_at))}</td>
            ${colunas.map((chave) => `<td>${escapar(feed.values[chave] ?? "--")}</td>`).join("")}
          </tr>
        `).join("")
        : `<tr><td colspan="${colunas.length + 1}">O canal ainda não possui leituras.</td></tr>`;

      if (grafico) grafico.destroy();
      grafico = null;
      if (typeof Chart === "undefined") {
        status.textContent += " · Graficos indisponiveis neste navegador.";
        return;
      }
//exemplo para os outros graficos // 
      // Filtra o array para pegar 1 a cada 15 pontos e limpar o gráfico
      const feedsParaGrafico = feeds.filter((_, indice) => indice % 15 === 0);

      grafico = new Chart(canvas, {
        type: "line",
        data: {
          labels: feedsParaGrafico.map((feed) => formatarDataHora(feed.created_at)),
          datasets: metricas.map(([chave, nome], indice) => ({
            label: nome,
            data: feedsParaGrafico.map((feed) => feed.values[chave]),
            borderColor: ["#2e7d32", "#061b61", "#ef6c00", "#6a1b9a"][indice],
            spanGaps: true,
            tension: 0.25,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: { y: { beginAtZero: false } },
        },
      });
    } catch (erro) {
      mostrarErro(erro.message);
    } finally {
      atualizando = false;
    }
  }

  aplicarEnderecoNodeRed();
  renderizarResumo([]);
  atualizar();
  window.setInterval(atualizar, 30000);
});