document.addEventListener("DOMContentLoaded", () => {
  const painel = document.querySelector("[data-thingspeak-panel]");
  if (!painel) return;

  const status = painel.querySelector("[data-thingspeak-status]");
  const resumo = painel.querySelector("[data-thingspeak-summary]");
  const corpoTabela = painel.querySelector("[data-thingspeak-rows]");
  const canvas = painel.querySelector("canvas");
  const embeds = [...painel.querySelectorAll("[data-thingspeak-embed]")];
  let grafico = null;
  let atualizando = false;
  const nomes = {
    temperatura: "Temperatura (C)",
    umidadeAr: "Umidade do ar (%)",
    umidadeSolo: "Umidade do solo (%)",
    chuva: "Chuva (mm)",
  };
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
    corpoTabela.innerHTML = '<tr><td colspan="5">Nao foi possivel atualizar as leituras.</td></tr>';
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
      corpoTabela.innerHTML = feeds.length
        ? feeds.slice(-12).reverse().map((feed) => `
          <tr>
            <td>${escapar(formatarDataHora(feed.created_at))}</td>
            ${Object.keys(nomes).map((chave) => `<td>${escapar(feed.values[chave] ?? "--")}</td>`).join("")}
          </tr>
        `).join("")
        : '<tr><td colspan="5">O canal ainda nao possui leituras.</td></tr>';

      if (grafico) grafico.destroy();
      grafico = null;
      if (typeof Chart === "undefined") {
        status.textContent += " · Graficos indisponiveis neste navegador.";
        return;
      }
      grafico = new Chart(canvas, {
        type: "line",
        data: {
          labels: feeds.map((feed) => formatarDataHora(feed.created_at)),
          datasets: metricas.map(([chave, nome], indice) => ({
            label: nome,
            data: feeds.map((feed) => feed.values[chave]),
            borderColor: ["#2e7d32", "#1976d2", "#ef6c00", "#6a1b9a"][indice],
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

  renderizarResumo([]);
  atualizar();
  window.setInterval(atualizar, 30000);
});
