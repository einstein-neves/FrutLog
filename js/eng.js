/* =========================================================
   FRUTLOG - ENGENHEIRO AGRONOMO
   Monitoramento, edicao de talhoes, telemetria e plantio.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  FrutLog.verificarSessao(["engenheiro"]);
  FrutLog.configurarLogout();
  FrutLog.configurarAbasSidebar();

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
  const campoAreaTalhao = document.getElementById("talhao-area-hectares");
  const btnAplicarArea = document.getElementById("btn-aplicar-area-talhao");

  let talhoes = FrutLogTalhoes.obterTalhoes();
  let talhaoSelecionado = talhoes[0]?.properties.codigo || "";
  let codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
  let mapaApiPronto = !FrutLog.AUTENTICACAO_API_ATIVA;
  let modoEdicao = false;
  let modoCriacao = false;
  let modoDivisao = false;
  let pontosCriacao = [];
  let codigoGeometriaPendente = "";
  let pontosDivisao = [];
  let verticeArrastado = null;
  let talhaoArrastado = null;
  let graficoColheita = null;
  let unidadeAtual = "t";
  let sensoresDoPainel = [];

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

    const pendentes = talhoes.filter((feature) => feature.properties.geometriaPendente).length;
    preencherTexto(
      "mensagem-geometria-talhoes",
      pendentes ? `${pendentes} talhao(es) ainda sem geometria. Selecione cada um e use Criar para desenhar seus limites.` : ""
    );

    FrutLogMapaTalhoes.renderizarMapaTalhoes(svgMapa, talhoes, {
      selectedCode: talhaoSelecionado,
      statusFor: atualizarStatusTalhao,
      onSelect: (feature, evento) => {
        if (modoCriacao || modoDivisao) return;
        evento.stopPropagation();
        if (!talhaoArrastado?.moveu) selecionarTalhao(feature.properties.codigo);
      },
      onPolygon: (poligono, feature) => {
        const codigo = feature.properties.codigo;
        poligono.addEventListener("pointerdown", (evento) => {
          if (!modoEdicao || modoCriacao || modoDivisao || codigo !== talhaoSelecionado) return;
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
    select.innerHTML = `<option value="">${opcoes ? "Selecione o talhao" : "Nenhum talhao carregado"}</option>${opcoes}`;
    if (talhoes.some((feature) => feature.properties.codigo === atual)) select.value = atual;
    atualizarSensoresDoTalhao();
  }

  function atualizarSensoresDoTalhao() {
    const select = document.getElementById("sensor-associado");
    if (!select) return;
    const codigoTalhao = document.getElementById("talhao")?.value;
    const sensores = sensoresDoPainel.filter((sensor) => sensor.talhao === codigoTalhao && sensor.ativo);
    if (!sensores.length) {
      select.innerHTML = '<option>Nenhum sensor ativo cadastrado para este talhao</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = sensores.map((sensor) => {
      const situacao = sensor.status === "Online" ? "Online" : "Cadastrado, aguardando leitura";
      return `<option>${sensor.sensor} - ${sensor.tipo} (${situacao})</option>`;
    }).join("");
    select.disabled = false;
  }

  function atualizarControlesEdicao() {
    const habilitarFerramentas = modoEdicao;

    [btnCriar, btnDividir, btnExcluir, btnSalvar, btnCancelar].forEach((botao) => {
      if (botao) botao.disabled = !habilitarFerramentas;
    });

    btnEditar?.classList.toggle("active", modoEdicao);
    if (btnEditar) btnEditar.disabled = !mapaApiPronto;
    if (btnEditar) btnEditar.textContent = modoEdicao ? "Encerrar Edicao" : "Editar Talhoes";
    if (btnAplicarArea) btnAplicarArea.disabled = !modoEdicao || !talhaoSelecionado;
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
    if (campoAreaTalhao) campoAreaTalhao.value = String(obterAreaHectares(feature) || "");

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

    const areaInicial = Number(campoAreaTalhao?.value);
    const codigo = codigoGeometriaPendente || gerarCodigoNovo();
    const geometria = { type: "Polygon", coordinates: [FrutLogTalhoes.fecharAnel(pontosCriacao)] };
    if (codigoGeometriaPendente) {
      const feature = obterFeature(codigoGeometriaPendente);
      feature.geometry = geometria;
      feature.properties.geometriaPendente = false;
      if (Number.isFinite(areaInicial) && areaInicial > 0) {
        feature.properties.area_hectares = areaInicial;
        feature.properties.area = `${areaInicial} hectares`;
      }
    } else {
      talhoes.push(FrutLogTalhoes.criarFeature(codigo, pontosCriacao, {
        ...(Number.isFinite(areaInicial) && areaInicial > 0
          ? { area_hectares: areaInicial, area: `${areaInicial} hectares` }
          : {}),
      }));
    }
    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    selecionarTalhao(codigo);
    atualizarSelectCadastro();
    exibirMensagemEdicao(`Geometria do talhao ${codigo} atualizada. Clique em Salvar para persistir.`);
  }

  function ativarOuDesativarEdicao() {
    modoEdicao = !modoEdicao;
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    pontosDivisao = [];
    verticeArrastado = null;
    talhaoArrastado = null;
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao(modoEdicao ? "Modo de edicao ativado." : "Modo de edicao desativado.");
  }

  function iniciarCriacao() {
    if (!modoEdicao) return;
    const featureSelecionada = obterFeature(talhaoSelecionado);
    codigoGeometriaPendente = featureSelecionada && obterPontos(featureSelecionada).length < 3
      ? talhaoSelecionado
      : "";
    modoCriacao = true;
    modoDivisao = false;
    pontosCriacao = [];
    pontosDivisao = [];
    atualizarControlesEdicao();
    renderizarMapa();
    exibirMensagemEdicao(
      codigoGeometriaPendente
        ? `Desenhe os limites do talhao ${codigoGeometriaPendente}. Dê dois cliques para finalizar.`
        : "Clique no mapa para adicionar pontos. Dê dois cliques para finalizar."
    );
  }

  function iniciarDivisao() {
    if (!modoEdicao || !talhaoSelecionado) return;

    modoCriacao = false;
    modoDivisao = !modoDivisao;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
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
    const areaBase = obterAreaHectares(feature);
    const areaUm = calcularAreaPoligono(parteUm);
    const areaDois = calcularAreaPoligono(parteDois);
    if (areaBase && areaUm + areaDois > 0) {
      const hectaresUm = areaBase * areaUm / (areaUm + areaDois);
      const hectaresDois = areaBase - hectaresUm;
      novoUm.properties.area_hectares = hectaresUm;
      novoUm.properties.area = `${hectaresUm.toFixed(2)} hectares`;
      novoDois.properties.area_hectares = hectaresDois;
      novoDois.properties.area = `${hectaresDois.toFixed(2)} hectares`;
    }
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

  function obterAreaHectares(feature) {
    const valor = feature.properties.area_hectares
      ?? String(feature.properties.area || "").replace(/[^\d,.-]/g, "").replace(",", ".");
    const area = Number(valor);
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  function calcularAreaPoligono(pontos) {
    return Math.abs(pontos.reduce((soma, ponto, indice) => {
      const proximo = pontos[(indice + 1) % pontos.length];
      return soma + ponto[0] * proximo[1] - proximo[0] * ponto[1];
    }, 0)) / 2;
  }

  function aplicarAreaTalhao() {
    if (!modoEdicao) return;
    const feature = obterFeature(talhaoSelecionado);
    const area = Number(campoAreaTalhao?.value);
    if (!feature || !Number.isFinite(area) || area <= 0) {
      exibirMensagemEdicao("Informe uma area valida, maior que zero hectares.", "erro");
      campoAreaTalhao?.focus();
      return;
    }
    feature.properties.area_hectares = area;
    feature.properties.area = `${area} hectares`;
    preencherTexto("talhao-area", feature.properties.area);
    exibirMensagemEdicao(`Area do talhao ${talhaoSelecionado} atualizada no rascunho.`);
  }

  async function salvarAlteracoesMapa() {
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    pontosDivisao = [];
    const dadosTalhoes = talhoes.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        area_hectares: obterAreaHectares(feature),
      },
    }));

    if (dadosTalhoes.some((feature) => !feature.properties.area_hectares)) {
      exibirMensagemEdicao("Defina a area em hectares de todos os talhoes antes de salvar.", "erro");
      return;
    }

    const botao = btnSalvar;
    if (botao) botao.disabled = true;
    try {
      if (!mapaApiPronto) throw new Error("As geometrias do servidor ainda nao foram carregadas.");
      const resposta = await FrutLog.apiFetch("/talhoes/geometrias", {
        method: "PUT",
        body: JSON.stringify({
          talhoes: dadosTalhoes,
          removidos: [...codigosIniciais].filter((codigo) => !dadosTalhoes.some((feature) => feature.properties.codigo === codigo)),
        }),
      });
      talhoes = FrutLogTalhoes.carregarDoServidor(resposta.talhoes || []);
      codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
      talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
      selecionarTalhao(talhaoSelecionado);
      atualizarSelectCadastro();
      atualizarControlesEdicao();
      renderizarBotoesTalhao();
      renderizarMapa();
      exibirMensagemEdicao("Geometrias e areas salvas no banco. Os demais paineis receberao a atualizacao automaticamente.");
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      exibirMensagemEdicao(erro.message, "erro");
    } finally {
      if (botao && modoEdicao) botao.disabled = false;
    }
  }

  function cancelarAlteracoesMapa() {
    talhoes = FrutLogTalhoes.obterTalhoes();
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
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

    const botao = formularioPlantio.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
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
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  async function carregarDadosPainel() {
    const talhoesServidor = await FrutLogMapaTalhoes.carregarMapaTalhoes("engenheiro");
    talhoes = talhoesServidor;
    mapaApiPronto = true;
    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    codigosIniciais = new Set(talhoes.map((feature) => feature.properties.codigo));
    atualizarSelectCadastro();
    renderizarBotoesTalhao();
    if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
    else renderizarMapa();
    atualizarControlesEdicao();

    const [resultadoPainel, resultadoColheitas] = await Promise.allSettled([
      FrutLog.apiFetch("/painel-engenheiro"),
      FrutLog.apiFetch("/colheitas/anual"),
    ]);
    const erros = [];
    const painel = resultadoPainel.status === "fulfilled" ? resultadoPainel.value : {};
    if (resultadoPainel.status === "rejected") {
      erros.push(`Dados do painel: ${resultadoPainel.reason?.message || resultadoPainel.reason}`);
    }
    if (resultadoColheitas.status === "fulfilled") {
      colheitas = resultadoColheitas.value.colheitas || [];
    } else {
      colheitas = [];
      erros.push(`Historico de colheitas: ${resultadoColheitas.reason?.message || resultadoColheitas.reason}`);
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
      const chuva = sensorPorTipo("chuva");
      const ciclo = ciclosPorTalhao.get(codigo);
      const leituraCampo = inspecaoPorTalhao.get(codigo);
      const resumo = talhoesMonitorados.get(codigo);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status: resumo?.situacao || "Sem leitura",
          prioridade: resumo?.prioridade || "Sem leitura registrada.",
          sensor: resumo?.sensor || sensores[0]?.sensor || "Nao associado",
          produto: ciclo?.produto || "--",
          variedade: ciclo?.variedade || "--",
          solo: ciclo?.solo || "--",
          plantio: ciclo?.plantado_em || "--",
          colheita: ciclo?.previsao_colheita || "--",
          diaria: {
            temperatura: temperatura?.valor ?? null,
            umidadeAr: umidadeAr?.valor ?? null,
            umidadeSolo: umidadeSolo?.valor ?? null,
            chuva: chuva?.valor ?? null,
          },
          mensal: [],
          apontamentoTecnico: {
            data: leituraCampo?.data || "--",
            tecnico: "--",
            problema: leituraCampo?.problemas || "Nenhuma inspecao registrada.",
            recomendacao: leituraCampo?.observacoes || "--",
          },
          monitoramento: {
            temperaturaAtual: temperatura?.valor ?? null,
            temperaturaMaxima: null,
          },
        },
      };
    });
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
    if (erros.length) {
      exibirMensagemEdicao(`Talhoes carregados. ${erros.join(" | ")}`, "erro");
    }
  }

  function atualizarResumoColheita() {
    const unidades = colheitas.filter((item) => item.unidade === unidadeAtual);
    if (!unidades.length) {
      ["resumo-ultima-data", "resumo-ultima-valor", "resumo-menor-data", "resumo-menor-valor", "resumo-maior-data", "resumo-maior-valor"].forEach((id) => preencherTexto(id, "--"));
      ["resumo-ultima-media", "resumo-menor-media", "resumo-maior-media"].forEach((id) => preencherTexto(id, ""));
      return;
    }
    const menor = unidades.reduce((a, b) => a.quantidade < b.quantidade ? a : b);
    const maior = unidades.reduce((a, b) => a.quantidade > b.quantidade ? a : b);
    const ultima = unidades.reduce((a, b) => a.ano > b.ano ? a : b);
    const unidade = unidadeAtual === "sc" ? "sacas" : unidadeAtual === "t" ? "toneladas" : unidadeAtual;

    preencherTexto("resumo-ultima-data", ultima.ano);
    preencherTexto("resumo-ultima-valor", `${ultima.quantidade} ${unidade}`);
    preencherTexto("resumo-menor-data", menor.ano);
    preencherTexto("resumo-menor-valor", `${menor.quantidade} ${unidade}`);
    preencherTexto("resumo-maior-data", maior.ano);
    preencherTexto("resumo-maior-valor", `${maior.quantidade} ${unidade}`);
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
      if (mensagem) mensagem.textContent = "Ainda nao ha dados de colheita para esta unidade.";
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

  btnEditar?.addEventListener("click", ativarOuDesativarEdicao);
  btnCriar?.addEventListener("click", iniciarCriacao);
  btnDividir?.addEventListener("click", iniciarDivisao);
  btnExcluir?.addEventListener("click", excluirTalhaoSelecionado);
  btnSalvar?.addEventListener("click", salvarAlteracoesMapa);
  btnCancelar?.addEventListener("click", cancelarAlteracoesMapa);
  btnAplicarArea?.addEventListener("click", aplicarAreaTalhao);

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

  document.getElementById("talhao")?.addEventListener("change", atualizarSensoresDoTalhao);
  formularioPlantio?.addEventListener("submit", registrarPlantio);
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
      exibirMensagemEdicao(`Falha ao sincronizar talhoes: ${erro.message}`, "erro");
    }
  });

  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    try {
      await carregarDadosPainel();
    } catch (erro) {
      mapaApiPronto = false;
      exibirMensagemEdicao(`Nao foi possivel carregar os dados do servidor: ${erro.message}`, "erro");
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
