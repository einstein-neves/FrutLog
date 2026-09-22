/* =========================================================
   FRUTLOG - ENGENHEIRO AGRONOMO
   Monitoramento, edicao de talhoes, telemetria e plantio.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  FrutLog.verificarSessao(["engenheiro"]);
  FrutLog.configurarLogout();

  const svgMapa = document.getElementById("camada-talhoes");
  const mapaContainer = document.querySelector(".mapa-container");
  const botoesTalhao = document.getElementById("botoes-talhao");
  const formularioPlantio = document.getElementById("formulario-plantio");
  const mensagemPlantio = document.getElementById("mensagem-plantio");
  const mensagemEdicao = document.getElementById("mensagem-edicao-talhao");
  const filtrosGrafico = document.querySelectorAll(".btn-filtro[data-unidade]");
  const btnEditar = document.getElementById("btn-editar-talhoes");
  const btnCriar = document.getElementById("btn-criar-talhao");
  const btnDividir = document.getElementById("btn-dividir-talhao");
  const btnExcluir = document.getElementById("btn-excluir-talhao");
  const btnSalvar = document.getElementById("btn-salvar-talhao");
  const btnCancelar = document.getElementById("btn-cancelar-talhao");

  let talhoes = FrutLogTalhoes.obterTalhoes();
  let talhaoSelecionado = talhoes[0]?.properties.codigo || "";
  let modoEdicao = false;
  let modoCriacao = false;
  let modoDivisao = false;
  let pontosCriacao = [];
  let pontosDivisao = [];
  let verticeArrastado = null;
  let talhaoArrastado = null;
  let graficoColheita = null;
  let unidadeAtual = "toneladas";

  const colheitas = [
    { ano: "2022", toneladas: 72, media: "0,20 t/dia" },
    { ano: "2023", toneladas: 84, media: "0,23 t/dia" },
    { ano: "2024", toneladas: 79, media: "0,22 t/dia" },
    { ano: "2025", toneladas: 91, media: "0,25 t/dia" },
    { ano: "2026", toneladas: 105, media: "0,29 t/dia" },
  ];

  function classeStatus(status) {
    return String(status).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function formatarData(dataISO) {
    if (!dataISO) return "--";
    const [ano, mes, dia] = dataISO.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataISO;
  }

  function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  }

  function obterFeature(codigo) {
    return talhoes.find((feature) => feature.properties.codigo === codigo);
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

    svgMapa.innerHTML = "";

    talhoes.forEach((feature) => {
      const codigo = feature.properties.codigo;
      const status = atualizarStatusTalhao(feature);
      const poligono = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

      poligono.setAttribute("points", pontosParaString(obterPontos(feature)));
      poligono.dataset.talhao = codigo;
      poligono.classList.add("talhao-mapa", `status-${classeStatus(status)}`);
      poligono.classList.toggle("selecionado", codigo === talhaoSelecionado);
      poligono.addEventListener("click", (evento) => {
        if (modoCriacao || modoDivisao) return;
        evento.stopPropagation();
        if (!talhaoArrastado?.moveu) selecionarTalhao(codigo);
      });
      poligono.addEventListener("pointerdown", (evento) => {
        if (!modoEdicao || modoCriacao || modoDivisao || codigo !== talhaoSelecionado) return;
        evento.preventDefault();
        talhaoArrastado = {
          codigo,
          origem: obterPontoSvg(evento),
          moveu: false,
        };
      });

      svgMapa.appendChild(poligono);

      if (modoEdicao && codigo === talhaoSelecionado) {
        renderizarVertices(feature);
      }
    });

    if (modoCriacao && pontosCriacao.length > 0) {
      const rascunho = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      rascunho.setAttribute("points", pontosParaString(pontosCriacao));
      rascunho.classList.add("poligono-rascunho");
      svgMapa.appendChild(rascunho);
    }

    if (modoDivisao && pontosDivisao.length > 0) {
      const linhaDivisao = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      linhaDivisao.setAttribute("points", pontosParaString(pontosDivisao));
      linhaDivisao.classList.add("linha-divisao-talhao");
      svgMapa.appendChild(linhaDivisao);
    }
  }

  function renderizarVertices(feature) {
    const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grupo.dataset.verticesTalhao = feature.properties.codigo;

    obterPontos(feature).forEach((ponto, index) => {
      const vertice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      vertice.setAttribute("cx", ponto[0]);
      vertice.setAttribute("cy", ponto[1]);
      vertice.setAttribute("r", "5");
      vertice.classList.add("ponto-arrastavel");
      vertice.dataset.index = String(index);
      vertice.addEventListener("pointerdown", (evento) => {
        evento.preventDefault();
        verticeArrastado = { codigo: feature.properties.codigo, index };
      });
      grupo.appendChild(vertice);
    });

    svgMapa.appendChild(grupo);
  }

  function atualizarSelectCadastro() {
    const select = document.getElementById("talhao");
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o talhao</option>' + talhoes
      .map((feature) => `<option value="${feature.properties.codigo}">${feature.properties.codigo}</option>`)
      .join("");
  }

  function atualizarControlesEdicao() {
    const habilitarFerramentas = modoEdicao;

    [btnCriar, btnDividir, btnExcluir, btnSalvar, btnCancelar].forEach((botao) => {
      if (botao) botao.disabled = !habilitarFerramentas;
    });

    btnEditar?.classList.toggle("active", modoEdicao);
    if (btnEditar) btnEditar.textContent = modoEdicao ? "Encerrar Edicao" : "Editar Talhoes";
    btnCriar?.classList.toggle("active", modoCriacao);
    btnDividir?.classList.toggle("active", modoDivisao);
    if (btnDividir) btnDividir.textContent = modoDivisao ? "Divisao Ativa" : "Dividir";
    mapaContainer?.classList.toggle("modo-edicao", modoEdicao);
    mapaContainer?.classList.toggle("modo-divisao", modoDivisao);
  }

  function exibirMensagemEdicao(texto, tipo = "sucesso") {
    if (!mensagemEdicao) return;
    mensagemEdicao.textContent = texto;
    mensagemEdicao.className = `mensagem-feedback ${tipo}`;
  }

  function selecionarTalhao(codigo) {
    const feature = obterFeature(codigo);
    if (!feature) return;

    talhaoSelecionado = codigo;
    const props = feature.properties;
    const status = atualizarStatusTalhao(feature);

    preencherTexto("titulo-talhao", `Detalhes: Talhao ${codigo}`);
    preencherTexto("talhao-area", props.area);
    preencherTexto("talhao-solo", props.solo);
    preencherTexto("talhao-plantio", props.plantio);
    preencherTexto("talhao-colheita", props.colheita);
    preencherTexto("talhao-produto", props.produto);
    preencherTexto("talhao-variedade", props.variedade);
    preencherTexto("talhao-temperatura-maxima", `${props.parametros?.temperaturaMaxima ?? "--"} C`);
    preencherTexto("talhao-inspecao-data", props.apontamentoTecnico?.data || "--");
    preencherTexto("talhao-inspecao-tecnico", props.apontamentoTecnico?.tecnico || "--");
    preencherTexto("talhao-inspecao-problema", props.apontamentoTecnico?.problema || "--");
    preencherTexto("talhao-inspecao-recomendacao", props.apontamentoTecnico?.recomendacao || "--");

    const badge = document.getElementById("talhao-status");
    if (badge) {
      badge.textContent = status;
      badge.className = `badge-status ${classeStatus(status)}`;
    }

    atualizarTabelaDiaria(props.diaria || {});
    atualizarTabelaMensal(props.mensal || []);
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
        <td>${dados.chuva || "--"}</td>
      </tr>
    `;
  }

  function atualizarTabelaMensal(dadosMensais) {
    const tabela = document.getElementById("tabela-talhao-mensal");
    if (!tabela) return;

    if (!dadosMensais.length) {
      tabela.innerHTML = '<tr><td colspan="6">Sem consolidado mensal para este talhao.</td></tr>';
      return;
    }

    tabela.innerHTML = dadosMensais.map((item) => `
      <tr>
        <td>${item.temp}</td>
        <td>${item.umidAr}</td>
        <td>${item.umidSolo}</td>
        <td>${item.chuva}</td>
        <td>${item.prev}</td>
        <td>${item.qtd}</td>
      </tr>
    `).join("");
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

  function gerarCodigoNovo() {
    let indice = talhoes.length + 1;
    let codigo = `T${indice}`;

    while (obterFeature(codigo)) {
      indice += 1;
      codigo = `T${indice}`;
    }

    return codigo;
  }

  function concluirCriacao() {
    if (!modoCriacao || pontosCriacao.length < 3) {
      exibirMensagemEdicao("Adicione pelo menos tres pontos para criar um talhao.", "erro");
      return;
    }

    const codigo = gerarCodigoNovo();
    const novoTalhao = FrutLogTalhoes.criarFeature(codigo, pontosCriacao);
    talhoes.push(novoTalhao);
    modoCriacao = false;
    pontosCriacao = [];
    selecionarTalhao(codigo);
    atualizarSelectCadastro();
    exibirMensagemEdicao(`Talhao ${codigo} criado. Clique em Salvar para preparar a persistencia.`);
  }

  function ativarOuDesativarEdicao() {
    modoEdicao = !modoEdicao;
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    pontosDivisao = [];
    verticeArrastado = null;
    talhaoArrastado = null;
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao(modoEdicao ? "Modo de edicao ativado." : "Modo de edicao desativado.");
  }

  function iniciarCriacao() {
    if (!modoEdicao) return;
    modoCriacao = true;
    modoDivisao = false;
    pontosCriacao = [];
    pontosDivisao = [];
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao("Clique no mapa para adicionar pontos. Dê dois cliques para finalizar.");
  }

  function iniciarDivisao() {
    if (!modoEdicao || !talhaoSelecionado) return;

    modoCriacao = false;
    modoDivisao = !modoDivisao;
    pontosCriacao = [];
    pontosDivisao = [];
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao(
      modoDivisao
        ? `Clique em dois pontos atravessando o talhao ${talhaoSelecionado} para dividir.`
        : "Divisao cancelada."
    );
  }

  function ladoDaLinha(ponto, linhaInicio, linhaFim) {
    return ((linhaFim[0] - linhaInicio[0]) * (ponto[1] - linhaInicio[1]))
      - ((linhaFim[1] - linhaInicio[1]) * (ponto[0] - linhaInicio[0]));
  }

  function calcularIntersecaoLinha(inicio, fim, linhaInicio, linhaFim) {
    const distanciaInicio = ladoDaLinha(inicio, linhaInicio, linhaFim);
    const distanciaFim = ladoDaLinha(fim, linhaInicio, linhaFim);
    const divisor = distanciaInicio - distanciaFim;

    if (divisor === 0) return fim;

    const proporcao = distanciaInicio / divisor;
    return [
      Math.round(inicio[0] + (fim[0] - inicio[0]) * proporcao),
      Math.round(inicio[1] + (fim[1] - inicio[1]) * proporcao),
    ];
  }

  function recortarPoligonoPorLinha(pontos, linhaInicio, linhaFim, manterPositivo) {
    const resultado = [];

    pontos.forEach((fim, index) => {
      const inicio = pontos[(index - 1 + pontos.length) % pontos.length];
      const inicioLado = ladoDaLinha(inicio, linhaInicio, linhaFim);
      const fimLado = ladoDaLinha(fim, linhaInicio, linhaFim);
      const inicioDentro = manterPositivo ? inicioLado >= 0 : inicioLado <= 0;
      const fimDentro = manterPositivo ? fimLado >= 0 : fimLado <= 0;

      if (fimDentro) {
        if (!inicioDentro) resultado.push(calcularIntersecaoLinha(inicio, fim, linhaInicio, linhaFim));
        resultado.push(fim);
      } else if (inicioDentro) {
        resultado.push(calcularIntersecaoLinha(inicio, fim, linhaInicio, linhaFim));
      }
    });

    return removerPontosDuplicados(resultado);
  }

  function removerPontosDuplicados(pontos) {
    return pontos.filter((ponto, index) => {
      const anterior = pontos[index - 1];
      const primeiro = index === pontos.length - 1 ? pontos[0] : null;
      const repeteAnterior = anterior && anterior[0] === ponto[0] && anterior[1] === ponto[1];
      const repetePrimeiro = primeiro && primeiro[0] === ponto[0] && primeiro[1] === ponto[1];
      return !repeteAnterior && !repetePrimeiro;
    });
  }

  function dividirTalhaoSelecionado(linhaInicio, linhaFim) {
    if (!modoEdicao) return;

    const feature = obterFeature(talhaoSelecionado);
    if (!feature) return;

    if (linhaInicio[0] === linhaFim[0] && linhaInicio[1] === linhaFim[1]) {
      exibirMensagemEdicao("Escolha dois pontos diferentes para dividir o talhao.", "erro");
      pontosDivisao = [];
      renderizarMapa();
      return;
    }

    const pontos = obterPontos(feature);
    const lados = pontos.map((ponto) => ladoDaLinha(ponto, linhaInicio, linhaFim));
    const atravessaTalhao = lados.some((lado) => lado > 0) && lados.some((lado) => lado < 0);

    if (!atravessaTalhao) {
      exibirMensagemEdicao("A linha precisa atravessar o interior do talhao selecionado.", "erro");
      pontosDivisao = [];
      renderizarMapa();
      return;
    }

    const parteUm = recortarPoligonoPorLinha(pontos, linhaInicio, linhaFim, true);
    const parteDois = recortarPoligonoPorLinha(pontos, linhaInicio, linhaFim, false);

    if (parteUm.length < 3 || parteDois.length < 3) {
      exibirMensagemEdicao("A linha precisa atravessar o talhao para gerar duas areas.", "erro");
      return;
    }

    const propriedadesBase = {
      ...feature.properties,
      sensor: "Nao associado",
      apontamentoTecnico: {
        data: "--",
        tecnico: "--",
        problema: "Talhao dividido. Sensor ainda nao associado.",
        recomendacao: "Associar sensor ao novo talhao.",
      },
      prioridade: "Associar sensor",
    };

    const codigoBase = feature.properties.codigo;
    const codigoUm = gerarCodigoFilho(codigoBase, 1);
    const codigoDois = gerarCodigoFilho(codigoBase, 2);
    const novoUm = FrutLogTalhoes.criarFeature(codigoUm, parteUm, propriedadesBase);
    const novoDois = FrutLogTalhoes.criarFeature(codigoDois, parteDois, propriedadesBase);
    novoUm.properties.codigo = codigoUm;
    novoDois.properties.codigo = codigoDois;

    talhoes = talhoes.filter((item) => item.properties.codigo !== codigoBase);
    talhoes.push(novoUm, novoDois);
    modoDivisao = false;
    pontosDivisao = [];
    atualizarControlesEdicao();
    selecionarTalhao(novoUm.properties.codigo);
    atualizarSelectCadastro();
    exibirMensagemEdicao(`${codigoBase} dividido em ${novoUm.properties.codigo} e ${novoDois.properties.codigo}. Clique em Salvar.`);
  }

  function gerarCodigoFilho(codigoBase, indiceInicial) {
    let indice = indiceInicial;
    let codigo = `${codigoBase}.${indice}`;

    while (obterFeature(codigo)) {
      indice += 1;
      codigo = `${codigoBase}.${indice}`;
    }

    return codigo;
  }

  function excluirTalhaoSelecionado() {
    if (!modoEdicao || talhoes.length <= 1) return;

    talhoes = talhoes.filter((feature) => feature.properties.codigo !== talhaoSelecionado);
    talhaoSelecionado = talhoes[0]?.properties.codigo || "";
    selecionarTalhao(talhaoSelecionado);
    atualizarSelectCadastro();
    exibirMensagemEdicao("Talhao removido do rascunho. Clique em Salvar para confirmar.");
  }

  function salvarAlteracoesMapa() {
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    pontosDivisao = [];
    talhoes = FrutLogTalhoes.substituirTalhoes(talhoes);
    atualizarControlesEdicao();
    renderizarBotoesTalhao();
    renderizarMapa();
    atualizarSelectCadastro();
    exibirMensagemEdicao("Alteracoes salvas no navegador. O Tecnico ja visualiza este rascunho.");
  }

  function cancelarAlteracoesMapa() {
    talhoes = FrutLogTalhoes.obterTalhoes();
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    pontosDivisao = [];
    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    atualizarControlesEdicao();
    selecionarTalhao(talhaoSelecionado);
    atualizarSelectCadastro();
    exibirMensagemEdicao("Alteracoes nao salvas foram descartadas.");
  }

  async function registrarPlantio(evento) {
    evento.preventDefault();

    const dadosFormulario = Object.fromEntries(new FormData(formularioPlantio));
    const feature = obterFeature(dadosFormulario.talhao);

    if (!feature) return;

    try {
      feature.properties = {
        ...feature.properties,
        produto: dadosFormulario.produto,
        variedade: dadosFormulario.variedade,
        area: `${dadosFormulario.area} hectares`,
        solo: dadosFormulario.solo,
        plantio: formatarData(dadosFormulario.dataPlantio),
        colheita: formatarData(dadosFormulario.dataColheita),
        sensor: dadosFormulario.sensor?.trim() || feature.properties.sensor || "Nao associado",
        parametros: {
          ...feature.properties.parametros,
          temperaturaMaxima: Number(dadosFormulario.temperaturaMaxima),
        },
      };

      talhoes = FrutLogTalhoes.substituirTalhoes(talhoes);
      selecionarTalhao(dadosFormulario.talhao);
      mensagemPlantio.textContent = "Cadastro preparado para envio ao backend e exibido nos detalhes do talhao.";
      mensagemPlantio.className = "mensagem-feedback sucesso";
      formularioPlantio.reset();
    } catch (erro) {
      mensagemPlantio.textContent = erro.message;
      mensagemPlantio.className = "mensagem-feedback erro";
    }
  }

  function atualizarResumoColheita() {
    const ordenadas = [...colheitas].sort((a, b) => a.toneladas - b.toneladas);
    const menor = ordenadas[0];
    const maior = ordenadas[ordenadas.length - 1];
    const ultima = colheitas[colheitas.length - 1];
    const fator = unidadeAtual === "sacas" ? 16.67 : 1;
    const sufixo = unidadeAtual === "sacas" ? "sacas" : "toneladas";

    preencherTexto("resumo-ultima-data", ultima.ano);
    preencherTexto("resumo-ultima-valor", `${Math.round(ultima.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-ultima-media", `Media: ${ultima.media}`);
    preencherTexto("resumo-menor-data", menor.ano);
    preencherTexto("resumo-menor-valor", `${Math.round(menor.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-menor-media", `Media: ${menor.media}`);
    preencherTexto("resumo-maior-data", maior.ano);
    preencherTexto("resumo-maior-valor", `${Math.round(maior.toneladas * fator)} ${sufixo}`);
    preencherTexto("resumo-maior-media", `Media: ${maior.media}`);
  }

  function carregarGraficoColheita() {
    const canvas = document.getElementById("graficoColheita");
    if (!canvas || typeof Chart === "undefined") return;

    const fator = unidadeAtual === "sacas" ? 16.67 : 1;
    const rotulo = unidadeAtual === "sacas" ? "Sacas" : "Toneladas";
    const valores = colheitas.map((item) => Math.round(item.toneladas * fator));

    if (graficoColheita) graficoColheita.destroy();

    graficoColheita = new Chart(canvas, {
      type: "bar",
      data: {
        labels: colheitas.map((item) => item.ano),
        datasets: [{
          label: rotulo,
          data: valores,
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

  btnEditar?.addEventListener("click", ativarOuDesativarEdicao);
  btnCriar?.addEventListener("click", iniciarCriacao);
  btnDividir?.addEventListener("click", iniciarDivisao);
  btnExcluir?.addEventListener("click", excluirTalhaoSelecionado);
  btnSalvar?.addEventListener("click", salvarAlteracoesMapa);
  btnCancelar?.addEventListener("click", cancelarAlteracoesMapa);

  svgMapa?.addEventListener("click", (evento) => {
    if (!modoCriacao && !modoDivisao) return;

    const ponto = obterPontoSvg(evento);

    if (modoDivisao) {
      pontosDivisao.push(ponto);

      if (pontosDivisao.length === 2) {
        dividirTalhaoSelecionado(pontosDivisao[0], pontosDivisao[1]);
        return;
      }

      renderizarMapa();
      exibirMensagemEdicao("Agora clique no segundo ponto da linha de divisao.");
      return;
    }

    pontosCriacao.push(ponto);
    renderizarMapa();
  });

  svgMapa?.addEventListener("dblclick", (evento) => {
    evento.preventDefault();
    concluirCriacao();
  });

  window.addEventListener("pointermove", (evento) => {
    atualizarVertice(evento);
    moverTalhao(evento);
  });
  window.addEventListener("pointerup", () => {
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

  formularioPlantio?.addEventListener("submit", registrarPlantio);

  atualizarControlesEdicao();
  atualizarSelectCadastro();
  renderizarBotoesTalhao();
  selecionarTalhao(talhaoSelecionado);
  carregarGraficoColheita();
});
