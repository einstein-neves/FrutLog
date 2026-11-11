/* =========================================================
   FRUTLOG - ENGENHEIRO AGRONOMO
   Monitoramento, edicao de talhoes, telemetria e plantio.
   ========================================================= */

const CABECALHOS_ABAS = {
  "monitoramento": {
    titulo: "Monitoramento do Engenheiro",
    descricao: "Acompanhamento dos produtos em desenvolvimento nos talhões.",
  },
  "telemetria": {
    titulo: "Telemetria",
    descricao: "Leituras dos sensores por talhão, histórico diário e médias mensais.",
  },
  "sensores": {
    titulo: "Sensores",
    descricao: "Métricas dos sensores por talhão.",
  },
  "colheitas": {
    titulo: "Colheitas",
    descricao: "Histórico anual de colheitas dos talhões.",
  },
  "relatorios-diarios": {
    titulo: "Registros de Campo",
    descricao: "Relatórios de campo enviados pelos técnicos.",
  },
  "cadastro-plantio": {
    titulo: "Cadastrar Produto",
    descricao: "Cadastre produtos e acompanhe o ciclo ativo de cada talhão.",
  },
};

function configurarCabecalhoPorAba() {
  const titulo = document.getElementById("topo-titulo");
  const descricao = document.getElementById("topo-descricao");
  if (!titulo || !descricao) return;

  const atualizar = () => {
    // A aba ativa é a que não está com o atributo "hidden".
    const idAtivo = Object.keys(CABECALHOS_ABAS).find((id) => !document.getElementById(id)?.hidden);
    const texto = CABECALHOS_ABAS[idAtivo];
    if (!texto) return;
    titulo.textContent = texto.titulo;
    descricao.textContent = texto.descricao;
  };

  document.querySelectorAll(".menu .nav-link").forEach((link) => link.addEventListener("click", atualizar));
  atualizar(); // também acerta o texto se a página abrir direto em outra aba
}

document.addEventListener("DOMContentLoaded", async () => {
  FrutLog.verificarSessao(["engenheiro"]);
  FrutLog.configurarLogout();
  FrutLog.configurarAbasSidebar();
  configurarCabecalhoPorAba();

  const svgMapa = document.getElementById("camada-talhoes");
  const mapaContainer = document.querySelector(".mapa-container");
  const botoesTalhao = document.getElementById("botoes-talhao");
  const formularioPlantio = document.getElementById("formulario-plantio");
  const mensagemPlantio = document.getElementById("mensagem-plantio");
  const btnEncerrarCiclo = document.getElementById("btn-encerrar-ciclo-talhao");
  const mensagemEncerramentoCiclo = document.getElementById("mensagem-encerramento-ciclo");
  const mensagemEdicao = document.getElementById("mensagem-edicao-talhao");
  const filtrosGrafico = document.querySelectorAll(".btn-filtro[data-unidade]");
  // Barra do mapa padronizada: Editar talhao, Criar, Salvar e Excluir.
  // Recarregar mapa, Dividir, Cancelar e o campo manual de area foram removidos.
  const btnEditar = document.getElementById("btn-editar-talhoes");
  const btnCriar = document.getElementById("btn-criar-talhao");
  const btnExcluir = document.getElementById("btn-excluir-talhao");
  const btnSalvar = document.getElementById("btn-salvar-talhao");

  let talhoes = FrutLogTalhoes.obterTalhoes();
  let talhaoSelecionado = talhoes[0]?.properties.codigo || "";
  let codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
  let mapaApiPronto = !FrutLog.AUTENTICACAO_API_ATIVA;
  let modoEdicao = false;
  let modoCriacao = false;
  let pontosCriacao = [];
  let codigoGeometriaPendente = "";
  let verticeArrastado = null;
  let talhaoArrastado = null;
  let graficoColheita = null;
  let graficoClimaMensalEngenheiro = null;
  let unidadeAtual = "t";
  let sensoresDoPainel = [];
  let telemetriaMensalEngenheiro = [];
  let telemetriaMensalEsp32 = [];
  let plantiosAtivos = [];

  let graficoMetricas = null;
  let telemetriaDiaria = [];

  const METRICAS_TELEMETRIA = {
    temperatura: { nome: "Temperatura", unidade: "°C", cor: "#ef6c00" },
    umidadeAr: { nome: "Umidade do ar", unidade: "%", cor: "#1565c0" },
    umidadeSolo: { nome: "Umidade do solo", unidade: "%", cor: "#2e7d32" },
  };
  const PALETA_TALHOES = ["#2e7d32", "#1565c0", "#ef6c00", "#6a1b9a", "#c62828", "#00838f"];
  // Talhão onde o ESP32 está instalado. Os dados do ThingSpeak são mostrados só para ele.
  const TALHAO_DO_ESP32 = "T19";

  let colheitas = [];

  function classeStatus(status) {
    return String(status)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");
  }

  function formatarData(dataISO) {
    if (!dataISO) return "--";
    const [ano, mes, dia] = dataISO.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataISO;
  }

  function formatarDataHora(valor) {
    if (!valor) return "Sem leitura registrada";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "--";
    const minutos = Math.floor(Math.max(0, Date.now() - data.getTime()) / 60000);
    const relativo = minutos < 1 ? "agora" : minutos < 60 ? `há ${minutos} min`
      : minutos < 1440 ? `há ${Math.floor(minutos / 60)} h` : `há ${Math.floor(minutos / 1440)} d`;
    return `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data)} (${relativo})`;
  }

  function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  }

  function obterFeature(codigo) {
    return talhoes.find((feature) => feature.properties.codigo === codigo);
  }

  function atualizarResumoCicloAtual() {
    const codigo = document.getElementById("talhao")?.value;
    const saida = document.getElementById("dados-ciclo-atual");
    const ciclo = plantiosAtivos.find((item) => item.talhao === codigo);
    if (!saida) return ciclo || null;

    if (!codigo) {
      saida.textContent = "Selecione um talhão para consultar o ciclo ativo.";
    } else if (ciclo) {
      const produto = [ciclo.produto, ciclo.variedade].filter(Boolean).join(" / ") || "Produto sem identificação";
      saida.textContent = `${produto} · plantado em ${formatarData(ciclo.plantado_em)} · previsão de colheita ${formatarData(ciclo.previsao_colheita)}.`;
    } else {
      saida.textContent = "Não há ciclo ativo neste talhão. Você já pode cadastrar um produto.";
    }
    return ciclo || null;
  }

  function obterPontos(feature) {
    return FrutLogTalhoes.obterPontos(feature);
  }

  function pontosParaString(pontos) {
    return pontos.map((ponto) => `${ponto[0]},${ponto[1]}`).join(" ");
  }

  function atualizarStatusTalhao(feature) {
    const monitorado = FrutLogTalhoes.aplicarMonitoramento(feature);
    feature.properties = monitorado.properties;
    return feature.properties.status;
  }

  function renderizarBotoesTalhao() {
    if (!botoesTalhao) return;

    botoesTalhao.innerHTML = talhoes.map((feature) => {
      const codigo = feature.properties.codigo;
      const ativo = codigo === talhaoSelecionado ? " active" : "";
      return `<button class="btn-talhao${ativo}" type="button" data-talhao="${codigo}">${codigo}</button>`;
    }).join("");

    botoesTalhao.querySelectorAll(".btn-talhao").forEach((botao) => {
      botao.addEventListener("click", () => selecionarTalhao(botao.dataset.talhao));
    });
  }

  function renderizarMapa() {
    if (!svgMapa) return;

    const pendentes = talhoes.filter((feature) => feature.properties.geometriaPendente).length;
    preencherTexto(
      "mensagem-geometria-talhoes",
      pendentes ? `${pendentes} talhão(es) ainda sem geometria. Selecione cada um e use Criar para desenhar seus limites.` : ""
    );

    FrutLogMapaTalhoes.renderizarMapaTalhoes(svgMapa, talhoes, {
      selectedCode: talhaoSelecionado,
      statusFor: atualizarStatusTalhao,
      onSelect: (feature, evento) => {
        if (modoCriacao) return;
        evento.stopPropagation();
        if (!talhaoArrastado?.moveu) selecionarTalhao(feature.properties.codigo);
      },
      onPolygon: (poligono, feature) => {
        const codigo = feature.properties.codigo;
        poligono.addEventListener("pointerdown", (evento) => {
          if (!modoEdicao || modoCriacao || codigo !== talhaoSelecionado) return;
          evento.preventDefault();
          talhaoArrastado = {
            codigo,
            origem: obterPontoSvg(evento),
            moveu: false,
          };
        });

        if (modoEdicao && codigo === talhaoSelecionado) {
          renderizarVertices(feature);
        }
      },
    });

    /* Os overlays de edição permanecem exclusivos do Engenheiro. */
    if (modoCriacao && pontosCriacao.length > 0) {
      const rascunho = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      rascunho.setAttribute("points", pontosParaString(pontosCriacao));
      rascunho.classList.add("poligono-rascunho");
      svgMapa.appendChild(rascunho);
    }
  }

  function renderizarVertices(feature) {
    const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grupo.dataset.verticesTalhao = feature.properties.codigo;

    obterPontos(feature).forEach((ponto, index) => {
      const vertice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      vertice.setAttribute("cx", ponto[0]);
      vertice.setAttribute("cy", ponto[1]);
      vertice.setAttribute("r", "6");
      vertice.classList.add("ponto-arrastavel");
      vertice.dataset.index = String(index);
      vertice.addEventListener("pointerdown", (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        verticeArrastado = { codigo: feature.properties.codigo, index };
      });
      grupo.appendChild(vertice);
    });

    svgMapa.appendChild(grupo);
  }

  /*
   * O mapa compartilhado desenha apenas os polígonos persistidos; o engenheiro
   * acrescenta os pontos de edição e os traçados temporários acima.
   */

  function atualizarSelectCadastro() {
    const select = document.getElementById("talhao");
    if (!select) return;

    const atual = select.value;
    const opcoes = talhoes
      .map((feature) => {
        const codigo = String(feature.properties.codigo).replace(/[&<>"']/g, (caractere) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[caractere]);
        return `<option value="${codigo}">${codigo}</option>`;
      })
      .join("");
    select.innerHTML = `<option value="">${opcoes ? "Selecione o talhão" : "Nenhum talhão carregado"}</option>${opcoes}`;
    if (talhoes.some((feature) => feature.properties.codigo === atual)) select.value = atual;
    atualizarSensoresDoTalhao();
    atualizarResumoCicloAtual();
  }

  function atualizarSensoresDoTalhao() {
    const select = document.getElementById("sensor-associado");
    if (!select) return;
    const codigoTalhao = document.getElementById("talhao")?.value;
    const sensores = sensoresDoPainel.filter((sensor) => sensor.talhao === codigoTalhao && sensor.ativo);
    if (!sensores.length) {
      select.innerHTML = '<option value="Nenhum sensor ativo cadastrado para este talhao">Nenhum sensor ativo cadastrado para este talhão</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = sensores.map((sensor) => {
      const situacao = sensor.status === "Online" ? "Online" : "Cadastrado, aguardando leitura";
      return `<option>${sensor.sensor} - ${sensor.tipo} (${situacao})</option>`;
    }).join("");
    select.disabled = false;
  }

  /**
   * Sincroniza a barra de ferramentas do mapa com o estado da edição.
   *
   * Criar, Salvar e Excluir só ficam liberados dentro do modo de edição;
   * "Editar talhão" é o único sempre disponível (depende apenas do mapa já ter
   * vindo do servidor) e alterna o próprio rótulo para encerrar a edição.
   * @returns {void}
   */
  function atualizarControlesEdicao() {
    const habilitarFerramentas = modoEdicao;

    [btnCriar, btnExcluir, btnSalvar].forEach((botao) => {
      if (botao) botao.disabled = !habilitarFerramentas;
    });

    btnEditar?.classList.toggle("active", modoEdicao);
    if (btnEditar) btnEditar.disabled = !mapaApiPronto;
    if (btnEditar) btnEditar.textContent = modoEdicao ? "Encerrar edição" : "Editar talhão";
    btnCriar?.classList.toggle("active", modoCriacao);
    mapaContainer?.classList.toggle("modo-edicao", modoEdicao);
  }

  function exibirMensagemEdicao(texto, tipo = "sucesso") {
    if (mensagemEdicao) {
      mensagemEdicao.textContent = texto;
      mensagemEdicao.className = `mensagem-feedback ${tipo}`;
    }
    // Erro vira toast; os avisos de progresso ficam so na linha de mensagem.
    if (tipo === "erro") FrutLogFeedback.toast(texto, tipo);
  }

  function selecionarTalhao(codigo) {
    const feature = obterFeature(codigo);
    if (!feature) return;

    talhaoSelecionado = codigo;
    const status = atualizarStatusTalhao(feature);
    const props = feature.properties;

    preencherTexto("titulo-talhao", `Detalhes: Talhão ${codigo}`);
    preencherTexto("talhao-area", props.area);
    preencherTexto("talhao-solo", props.solo);
    preencherTexto("talhao-plantio", formatarData(props.plantio));
    preencherTexto("talhao-colheita", formatarData(props.colheita));
    preencherTexto("talhao-produto", props.produto);
    preencherTexto("talhao-variedade", props.variedade);
    preencherTexto("talhao-temperatura-maxima", `${props.parametros?.temperaturaMaxima ?? "--"} °C`);
    preencherTexto("talhao-ultima-leitura", formatarDataHora(props.ultima_leitura_em));
    preencherTexto("talhao-sensor", props.sensor || "Não associado");
    const ia = props.monitoramento || {};
    const minutos = ia.coletadoEm ? Math.round((Date.now() - new Date(ia.coletadoEm)) / 60000) : null;
    preencherTexto("talhao-temperatura-atual", ia.temperaturaAtual != null
      ? `${ia.temperaturaAtual} °C${minutos != null ? ` · há ${minutos} min` : ""}`
      : "--");
    const soloValor = ia.umidadeSolo ?? props.diaria?.umidadeSolo;
    const arValor = props.diaria?.umidadeAr;
    const desatualizada = ia.umidadeSolo == null && soloValor != null;
    preencherTexto("talhao-umidade", soloValor != null || arValor != null
      ? `${arValor ?? "--"}% ar / ${soloValor ?? "--"}% solo${desatualizada ? " (desatualizada)" : ""}`
      : "--");
    preencherTexto("talhao-inspecao-data", formatarData(props.apontamentoTecnico?.data));
    preencherTexto("talhao-inspecao-tecnico", props.apontamentoTecnico?.tecnico || "--");
    preencherTexto("talhao-inspecao-problema", props.apontamentoTecnico?.problema || "--");
    preencherTexto("talhao-inspecao-recomendacao", props.apontamentoTecnico?.recomendacao || "--");
    preencherTexto("talhao-diagnostico", ia.mensagem || props.prioridade || "--");
    preencherTexto("talhao-diagnostico-origem", ia.origem ? `Fonte: ${ia.origem}` : "");
    const cicloAtivo = plantiosAtivos.find((item) => item.talhao === codigo);
    if (btnEncerrarCiclo) btnEncerrarCiclo.disabled = !cicloAtivo;

    const badge = document.getElementById("talhao-status");
    if (badge) {
      badge.textContent = FrutLog.textoInterface(status);
      badge.className = `badge-status ${classeStatus(status)}`;
    }

    atualizarTabelaDiaria(props.diaria || {});
    renderizarGraficoClimaMensalEngenheiro();
    renderizarBotoesTalhao();
    renderizarMapa();
  }

  function atualizarTabelaDiaria(dados) {
    const tabela = document.getElementById("tabela-telemetria-diaria");
    if (!tabela) return;

    tabela.innerHTML = `
      <tr>
        <td>${dados.temperatura || "--"}</td>
        <td>${dados.umidadeAr || "--"}</td>
        <td>${dados.umidadeSolo || "--"}</td>
        
      </tr>
    `;
  }

  function nomeMetrica(codigo) {
    return METRICAS_TELEMETRIA[codigo]?.nome || codigo || "Métrica";
  }

  function valorSensorValido(sensor) {
    return sensor.valor !== null && sensor.valor !== undefined && sensor.valor !== "" && Number.isFinite(Number(sensor.valor));
  }

  function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[caractere]);
  }

  function obterSensores() {
    return sensoresDoPainel;
  }

  function renderizarSensores() {
    const tabela = document.getElementById("tabela-sensores-eng");
    if (!tabela) return;
    if (!sensoresDoPainel.length) {
      tabela.innerHTML = '<tr><td colspan="7">Nenhum sensor cadastrado.</td></tr>';
      return;
    }
    tabela.innerHTML = sensoresDoPainel.map((sensor) => {
      const status = sensor.status || (sensor.ativo === false ? "Inativo" : "Online");
      const leitura = sensor.leitura
        || (valorSensorValido(sensor) ? `${sensor.valor} ${sensor.unidade || ""}`.trim() : "Sem leitura");
      const atualidade = !sensor.ultima_leitura_em
        ? "Sem leitura"
        : sensor.dados_recentes ? "Atual" : "Desatualizada";
      return `
        <tr>
          <td>${escaparHtml(sensor.sensor || sensor.id_externo)}</td>
          <td>${escaparHtml(sensor.talhao || "--")}</td>
          <td>${escaparHtml(sensor.tipo || sensor.codigo_metrica)}</td>
          <td>${escaparHtml(leitura)}<br><small>${sensor.ultima_leitura_em ? escaparHtml(formatarDataHora(sensor.ultima_leitura_em)) : "Sem leitura registrada"}</small></td>
          <td><span class="badge-status ${classeStatus(status)}">${escaparHtml(status)}</span></td>
          <td>${escaparHtml(sensor.comunicacao ? formatarDataHora(sensor.comunicacao) : "Nunca")}</td>
          <td><span class="badge-status ${atualidade === "Atual" ? "normal" : "atencao"}">${atualidade}</span></td>
        </tr>`;
    }).join("");
  }


  function carregarGraficoMetricas() {
    const selectMetrica = document.getElementById("filtro-metrica-tecnico");
    const selectTalhao = document.getElementById("filtro-talhao-metrica-tecnico");
    const canvas = document.getElementById("grafico-metricas-tecnico");
    const mensagem = document.getElementById("mensagem-grafico-metricas");
    if (!selectMetrica || !canvas || typeof Chart === "undefined") return;

    const sensores = obterSensores();

    // Todas as métricas do sistema ficam disponíveis, com ou sem sensor cadastrado.
    const extras = [...new Set([
      ...sensores.map((sensor) => sensor.tipo),
      ...telemetriaDiaria.map((item) => item.codigo_metrica),
    ].filter(Boolean))].filter((codigo) => !METRICAS_TELEMETRIA[codigo]);
    const codigos = [...Object.keys(METRICAS_TELEMETRIA), ...extras];
    const temDados = (codigo) =>
      telemetriaDiaria.some((item) => item.codigo_metrica === codigo) ||
      sensores.some((sensor) => sensor.tipo === codigo && valorSensorValido(sensor));

    const metricaAnterior = selectMetrica.value;
    selectMetrica.innerHTML = codigos
      .map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(nomeMetrica(codigo))}</option>`)
      .join("");
    selectMetrica.value = codigos.includes(metricaAnterior)
      ? metricaAnterior
      : (codigos.find(temDados) || codigos[0]);

    if (selectTalhao) {
      const talhaoAnterior = selectTalhao.value;
      const codigosTalhao = talhoes.map((feature) => feature.properties.codigo);
      selectTalhao.innerHTML = '<option value="">Todos os talhões</option>' +
        codigosTalhao.map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(codigo)}</option>`).join("");
      if (codigosTalhao.includes(talhaoAnterior)) selectTalhao.value = talhaoAnterior;
    }

    const metrica = selectMetrica.value;
    const talhao = selectTalhao?.value || "";
    const info = METRICAS_TELEMETRIA[metrica] || { nome: metrica, unidade: "", cor: "#2e7d32" };
    const escopo = talhao ? ` no talhão ${talhao}` : "";

    if (graficoMetricas) graficoMetricas.destroy();
    graficoMetricas = null;

    const serie = telemetriaDiaria.filter((item) =>
      item.codigo_metrica === metrica &&
      (!talhao || item.talhao === talhao) &&
      Number.isFinite(Number(item.valor_medio)));

    if (serie.length) {
      // Histórico: média diária da métrica, uma linha por talhão.
      const dias = [...new Set(serie.map((item) => String(item.dia).slice(0, 10)))].sort();
      const talhoesDaSerie = [...new Set(serie.map((item) => item.talhao).filter(Boolean))].sort();
      graficoMetricas = new Chart(canvas, {
        type: "line",
        data: {
          labels: dias.map((dia) => formatarData(dia).slice(0, 5)),
          datasets: talhoesDaSerie.map((codigo, indice) => {
            const cor = PALETA_TALHOES[indice % PALETA_TALHOES.length];
            return {
              label: `Talhão ${codigo}`,
              data: dias.map((dia) => {
                const linha = serie.find((item) => item.talhao === codigo && String(item.dia).slice(0, 10) === dia);
                return linha ? Number(linha.valor_medio) : null;
              }),
              borderColor: cor,
              backgroundColor: cor,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
              spanGaps: true,
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: talhoesDaSerie.length > 1 } },
          scales: { y: { title: { display: true, text: `${info.nome}${info.unidade ? ` (${info.unidade})` : ""}` } } },
        },
      });
      if (mensagem) mensagem.textContent = `Média diária de ${info.nome.toLowerCase()}${escopo} neste mês (${serie.length} ponto(s)).`;
      return;
    }

    // Sem histórico diário: mostra a última leitura dos sensores cadastrados dessa métrica.
    const leituras = sensores.filter((sensor) =>
      sensor.tipo === metrica && sensor.status !== "Inativo" &&
      (!talhao || sensor.talhao === talhao) && valorSensorValido(sensor));
    // Último recurso: média mensal do ESP32 (ThingSpeak), que não pertence a nenhum talhão.
    const esp32 = !leituras.length && (!talhao || talhao === TALHAO_DO_ESP32)
      ? telemetriaMensalEsp32
        .filter((item) => item.codigo_metrica === metrica && Number.isFinite(Number(item.valor_medio)))
        .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
      : [];
    if (esp32.length) {
      graficoMetricas = new Chart(canvas, {
        type: "line",
        data: {
          labels: esp32.map((item) => item.mes),
          datasets: [{
            label: `${info.nome} · ESP32 (média mensal)`,
            data: esp32.map((item) => Number(item.valor_medio)),
            borderColor: info.cor,
            backgroundColor: info.cor,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: { y: { title: { display: true, text: `${info.nome}${info.unidade ? ` (${info.unidade})` : ""}` } } },
        },
      });
      if (mensagem) mensagem.textContent = `Nenhum sensor cadastrado enviou leituras; exibindo a média mensal do ESP32 (ThingSpeak) de ${info.nome.toLowerCase()}. O ESP32 não está vinculado a um talhão.`;
      return;
    }
    if (leituras.length) {
      graficoMetricas = new Chart(canvas, {
        type: "bar",
        data: {
          labels: leituras.map((sensor) => `${sensor.sensor} (${sensor.talhao || "--"})`),
          datasets: [{
            label: info.nome,
            data: leituras.map((sensor) => Number(sensor.valor)),
            backgroundColor: info.cor,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, title: { display: true, text: info.unidade || info.nome } } },
        },
      });
    }
    if (mensagem) {
      mensagem.textContent = leituras.length
        ? `Ainda sem histórico diário; exibindo a última leitura de ${leituras.length} sensor(es) de ${info.nome.toLowerCase()}${escopo}.`
        : `Ainda não há leituras de ${info.nome.toLowerCase()}${escopo}.`;
    }
  }

  function renderizarGraficoClimaMensalEngenheiro() {
    const canvas = document.getElementById("grafico-clima-mensal-engenheiro");

    if (!canvas || typeof Chart === "undefined") return;

    if (graficoClimaMensalEngenheiro) {
      graficoClimaMensalEngenheiro.destroy();
    }
    const dadosMensais = [...telemetriaMensalEngenheiro, ...telemetriaMensalEsp32];

    const metricas = {
      temperatura: {
        nome: "Temperatura",
      },
      umidadeAr: {
        nome: "Umidade do ar",
      },
      umidadeSolo: {
        nome: "Umidade do solo",
      },
    };

    const meses = [
      ...new Set(
        dadosMensais
          .map((item) => item.mes)
          .filter(Boolean)
      ),
    ].sort();

    const dados = meses.map((mes) => {
      const resultado = { mes };

      Object.keys(metricas).forEach((codigo) => {
        const leituras = dadosMensais
          .filter(
            (item) =>
              item.mes === mes &&
              item.codigo_metrica === codigo &&
              Number.isFinite(Number(item.valor_medio))
          )
          .map((item) => Number(item.valor_medio));

        resultado[codigo] = leituras.length
          ? leituras.reduce((soma, valor) => soma + valor, 0) / leituras.length
          : null;
      });

      return resultado;
    });

    graficoClimaMensalEngenheiro = new Chart(canvas, {
      type: "line",
      data: {
        labels: dados.map((item) => item.mes),
        datasets: [
          {
            label: "Temperatura (°C)",
            data: dados.map((item) => item.temperatura),
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: "Umidade do ar (%)",
            data: dados.map((item) => item.umidadeAr),
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: "Umidade do solo (%)",
            data: dados.map((item) => item.umidadeSolo),
            tension: 0.3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  function obterPontoSvg(evento) {
    const ponto = svgMapa.createSVGPoint();
    ponto.x = evento.clientX;
    ponto.y = evento.clientY;
    const convertido = ponto.matrixTransform(svgMapa.getScreenCTM().inverse());

    return [
      Math.max(0, Math.min(500, Math.round(convertido.x))),
      Math.max(0, Math.min(400, Math.round(convertido.y))),
    ];
  }

  function atualizarVertice(evento) {
    if (!verticeArrastado) return;

    const feature = obterFeature(verticeArrastado.codigo);
    if (!feature) return;

    const pontos = obterPontos(feature);
    pontos[verticeArrastado.index] = obterPontoSvg(evento);
    feature.geometry.coordinates[0] = FrutLogTalhoes.fecharAnel(pontos);
    renderizarMapa();
  }

  function moverTalhao(evento) {
    if (!talhaoArrastado) return;

    const feature = obterFeature(talhaoArrastado.codigo);
    if (!feature) return;

    const destino = obterPontoSvg(evento);
    const deslocamentoX = destino[0] - talhaoArrastado.origem[0];
    const deslocamentoY = destino[1] - talhaoArrastado.origem[1];

    if (deslocamentoX === 0 && deslocamentoY === 0) return;

    const pontos = obterPontos(feature).map((ponto) => [
      Math.max(0, Math.min(500, ponto[0] + deslocamentoX)),
      Math.max(0, Math.min(400, ponto[1] + deslocamentoY)),
    ]);

    feature.geometry.coordinates[0] = FrutLogTalhoes.fecharAnel(pontos);
    talhaoArrastado.origem = destino;
    talhaoArrastado.moveu = true;
    renderizarMapa();
  }

  // Um código já usado por talhão arquivado continua ocupado no banco e faria o
  // salvamento do mapa inteiro falhar, por isso ele também é pulado aqui.
  function codigoIndisponivel(codigo) {
    return Boolean(obterFeature(codigo)) || FrutLogMapaTalhoes.codigoArquivado(codigo);
  }

  function gerarCodigoNovo() {
    let indice = talhoes.length + 1;
    let codigo = `T${indice}`;

    while (codigoIndisponivel(codigo)) {
      indice += 1;
      codigo = `T${indice}`;
    }

    return codigo;
  }

  // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: retangulo com 8 pontos de ajuste
  // Monta um retangulo em volta do ponto clicado: 4 cantos + o meio de cada lado.
  // Com os pontos do meio o talhao fica mais facil de moldar depois.
  function retanguloComOitoPontos(centro, largura = 90, altura = 70) {
    const limitar = (valor, maximo) => Math.min(Math.max(valor, 0), maximo);
    const esquerda = limitar(centro[0] - largura / 2, 500);
    const direita = limitar(centro[0] + largura / 2, 500);
    const topo = limitar(centro[1] - altura / 2, 400);
    const base = limitar(centro[1] + altura / 2, 400);
    const meioX = (esquerda + direita) / 2;
    const meioY = (topo + base) / 2;

    // sentido horario, comecando no canto superior esquerdo
    return [
      [esquerda, topo], [meioX, topo], [direita, topo], [direita, meioY],
      [direita, base], [meioX, base], [esquerda, base], [esquerda, meioY],
    ];
  }
  // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO

  /**
   * Fecha o desenho em andamento e grava a geometria no rascunho do mapa.
   *
   * Sem o campo manual "Área do talhão (ha)", a área em hectares passa a ser
   * calculada pela forma desenhada (FrutLogTalhoes.recalcularAreaAutomatica),
   * garantindo que todo talhão novo chegue ao banco com área positiva — o que
   * PUT /talhoes/geometrias e POST /plantios exigem.
   * @returns {void}
   */
  function concluirCriacao() {
    if (!modoCriacao || pontosCriacao.length < 3) {
      exibirMensagemEdicao("Adicione pelo menos três pontos para criar um talhão.", "erro");
      return;
    }

    const codigo = codigoGeometriaPendente || gerarCodigoNovo();
    const geometria = { type: "Polygon", coordinates: [FrutLogTalhoes.fecharAnel(pontosCriacao)] };
    if (codigoGeometriaPendente) {
      const feature = obterFeature(codigoGeometriaPendente);
      feature.geometry = geometria;
      feature.properties.geometriaPendente = false;
      // Talhão que ainda não tinha limites: a área vem toda da forma desenhada.
      FrutLogTalhoes.recalcularAreaAutomatica(feature);
    } else {
      const novo = FrutLogTalhoes.criarFeature(codigo, pontosCriacao);
      FrutLogTalhoes.recalcularAreaAutomatica(novo);
      talhoes.push(novo);
    }
    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    selecionarTalhao(codigo);
    atualizarControlesEdicao();
    atualizarSelectCadastro();
    const area = obterFeature(codigo)?.properties.area_hectares;
    exibirMensagemEdicao(`Talhão ${codigo} com ${area} hectares calculados pela forma. Clique em Salvar para persistir.`);
  }

  /**
   * Alterna o modo de edição do mapa (botão "Editar talhão").
   *
   * Ao entrar, relê o servidor; ao sair, descarta o rascunho não salvo — papel
   * que antes era do botão "Cancelar", removido da barra de ferramentas.
   * @returns {Promise<void>}
   */
  async function ativarOuDesativarEdicao() {
    // Sair da edição joga fora o que não foi salvo, no lugar do antigo Cancelar.
    if (modoEdicao) {
      modoEdicao = false;
      cancelarAlteracoesMapa();
      return;
    }

    // Administração também edita o mesmo mapa. Entrar na edição sempre relendo o
    // servidor evita que o engenheiro parta de uma versão antiga e sobrescreva
    // alterações salvas pelo admin (e já traz os códigos arquivados do momento).
    if (FrutLog.AUTENTICACAO_API_ATIVA) {
      if (btnEditar) btnEditar.disabled = true;
      exibirMensagemEdicao("Carregando a versão mais recente dos talhões...");
      try {
        await carregarDadosPainel();
      } catch (erro) {
        exibirMensagemEdicao(`Não foi possível carregar a versão atual do mapa: ${erro.message}`, "erro");
        atualizarControlesEdicao();
        return;
      }
    }

    modoEdicao = true;
    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    verticeArrastado = null;
    talhaoArrastado = null;
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao("Arraste os pontos para alterar a forma ou o interior para mover o talhão. Use Criar para desenhar um novo limite; a área em hectares é recalculada sozinha. Clique em Salvar ao terminar.");
  }

  function iniciarCriacao() {
    if (!modoEdicao) return;
    const featureSelecionada = obterFeature(talhaoSelecionado);
    codigoGeometriaPendente = featureSelecionada && obterPontos(featureSelecionada).length < 3
      ? talhaoSelecionado
      : "";
    modoCriacao = true;
    pontosCriacao = [];
    atualizarControlesEdicao();
    renderizarMapa();
    // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: mensagem do novo modo de um clique
    exibirMensagemEdicao(
      codigoGeometriaPendente
        ? `Clique no mapa para posicionar o talhão ${codigoGeometriaPendente}. Depois arraste os 8 pontos para ajustar a forma.`
        : "Clique no mapa para criar o talhão. Depois arraste os 8 pontos para ajustar a forma."
    );
    // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  }

  // O recurso "Dividir" saiu da barra de ferramentas do mapa, e com ele as
  // rotinas de geometria que só ele usava (ladoDaLinha, calcularIntersecaoLinha,
  // recortarPoligonoPorLinha, removerPontosDuplicados, dividirTalhaoSelecionado
  // e gerarCodigoFilho). Para dividir um talhão hoje: exclua e desenhe os novos
  // limites com Criar, que já nascem com a área calculada pela forma.

  /**
   * Remove o talhão selecionado do rascunho do mapa (botão "Excluir").
   *
   * ATENÇÃO (banco): nada é apagado aqui; a remoção só chega ao Supabase no
   * PUT /talhoes/geometrias disparado pelo botão Salvar, que arquiva o código.
   * @returns {void}
   */
  function excluirTalhaoSelecionado() {
    if (!modoEdicao || talhoes.length <= 1) return;

    talhoes = talhoes.filter((feature) => feature.properties.codigo !== talhaoSelecionado);
    talhaoSelecionado = talhoes[0]?.properties.codigo || "";
    selecionarTalhao(talhaoSelecionado);
    atualizarSelectCadastro();
    exibirMensagemEdicao("Talhão removido do rascunho. Clique em Salvar para confirmar.");
  }

  /**
   * Lê a área em hectares já gravada na feature do talhão.
   *
   * O cálculo em si mora em FrutLogTalhoes (compartilhado com o editor do
   * Administrador), para que os dois painéis cheguem sempre ao mesmo número.
   * @param {object} feature - Feature GeoJSON do talhão.
   * @returns {number|null} Área positiva em hectares ou null quando não há.
   */
  function obterAreaHectares(feature) {
    const valor = feature.properties.area_hectares
      ?? String(feature.properties.area || "").replace(/[^\d,.-]/g, "").replace(",", ".");
    const area = Number(valor);
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  /**
   * Atualiza a área do talhão selecionado depois de arrastar pontos ou movê-lo.
   *
   * Substitui o par "Área do talhão (ha)" + "Aplicar área", removidos da barra:
   * a área acompanha a forma na mesma proporção, então um talhão já medido em
   * campo não perde o valor real por causa de um ajuste fino no desenho.
   * @param {Array<Array<number>>} pontosAnteriores - Vértices antes do arraste.
   * @returns {void}
   */
  function recalcularAreaTalhaoEditado(pontosAnteriores) {
    const feature = obterFeature(talhaoSelecionado);
    if (!feature) return;

    const area = FrutLogTalhoes.recalcularAreaAutomatica(feature, pontosAnteriores);
    if (area === null) return;
    preencherTexto("talhao-area", feature.properties.area);
  }

  /**
   * Persiste geometrias e áreas do mapa (botão "Salvar").
   *
   * ATENÇÃO (API): PUT /talhoes/geometrias grava o rascunho inteiro no Supabase
   * e devolve a versão oficial, que volta a alimentar os painéis. Talhão sem
   * área positiva é recusado pela rota, por isso a checagem antes do envio.
   * @returns {Promise<void>}
   */
  async function salvarAlteracoesMapa() {
    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    const dadosTalhoes = talhoes.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        area_hectares: obterAreaHectares(feature),
      },
    }));

    // A área é automática, mas um talhão sem limites desenhados não gera área:
    // nesse caso o desenho precisa ser concluído antes de salvar.
    if (dadosTalhoes.some((feature) => !feature.properties.area_hectares)) {
      exibirMensagemEdicao("Há talhão sem limites desenhados no mapa. Use Criar para fechar a forma antes de salvar.", "erro");
      return;
    }

    const botao = btnSalvar;
    if (botao) botao.disabled = true;
    try {
      if (!mapaApiPronto) throw new Error("As geometrias do servidor ainda não foram carregadas.");
      const removidos = [...codigosIniciais].filter((codigo) => !dadosTalhoes.some((feature) => feature.properties.codigo === codigo));
      const resposta = await FrutLog.apiFetch("/talhoes/geometrias", {
        method: "PUT",
        body: JSON.stringify({
          talhoes: dadosTalhoes,
          removidos,
        }),
      });
      // Os removidos acabaram de virar histórico: seus códigos seguem ocupados.
      FrutLogMapaTalhoes.adicionarCodigosArquivados(removidos);
      talhoes = FrutLogTalhoes.carregarDoServidor(resposta.talhoes || []);
      codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
      talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
      selecionarTalhao(talhaoSelecionado);
      atualizarSelectCadastro();
      atualizarControlesEdicao();
      renderizarBotoesTalhao();
      renderizarMapa();
      exibirMensagemEdicao("Geometrias e áreas salvas no banco. Os demais paineis receberao a atualizacao automaticamente.");
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      exibirMensagemEdicao(erro.message, "erro");
    } finally {
      if (botao && modoEdicao) botao.disabled = false;
    }
  }

  /**
   * Descarta o rascunho do mapa e volta para a última versão conhecida.
   *
   * O botão "Cancelar" saiu da barra de ferramentas; esta função passou a ser
   * chamada quando o usuário encerra a edição pelo botão "Editar talhão".
   * @returns {void}
   */
  function cancelarAlteracoesMapa() {
    talhoes = FrutLogTalhoes.obterTalhoes();
    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    atualizarControlesEdicao();
    selecionarTalhao(talhaoSelecionado);
    atualizarSelectCadastro();
    exibirMensagemEdicao("Modo de edição encerrado. As alterações não salvas foram descartadas.");
  }

  btnEncerrarCiclo?.addEventListener("click", async (evento) => {
    const botao = evento.currentTarget;
    const codigo = talhaoSelecionado;
    const ciclo = plantiosAtivos.find((item) => item.talhao === codigo);
    if (!codigo || !ciclo) return;
    if (!window.confirm(`Encerrar o ciclo atual do talh\u00e3o ${codigo}? Confira se todas as colheitas foram registradas.`)) return;
    botao.disabled = true;
    try {
      await FrutLog.apiFetch("/plantios/encerrar-ciclo", {
        method: "POST",
        body: JSON.stringify({ talhao: codigo, cicloId: ciclo.id }),
      });
      if (mensagemEncerramentoCiclo) {
        mensagemEncerramentoCiclo.textContent = `Ciclo encerrado. Agora voc\u00ea pode cadastrar outro produto para o talh\u00e3o ${codigo}.`;
        mensagemEncerramentoCiclo.className = "mensagem-feedback sucesso";
      }
      await carregarDadosPainel();
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      if (mensagemEncerramentoCiclo) {
        mensagemEncerramentoCiclo.textContent = erro.message;
        mensagemEncerramentoCiclo.className = "mensagem-feedback erro";
      }
    } finally {
      botao.disabled = false;
    }
  });
  /**
   * Cadastra um ciclo de plantio para o talhão escolhido.
   * ATENÇÃO (API): POST /plantios cria o ciclo no banco; depois recarregamos o
   * painel inteiro para que mapa, resumo e selects reflitam o novo ciclo.
   * @param {SubmitEvent} evento - Envio do formulário de plantio.
   * @returns {Promise<void>}
   */
  async function registrarPlantio(evento) {
    evento.preventDefault();

    // Validação pré-envio: evita bater na API com campo obrigatório vazio.
    if (!FrutLogFeedback.validarObrigatorios(formularioPlantio)) return;

    const dadosFormulario = Object.fromEntries(new FormData(formularioPlantio));
    const feature = obterFeature(dadosFormulario.talhao);

    if (!feature) {
      FrutLogFeedback.toast("Selecione um talhão válido antes de cadastrar o plantio.", "aviso");
      return;
    }

    const botao = formularioPlantio.querySelector('[type="submit"]');
    const liberarBotao = FrutLogFeedback.ocupar(botao, "Cadastrando...");
    try {
      await FrutLog.apiFetch("/plantios", {
        method: "POST",
        body: JSON.stringify(dadosFormulario),
      });
      await carregarDadosPainel();
      mensagemPlantio.textContent = "Plantio cadastrado no banco de dados.";
      mensagemPlantio.className = "mensagem-feedback sucesso";
      formularioPlantio.reset();
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      mensagemPlantio.textContent = erro.message;
      mensagemPlantio.className = "mensagem-feedback erro";
      FrutLogFeedback.toast(erro.message, "erro");
    } finally {
      liberarBotao();
    }
  }

  async function carregarDadosPainel() {
    const talhoesServidor = await FrutLogMapaTalhoes.carregarMapaTalhoes("engenheiro");
    talhoes = talhoesServidor;
    mapaApiPronto = true;
    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
    atualizarControlesEdicao();

    const [resultadoPainel, resultadoColheitas, resultadoTelemetria, resultadoPredador] = await Promise.allSettled([
      FrutLog.apiFetch("/painel-engenheiro"),
      FrutLog.apiFetch("/colheitas/anual"),
      FrutLog.apiFetch("/telemetria/diaria"),
      // Veredito do Predador (src/ia/predador-nucleo.js). Sem esta linha a tela
      // do Engenheiro julgava o talhao por conta propria, com uma regra mais
      // pobre: so temperatura, sem olhar umidade do solo, sem descartar leitura
      // velha e sem saber se o talhao ainda tem cultura plantada. O mesmo
      // talhao podia aparecer verde aqui e em ATENCAO no painel do Admin.
      FrutLog.apiFetch("/predador/analise"),
    ]);
    const erros = [];

    // Entregue ANTES de renderizar: aplicarMonitoramento() consulta estes
    // diagnosticos ao pintar cada talhao. Se a rota falhar, nao se avisa na
    // tela nem se interrompe o carregamento -- o calculo local de reserva
    // assume, e e melhor um mapa com a regra antiga que um mapa sem cor.
    if (resultadoPredador.status === "fulfilled") {
      FrutLogTalhoes.definirDiagnosticos(resultadoPredador.value.talhoes || []);
    }
    const painel = resultadoPainel.status === "fulfilled" ? resultadoPainel.value : {};
    plantiosAtivos = painel.plantios || [];
    atualizarResumoCicloAtual();
    if (resultadoPainel.status === "rejected") {
      erros.push(`Dados do painel: ${resultadoPainel.reason?.message || resultadoPainel.reason}`);
    }
    if (resultadoColheitas.status === "fulfilled") {
      colheitas = resultadoColheitas.value.colheitas || [];
    } else {
      colheitas = [];
      erros.push(`Histórico de colheitas: ${resultadoColheitas.reason?.message || resultadoColheitas.reason}`);
    }
    try {
      telemetriaMensalEsp32 = (await FrutLog.apiFetch("/telemetria/esp32-mensal")).mensal || [];
    } catch (erro) {
      telemetriaMensalEsp32 = [];
    }
    if (resultadoTelemetria.status === "fulfilled") {
      telemetriaMensalEngenheiro = resultadoTelemetria.value.mensal || [];
      telemetriaDiaria = resultadoTelemetria.value.leituras || [];
      renderizarGraficoClimaMensalEngenheiro();
    } else {
      telemetriaMensalEngenheiro = [];
      telemetriaDiaria = [];
      erros.push(`Telemetria: ${resultadoTelemetria.reason?.message || resultadoTelemetria.reason}`);
    }

    const sensoresPorTalhao = new Map();
    sensoresDoPainel = painel.sensores || [];
    (painel.sensores || []).forEach((sensor) => {
      if (!sensoresPorTalhao.has(sensor.talhao)) sensoresPorTalhao.set(sensor.talhao, []);
      sensoresPorTalhao.get(sensor.talhao).push(sensor);
    });
    const talhoesMonitorados = new Map((painel.talhoes || []).map((talhao) => [talhao.id, talhao]));
    const inspecaoPorTalhao = new Map();
    (painel.inspecoes || []).forEach((item) => {
      if (!inspecaoPorTalhao.has(item.talhao)) inspecaoPorTalhao.set(item.talhao, item);
    });
    const ciclosPorTalhao = new Map((painel.plantios || []).map((item) => [item.talhao, item]));

    talhoes = talhoesServidor.map((feature) => {
      const codigo = feature.properties.codigo;
      const sensores = sensoresPorTalhao.get(codigo) || [];
      const sensorPorTipo = (tipo) => sensores.find((sensor) => sensor.tipo === tipo && sensor.status !== "Inativo");
      const temperatura = sensorPorTipo("temperatura");
      const umidadeAr = sensorPorTipo("umidadeAr");
      const umidadeSolo = sensorPorTipo("umidadeSolo");
      const ciclo = ciclosPorTalhao.get(codigo);
      const leituraCampo = inspecaoPorTalhao.get(codigo);
      const resumo = talhoesMonitorados.get(codigo);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status: resumo?.situacao || "Sem leitura",
          prioridade: resumo?.prioridade || "Sem leitura registrada.",
          sensor: resumo?.sensor || sensores[0]?.sensor || "Não associado",
          dados_recentes: resumo?.dados_recentes === true,
          ultima_leitura_em: resumo?.ultima_leitura_em || null,
          produto: ciclo?.produto || "--",
          variedade: ciclo?.variedade || "--",
          solo: ciclo?.solo || "--",
          plantio: ciclo?.plantado_em || "--",
          colheita: ciclo?.previsao_colheita || "--",
          diaria: {
            temperatura: temperatura?.valor ?? null,
            umidadeAr: umidadeAr?.valor ?? null,
            umidadeSolo: umidadeSolo?.valor ?? null,
          },
          apontamentoTecnico: {
            data: leituraCampo?.data || "--",
            // Vinha fixo como "--" porque a rota nao mandava o nome. Agora
            // /painel-engenheiro resolve o usuario_id da inspecao, e o
            // engenheiro sabe com quem falar sobre o problema apontado.
            tecnico: leituraCampo?.tecnico || "--",
            problema: leituraCampo?.problemas || "Nenhuma inspeção registrada.",
            recomendacao: leituraCampo?.observacoes || "--",
          },
        },
      };
    });
    const resumoDadosRecentes = document.getElementById("resumo-dados-recentes");
    if (resumoDadosRecentes) {
      const semDados = talhoes.filter((feature) => !feature.properties.dados_recentes);
      resumoDadosRecentes.textContent = talhoes.length
        ? `${semDados.length} de ${talhoes.length} talhões sem leitura recente (últimos 5 minutos).${semDados.length ? ` Verifique: ${semDados.map((feature) => feature.properties.codigo).join(", ")}.` : ""}`
        : "Nenhum talhão ativo cadastrado.";
    }
    if (colheitas.length && !colheitas.some((item) => item.unidade === unidadeAtual)) {
      unidadeAtual = colheitas[0].unidade;
      filtrosGrafico.forEach((botao) => {
        botao.classList.toggle("active", botao.dataset.unidade === unidadeAtual);
      });
    }
    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    atualizarSelectCadastro();
    renderizarBotoesTalhao();
    if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
    else renderizarMapa();
    carregarGraficoColheita();

    // Painel de telemetria por talhao (js/frutlog-telemetria.js), o mesmo do
    // Administrador e do Tecnico. Entra no fim desta funcao porque e aqui que
    // `talhoes` ja esta preenchido -- os botoes sao os talhoes que o servidor
    // trouxe. Chamado a cada carga, entao talhao recem-criado ganha botao e
    // talhao arquivado perde o dele sem precisar de F5.
    if (typeof FrutLogTelemetria !== "undefined") {
      FrutLogTelemetria.montar({ containerId: "telemetria-talhao" });
      FrutLogTelemetria.definirTalhoes(talhoes);
    }

    renderizarSensores();
    carregarGraficoMetricas();

    if (erros.length) {
      exibirMensagemEdicao(`Talhões carregados. ${erros.join(" | ")}`, "erro");
    }
  }

  function atualizarResumoColheita() {
    const dados = colheitas.filter((item) => item.unidade === unidadeAtual);
    const chaves = ["ultima", "menor", "maior"];
    if (!dados.length) {
      chaves.forEach((chave) => {
        preencherTexto(`resumo-${chave}-data`, "--");
        preencherTexto(`resumo-${chave}-valor`, "--");
        preencherTexto(`resumo-${chave}-media`, "Média: --");
      });
      return;
    }
    const nomes = { t: "toneladas", sc: "sacas", kg: "kg", cx: "caixas" };
    const unidade = nomes[unidadeAtual] || unidadeAtual;
    const formatar = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    const media = dados.reduce((soma, item) => soma + Number(item.quantidade), 0) / dados.length;
    const escolhidos = {
      ultima: dados.reduce((a, b) => (a.ano > b.ano ? a : b)),
      menor: dados.reduce((a, b) => (Number(a.quantidade) < Number(b.quantidade) ? a : b)),
      maior: dados.reduce((a, b) => (Number(a.quantidade) > Number(b.quantidade) ? a : b)),
    };
    chaves.forEach((chave) => {
      preencherTexto(`resumo-${chave}-data`, String(escolhidos[chave].ano));
      preencherTexto(`resumo-${chave}-valor`, `${formatar(escolhidos[chave].quantidade)} ${unidade}`);
      preencherTexto(`resumo-${chave}-media`, `Média: ${formatar(media)} ${unidade}`);
    });
  }

  function carregarGraficoColheita() {
    const canvas = document.getElementById("graficoColheita");
    if (!canvas || typeof Chart === "undefined") return;

    if (graficoColheita) graficoColheita.destroy();
    const dados = colheitas.filter((item) => item.unidade === unidadeAtual);
    const rotulosUnidade = { t: "Toneladas", sc: "Sacas", kg: "Quilogramas", cx: "Caixas" };
    const rotulo = rotulosUnidade[unidadeAtual] || unidadeAtual;
    const mensagem = document.getElementById("mensagem-colheita");
    if (!dados.length) {
      graficoColheita = null;
      if (mensagem) mensagem.textContent = "Ainda não há dados de colheita para esta unidade.";
      atualizarResumoColheita();
      return;
    }
    if (mensagem) mensagem.textContent = "";

    graficoColheita = new Chart(canvas, {
      type: "bar",
      data: {
        labels: dados.map((item) => item.ano),
        datasets: [{
          label: rotulo,
          data: dados.map((item) => item.quantidade),
          backgroundColor: "#2e7d32",
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    atualizarResumoColheita();
  }

  // Barra do mapa: apenas Editar talhao, Criar, Salvar e Excluir.
  btnEditar?.addEventListener("click", ativarOuDesativarEdicao);
  btnCriar?.addEventListener("click", iniciarCriacao);
  btnExcluir?.addEventListener("click", excluirTalhaoSelecionado);
  btnSalvar?.addEventListener("click", salvarAlteracoesMapa);

  svgMapa?.addEventListener("click", (evento) => {
    if (!modoCriacao) return;

    // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: um clique cria um retangulo de 8 pontos
    pontosCriacao = retanguloComOitoPontos(obterPontoSvg(evento));
    concluirCriacao();
    // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  });

  svgMapa?.addEventListener("dblclick", (evento) => {
    evento.preventDefault();
    concluirCriacao();
  });

  // Guarda a forma antes do arraste para recalcular a área ao soltar o ponto.
  let pontosAntesDoArraste = null;

  window.addEventListener("pointermove", (evento) => {
    if ((verticeArrastado !== null || talhaoArrastado !== null) && !pontosAntesDoArraste) {
      const feature = obterFeature(talhaoSelecionado);
      if (feature) pontosAntesDoArraste = obterPontos(feature).map((ponto) => [...ponto]);
    }
    atualizarVertice(evento);
    moverTalhao(evento);
  });
  window.addEventListener("pointerup", () => {
    // Soltou o ponto: a área em hectares acompanha a nova forma do talhão.
    if (pontosAntesDoArraste) recalcularAreaTalhaoEditado(pontosAntesDoArraste);
    pontosAntesDoArraste = null;
    verticeArrastado = null;
    talhaoArrastado = null;
  });

  filtrosGrafico.forEach((botao) => {
    botao.addEventListener("click", () => {
      unidadeAtual = botao.dataset.unidade;
      filtrosGrafico.forEach((item) => item.classList.toggle("active", item === botao));
      carregarGraficoColheita();
    });
  });

  document.getElementById("talhao")?.addEventListener("change", () => {
    atualizarSensoresDoTalhao();
    atualizarResumoCicloAtual();
  });
  formularioPlantio?.addEventListener("submit", registrarPlantio);
  document.getElementById("filtro-metrica-tecnico")?.addEventListener("change", carregarGraficoMetricas);
  document.getElementById("filtro-talhao-metrica-tecnico")?.addEventListener("change", carregarGraficoMetricas);
  window.addEventListener("frutlog:colheitas-atualizadas", async () => {
    try {
      await carregarDadosPainel();
      preencherTexto("mensagem-colheita", "Colheita registrada e graficos atualizados.");
    } catch (erro) {
      preencherTexto("mensagem-colheita", erro.message);
    }
  });
  window.addEventListener("frutlog:talhoes-atualizados", async () => {
    if (modoEdicao) return;
    try {
      await carregarDadosPainel();
    } catch (erro) {
      exibirMensagemEdicao(`Falha ao sincronizar talhões: ${erro.message}`, "erro");
    }
  });

  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    try {
      await carregarDadosPainel();
    } catch (erro) {
      // A failure in other dashboard data must not disable an already loaded map.
      exibirMensagemEdicao(`Não foi possível carregar os dados do servidor: ${erro.message}`, "erro");
    }
  }

  atualizarControlesEdicao();
  atualizarSelectCadastro();
  renderizarBotoesTalhao();
  if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
  carregarGraficoColheita();

  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    window.setInterval(async () => {
      if (modoEdicao) return;
      try {
        await carregarDadosPainel();
      } catch (erro) {
        console.error("Falha ao atualizar o painel do Engenheiro:", erro);
        exibirMensagemEdicao(`Falha ao sincronizar o painel: ${erro.message}`, "erro");
      }
    }, 15000);
  }
});
