/* =========================================================
   FRUTLOG - EDITOR DE MAPA E TALHOES COMPARTILHADO
   Utilizado de forma idêntica por Administração e Engenharia.
   ========================================================= */

const FrutLogEditorMapaTalhoes = (() => {
  let configurado = false;
  let perfilAtual = "admin";
  let callbacks = {
    onTalhaoSelecionado: null,
    onTalhoesAtualizados: null,
    statusFor: null,
  };

  let talhoes = [];
  let talhaoSelecionado = "";
  let codigosIniciais = new Set();
  let codigosRemovidos = [];

  let modoEdicao = false;
  let modoCriacao = false;
  let modoDivisao = false;
  let pontosCriacao = [];
  let codigoGeometriaPendente = "";
  let pontosDivisao = [];
  let verticeArrastado = null;
  let talhaoArrastado = null;
  let salvando = false;

  function obterFeature(codigo) {
    return talhoes.find((feature) => feature.properties.codigo === codigo);
  }

  function obterPontos(feature) {
    return FrutLogTalhoes.obterPontos(feature);
  }

  function pontosParaString(pontos) {
    return pontos.map((ponto) => `${ponto[0]},${ponto[1]}`).join(" ");
  }

  function formatarData(dataISO) {
    if (!dataISO) return "--";
    const [ano, mes, dia] = String(dataISO).split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataISO;
  }

  function classeStatus(status) {
    return String(status || "normal")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");
  }

  function preencherTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor != null && valor !== "" ? valor : "--";
  }

  function exibirMensagemEdicao(texto, tipo = "sucesso") {
    const el = document.getElementById("mensagem-edicao-talhao");
    if (!el) return;
    el.textContent = texto;
    el.className = `mensagem-feedback ${tipo}`;
  }

  function obterPontoSvg(evento) {
    const svgMapa = document.getElementById("camada-talhoes");
    if (!svgMapa) return [0, 0];

    const ponto = svgMapa.createSVGPoint ? svgMapa.createSVGPoint() : null;
    const invertido = svgMapa.getScreenCTM ? svgMapa.getScreenCTM()?.inverse() : null;
    if (ponto && invertido) {
      ponto.x = evento.clientX;
      ponto.y = evento.clientY;
      const convertido = ponto.matrixTransform(invertido);
      return [
        Math.max(0, Math.min(500, Math.round(convertido.x))),
        Math.max(0, Math.min(400, Math.round(convertido.y))),
      ];
    }

    const rect = svgMapa.getBoundingClientRect();
    return [
      Math.max(0, Math.min(500, Math.round(((evento.clientX - rect.left) * 500) / rect.width))),
      Math.max(0, Math.min(400, Math.round(((evento.clientY - rect.top) * 400) / rect.height))),
    ];
  }

  function calcularAreaPoligono(pontos) {
    if (!Array.isArray(pontos) || pontos.length < 3) return 0;
    return (
      Math.abs(
        pontos.reduce((soma, ponto, indice) => {
          const proximo = pontos[(indice + 1) % pontos.length];
          return soma + ponto[0] * proximo[1] - proximo[0] * ponto[1];
        }, 0)
      ) / 2
    );
  }

  function obterAreaHectares(feature) {
    if (!feature) return 10.0;
    let valor = feature.properties?.area_hectares;
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      const parsed = Number(String(feature.properties?.area || "").replace(/[^\d,.-]/g, "").replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0) {
        valor = parsed;
      } else {
        const pontos = obterPontos(feature);
        if (pontos.length >= 3) {
          const areaPx = calcularAreaPoligono(pontos);
          valor = Number((areaPx / 1000).toFixed(2));
          if (!Number.isFinite(valor) || valor <= 0) valor = 10.0;
        } else {
          valor = 10.0;
        }
      }
    }
    const finalVal = Number(Number(valor).toFixed(2));
    feature.properties.area_hectares = finalVal;
    feature.properties.area = `${finalVal} hectares`;
    return finalVal;
  }

  function retanguloComOitoPontos(centro, largura = 90, altura = 70) {
    const limitar = (valor, maximo) => Math.min(Math.max(valor, 0), maximo);
    const esquerda = limitar(centro[0] - largura / 2, 500);
    const direita = limitar(centro[0] + largura / 2, 500);
    const topo = limitar(centro[1] - altura / 2, 400);
    const base = limitar(centro[1] + altura / 2, 400);
    const meioX = Math.round((esquerda + direita) / 2);
    const meioY = Math.round((topo + base) / 2);

    return [
      [Math.round(esquerda), Math.round(topo)],
      [meioX, Math.round(topo)],
      [Math.round(direita), Math.round(topo)],
      [Math.round(direita), meioY],
      [Math.round(direita), Math.round(base)],
      [meioX, Math.round(base)],
      [Math.round(esquerda), Math.round(base)],
      [Math.round(esquerda), meioY],
    ];
  }

  function ladoDaLinha(ponto, linhaInicio, linhaFim) {
    return (
      (linhaFim[0] - linhaInicio[0]) * (ponto[1] - linhaInicio[1]) -
      (linhaFim[1] - linhaInicio[1]) * (ponto[0] - linhaInicio[0])
    );
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

    return resultado.filter((ponto, index) => {
      const anterior = resultado[index - 1];
      const primeiro = index === resultado.length - 1 ? resultado[0] : null;
      const repeteAnterior = anterior && anterior[0] === ponto[0] && anterior[1] === ponto[1];
      const repetePrimeiro = primeiro && primeiro[0] === ponto[0] && primeiro[1] === ponto[1];
      return !repeteAnterior && !repetePrimeiro;
    });
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

  function gerarCodigoFilho(codigoBase, indiceInicial) {
    let indice = indiceInicial;
    let codigo = `${codigoBase}.${indice}`;
    while (codigoIndisponivel(codigo)) {
      indice += 1;
      codigo = `${codigoBase}.${indice}`;
    }
    return codigo;
  }

  function atualizarControlesEdicao() {
    const btnEditar = document.getElementById("btn-editar-talhoes");
    const btnCriar = document.getElementById("btn-criar-talhao");
    const btnConcluirDesenho = document.getElementById("btn-concluir-desenho");
    const btnDividir = document.getElementById("btn-dividir-talhao");
    const btnExcluir = document.getElementById("btn-excluir-talhao");
    const btnSalvar = document.getElementById("btn-salvar-talhao");
    const btnCancelar = document.getElementById("btn-cancelar-talhao");
    const campoArea = document.getElementById("talhao-area-hectares");
    const btnAplicarArea = document.getElementById("btn-aplicar-area-talhao");
    const mapaContainer = document.querySelector(".mapa-container");

    const habilitar = modoEdicao && !salvando;

    [btnCriar, btnDividir, btnExcluir, btnSalvar, btnCancelar].forEach((btn) => {
      if (btn) btn.disabled = !habilitar;
    });

    if (btnEditar) {
      btnEditar.disabled = salvando;
      btnEditar.classList.toggle("active", modoEdicao);
      btnEditar.textContent = modoEdicao ? "Encerrar Edição" : "Editar Talhões";
    }

    if (btnCriar) {
      btnCriar.classList.toggle("active", modoCriacao);
    }

    if (btnConcluirDesenho) {
      btnConcluirDesenho.hidden = !modoCriacao;
      btnConcluirDesenho.disabled = !modoCriacao || salvando || pontosCriacao.length < 3;
    }

    if (btnDividir) {
      btnDividir.classList.toggle("active", modoDivisao);
      btnDividir.textContent = modoDivisao ? "Divisão Ativa" : "Dividir";
    }

    if (campoArea) {
      campoArea.disabled = !modoEdicao || salvando;
    }

    if (btnAplicarArea) {
      btnAplicarArea.disabled = !modoEdicao || salvando || !talhaoSelecionado;
    }

    if (mapaContainer) {
      mapaContainer.classList.toggle("modo-edicao", modoEdicao);
      mapaContainer.classList.toggle("admin-map-editing", modoEdicao);
      mapaContainer.classList.toggle("modo-divisao", modoDivisao);
    }
  }

  function renderizarBotoesTalhao() {
    const container = document.getElementById("botoes-talhao");
    if (!container) return;

    container.innerHTML = talhoes
      .map((feature) => {
        const codigo = feature.properties.codigo;
        const ativo = codigo === talhaoSelecionado ? " active" : "";
        return `<button class="btn-talhao${ativo}" type="button" data-talhao="${codigo}">${codigo}</button>`;
      })
      .join("");

    container.querySelectorAll(".btn-talhao").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (salvando) return;
        selecionarTalhao(btn.dataset.talhao);
      });
    });
  }

  function renderizarDetalhesComuns(feature) {
    if (!feature) return;
    const codigo = feature.properties.codigo;
    const props = feature.properties;
    const area = obterAreaHectares(feature);

    const campoArea = document.getElementById("talhao-area-hectares");
    if (campoArea) campoArea.value = String(area);

    preencherTexto("titulo-talhao", `Detalhes: Talhão ${codigo}`);
    preencherTexto("tecnico-titulo-talhao", `Detalhes: Talhão ${codigo}`);

    const textoArea = `${area} hectares`;
    preencherTexto("talhao-area", textoArea);
    preencherTexto("tecnico-talhao-area", textoArea);

    preencherTexto("talhao-solo", props.solo);
    preencherTexto("tecnico-talhao-solo", props.solo);

    preencherTexto("talhao-plantio", formatarData(props.plantio));
    preencherTexto("tecnico-talhao-plantio", formatarData(props.plantio));

    preencherTexto("talhao-colheita", formatarData(props.colheita));
    preencherTexto("tecnico-talhao-colheita", formatarData(props.colheita));

    preencherTexto("talhao-produto", props.produto);
    preencherTexto("tecnico-talhao-produto", props.produto);

    preencherTexto("talhao-variedade", props.variedade);
    preencherTexto("tecnico-talhao-variedade", props.variedade);

    const limiteTermico = props.parametros?.temperaturaMaxima != null ? `${props.parametros.temperaturaMaxima} °C` : "--";
    preencherTexto("talhao-temperatura-maxima", limiteTermico);
    preencherTexto("tecnico-talhao-limite", limiteTermico);

    const apontamento = props.apontamentoTecnico || {};
    preencherTexto("talhao-inspecao-data", formatarData(apontamento.data));
    preencherTexto("talhao-inspecao-tecnico", apontamento.tecnico);
    preencherTexto("talhao-inspecao-problema", apontamento.problema);
    preencherTexto("talhao-inspecao-recomendacao", apontamento.recomendacao);

    const statusTexto = FrutLog.textoInterface(props.status || "Normal");
    ["talhao-status", "tecnico-talhao-status"].forEach((id) => {
      const badge = document.getElementById(id);
      if (badge) {
        badge.textContent = statusTexto;
        badge.className = `badge-status ${classeStatus(props.status || "normal")}`;
      }
    });
  }

  function selecionarTalhao(codigo) {
    const feature = obterFeature(codigo);
    if (!feature) return;

    talhaoSelecionado = codigo;
    renderizarDetalhesComuns(feature);

    const container = document.getElementById("botoes-talhao");
    container?.querySelectorAll(".btn-talhao").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.talhao === codigo);
    });

    const svgMapa = document.getElementById("camada-talhoes");
    svgMapa?.querySelectorAll(".talhao-mapa").forEach((poligono) => {
      poligono.classList.toggle("selecionado", poligono.dataset.talhao === codigo);
    });

    if (typeof callbacks.onTalhaoSelecionado === "function") {
      try {
        callbacks.onTalhaoSelecionado(codigo, feature);
      } catch (erro) {
        console.error("Erro no callback onTalhaoSelecionado:", erro);
      }
    }

    renderizarMapa();
  }

  function renderizarVertices(feature) {
    const svgMapa = document.getElementById("camada-talhoes");
    if (!svgMapa || !feature) return;

    const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grupo.dataset.verticesTalhao = feature.properties.codigo;

    obterPontos(feature).forEach((ponto, index) => {
      const vertice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      vertice.setAttribute("cx", ponto[0]);
      vertice.setAttribute("cy", ponto[1]);
      vertice.setAttribute("r", "6");
      vertice.classList.add("ponto-arrastavel", "admin-map-vertex");
      vertice.dataset.index = String(index);
      vertice.addEventListener("pointerdown", (evento) => {
        if (salvando) return;
        evento.preventDefault();
        evento.stopPropagation();
        verticeArrastado = { codigo: feature.properties.codigo, index };
      });
      grupo.appendChild(vertice);
    });

    svgMapa.appendChild(grupo);
  }

  function renderizarMapa() {
    const svgMapa = document.getElementById("camada-talhoes");
    if (!svgMapa) return;

    const pendentes = talhoes.filter((f) => f.properties.geometriaPendente).length;
    preencherTexto(
      "mensagem-geometria-talhoes",
      pendentes ? `${pendentes} talhão(es) ainda sem geometria. Selecione cada um e use Criar para desenhar seus limites.` : ""
    );

    FrutLogMapaTalhoes.renderizarMapaTalhoes(svgMapa, talhoes, {
      selectedCode: talhaoSelecionado,
      statusFor: (f) => (callbacks.statusFor ? callbacks.statusFor(f) : f.properties.status),
      onSelect: (feature, evento) => {
        if (modoCriacao || modoDivisao || salvando) return;
        evento.stopPropagation();
        if (!talhaoArrastado?.moveu) selecionarTalhao(feature.properties.codigo);
      },
      onPolygon: (poligono, feature) => {
        const codigo = feature.properties.codigo;
        poligono.addEventListener("pointerdown", (evento) => {
          if (!modoEdicao || modoCriacao || modoDivisao || salvando || codigo !== talhaoSelecionado) return;
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

    if (modoCriacao && pontosCriacao.length > 0) {
      const rascunho = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      rascunho.setAttribute("points", pontosParaString(pontosCriacao));
      rascunho.classList.add("poligono-rascunho");
      rascunho.setAttribute("fill", "rgba(123, 31, 162, 0.18)");
      rascunho.setAttribute("stroke", "#26734d");
      rascunho.setAttribute("stroke-width", "2");
      rascunho.style.pointerEvents = "none";
      svgMapa.appendChild(rascunho);
    }

    if (modoDivisao && pontosDivisao.length > 0) {
      const linhaDivisao = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      linhaDivisao.setAttribute("points", pontosParaString(pontosDivisao));
      linhaDivisao.classList.add("linha-divisao-talhao");
      linhaDivisao.setAttribute("fill", "none");
      linhaDivisao.setAttribute("stroke", "#ffb300");
      linhaDivisao.setAttribute("stroke-width", "2.5");
      linhaDivisao.style.pointerEvents = "none";
      svgMapa.appendChild(linhaDivisao);
    }

    atualizarControlesEdicao();
  }

  function atualizarVertice(evento) {
    if (!verticeArrastado || salvando) return;
    const feature = obterFeature(verticeArrastado.codigo);
    if (!feature) return;

    const pontos = obterPontos(feature);
    pontos[verticeArrastado.index] = obterPontoSvg(evento);
    feature.geometry.coordinates[0] = FrutLogTalhoes.fecharAnel(pontos);
    renderizarMapa();
  }

  function moverTalhao(evento) {
    if (!talhaoArrastado || salvando) return;
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

  function concluirCriacao() {
    if (!modoCriacao || pontosCriacao.length < 3) {
      exibirMensagemEdicao("Adicione pelo menos três pontos para criar um talhão.", "erro");
      return;
    }

    const campoArea = document.getElementById("talhao-area-hectares");
    const areaInput = Number(campoArea?.value);
    const areaValida = Number.isFinite(areaInput) && areaInput > 0 ? areaInput : 10.0;
    const codigo = codigoGeometriaPendente || gerarCodigoNovo();
    const geometria = { type: "Polygon", coordinates: [FrutLogTalhoes.fecharAnel(pontosCriacao)] };

    if (codigoGeometriaPendente) {
      const feature = obterFeature(codigoGeometriaPendente);
      if (feature) {
        feature.geometry = geometria;
        feature.properties.geometriaPendente = false;
        feature.properties.area_hectares = areaValida;
        feature.properties.area = `${areaValida} hectares`;
      }
    } else {
      talhoes.push(
        FrutLogTalhoes.criarFeature(codigo, pontosCriacao, {
          area_hectares: areaValida,
          area: `${areaValida} hectares`,
        })
      );
    }

    modoCriacao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    selecionarTalhao(codigo);
    renderizarBotoesTalhao();
    renderizarMapa();
    exibirMensagemEdicao(`Talhão ${codigo} criado no mapa com 8 pontos de ajuste. Ajuste a área e arraste os pontos conforme necessário.`);
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
        ? `Clique no mapa para posicionar o talhão ${codigoGeometriaPendente}. Depois arraste os 8 pontos para ajustar a forma.`
        : "Clique no mapa para criar o talhão com 8 pontos de ajuste. Depois arraste os pontos para moldar a área."
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
        ? `Clique em dois pontos atravessando o talhão ${talhaoSelecionado} para dividir.`
        : "Divisão cancelada."
    );
  }

  function dividirTalhaoSelecionado(linhaInicio, linhaFim) {
    if (!modoEdicao) return;
    const feature = obterFeature(talhaoSelecionado);
    if (!feature) return;

    if (linhaInicio[0] === linhaFim[0] && linhaInicio[1] === linhaFim[1]) {
      exibirMensagemEdicao("Escolha dois pontos diferentes para dividir o talhão.", "erro");
      pontosDivisao = [];
      renderizarMapa();
      return;
    }

    const pontos = obterPontos(feature);
    const lados = pontos.map((ponto) => ladoDaLinha(ponto, linhaInicio, linhaFim));
    const atravessa = lados.some((l) => l > 0) && lados.some((l) => l < 0);
    if (!atravessa) {
      exibirMensagemEdicao("A linha precisa atravessar o interior do talhão selecionado.", "erro");
      pontosDivisao = [];
      renderizarMapa();
      return;
    }

    const parteUm = recortarPoligonoPorLinha(pontos, linhaInicio, linhaFim, true);
    const parteDois = recortarPoligonoPorLinha(pontos, linhaInicio, linhaFim, false);
    if (parteUm.length < 3 || parteDois.length < 3) {
      exibirMensagemEdicao("A linha precisa atravessar o talhão para gerar duas áreas.", "erro");
      return;
    }

    const propsBase = {
      ...feature.properties,
      sensor: "Não associado",
      prioridade: "Associar sensor",
    };

    const codigoBase = feature.properties.codigo;
    const codigoUm = gerarCodigoFilho(codigoBase, 1);
    const codigoDois = gerarCodigoFilho(codigoBase, 2);
    const novoUm = FrutLogTalhoes.criarFeature(codigoUm, parteUm, propsBase);
    const novoDois = FrutLogTalhoes.criarFeature(codigoDois, parteDois, propsBase);

    const areaBase = obterAreaHectares(feature);
    const areaUm = calcularAreaPoligono(parteUm);
    const areaDois = calcularAreaPoligono(parteDois);
    if (areaBase && areaUm + areaDois > 0) {
      const hectaresUm = Number(((areaBase * areaUm) / (areaUm + areaDois)).toFixed(2));
      const hectaresDois = Number((areaBase - hectaresUm).toFixed(2));
      novoUm.properties.area_hectares = hectaresUm;
      novoUm.properties.area = `${hectaresUm} hectares`;
      novoDois.properties.area_hectares = hectaresDois;
      novoDois.properties.area = `${hectaresDois} hectares`;
    }

    novoUm.properties.codigo = codigoUm;
    novoDois.properties.codigo = codigoDois;

    talhoes = talhoes.filter((item) => item.properties.codigo !== codigoBase);
    talhoes.push(novoUm, novoDois);
    modoDivisao = false;
    pontosDivisao = [];
    atualizarControlesEdicao();
    renderizarBotoesTalhao();
    selecionarTalhao(novoUm.properties.codigo);
    exibirMensagemEdicao(`${codigoBase} dividido em ${codigoUm} e ${codigoDois}. Clique em Salvar para persistir.`);
  }

  function excluirTalhaoSelecionado() {
    if (!modoEdicao || talhoes.length <= 1) {
      exibirMensagemEdicao("A fazenda precisa manter pelo menos um talhão.", "erro");
      return;
    }

    if (!window.confirm(`Excluir o talhão ${talhaoSelecionado}? A exclusão será aplicada ao banco ao Salvar.`)) {
      return;
    }

    if (!codigosRemovidos.includes(talhaoSelecionado)) {
      codigosRemovidos.push(talhaoSelecionado);
    }

    talhoes = talhoes.filter((f) => f.properties.codigo !== talhaoSelecionado);
    talhaoSelecionado = talhoes[0]?.properties.codigo || "";
    renderizarBotoesTalhao();
    if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
    renderizarMapa();
    exibirMensagemEdicao("Talhão removido da edição. Clique em Salvar para confirmar no banco.");
  }

  function aplicarAreaTalhao() {
    if (!modoEdicao) return;
    const feature = obterFeature(talhaoSelecionado);
    const campoArea = document.getElementById("talhao-area-hectares");
    const valor = Number(campoArea?.value);
    if (!feature || !Number.isFinite(valor) || valor <= 0) {
      exibirMensagemEdicao("Informe uma área válida maior que zero hectares.", "erro");
      campoArea?.focus();
      return;
    }

    feature.properties.area_hectares = valor;
    feature.properties.area = `${valor} hectares`;
    preencherTexto("talhao-area", `${valor} hectares`);
    preencherTexto("tecnico-talhao-area", `${valor} hectares`);
    exibirMensagemEdicao(`Área do talhão ${talhaoSelecionado} atualizada para ${valor} ha.`);
  }

  async function salvarAlteracoesMapa() {
    if (salvando) return;
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    pontosDivisao = [];

    // Prepara e normaliza as features para garantir que todas têm área positiva
    const dadosTalhoes = talhoes.map((feature) => {
      const areaHectares = obterAreaHectares(feature);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          area_hectares: areaHectares,
          area: `${areaHectares} hectares`,
        },
      };
    });

    // Validação específica por talhão com mensagem clara
    for (const feature of dadosTalhoes) {
      const codigo = feature.properties.codigo;
      const pontos = obterPontos(feature);
      if (pontos.length < 3) {
        exibirMensagemEdicao(`O talhão ${codigo} precisa ter limites com pelo menos três pontos desenhados no mapa.`, "erro");
        selecionarTalhao(codigo);
        return;
      }
      const area = Number(feature.properties.area_hectares);
      if (!Number.isFinite(area) || area <= 0) {
        exibirMensagemEdicao(`O talhão ${codigo} precisa de uma área positiva informada em hectares.`, "erro");
        selecionarTalhao(codigo);
        document.getElementById("talhao-area-hectares")?.focus();
        return;
      }
    }

    salvando = true;
    atualizarControlesEdicao();
    exibirMensagemEdicao("Salvando alterações de talhões no banco de dados...");

    try {
      const removidos = codigosRemovidos.filter((c) => !dadosTalhoes.some((f) => f.properties.codigo === c));
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
      codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
      codigosRemovidos = [];
      modoEdicao = false;

      talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
      atualizarControlesEdicao();
      renderizarBotoesTalhao();
      if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
      renderizarMapa();

      FrutLog.notificarAtualizacaoTalhoes();
      window.dispatchEvent(new Event("frutlog:talhoes-atualizados"));

      const qtdRemovida = removidos.length;
      exibirMensagemEdicao(
        qtdRemovida
          ? `Alterações salvas com sucesso. ${qtdRemovida} talhão(ões) removido(s) do mapa e preservado(s) no histórico.`
          : "Formas e áreas dos talhões salvas com sucesso no banco de dados."
      );

      if (typeof callbacks.onTalhoesAtualizados === "function") {
        callbacks.onTalhoesAtualizados(talhoes);
      }
    } catch (erro) {
      exibirMensagemEdicao(erro.message || "Erro ao salvar alterações no banco.", "erro");
    } finally {
      salvando = false;
      atualizarControlesEdicao();
    }
  }

  function cancelarAlteracoesMapa() {
    talhoes = FrutLogTalhoes.obterTalhoes();
    modoEdicao = false;
    modoCriacao = false;
    modoDivisao = false;
    pontosCriacao = [];
    codigoGeometriaPendente = "";
    pontosDivisao = [];
    codigosRemovidos = [];

    talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
    atualizarControlesEdicao();
    renderizarBotoesTalhao();
    if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
    renderizarMapa();
    exibirMensagemEdicao("Edição cancelada. As alterações não salvas foram descartadas.");
  }

  async function ativarOuDesativarEdicao() {
    // Engenharia e Administração editam o mesmo mapa. Entrar na edição sempre
    // relendo o servidor evita partir de uma versão antiga e sobrescrever o que
    // o outro perfil salvou (e já traz os códigos arquivados do momento).
    if (!modoEdicao) {
      const btnEditar = document.getElementById("btn-editar-talhoes");
      if (btnEditar) btnEditar.disabled = true;
      exibirMensagemEdicao("Carregando a versão mais recente dos talhões...");
      try {
        talhoes = await FrutLogMapaTalhoes.carregarMapaTalhoes(perfilAtual);
        codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
        codigosRemovidos = [];
        talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
        renderizarBotoesTalhao();
      } catch (erro) {
        exibirMensagemEdicao(`Não foi possível carregar a versão atual do mapa: ${erro.message}`, "erro");
        atualizarControlesEdicao();
        return;
      }
    }

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
    exibirMensagemEdicao(
      modoEdicao
        ? "Modo de edição ativo. Arraste os pontos para alterar a forma, ou use Criar para novo talhão e Salvar ao terminar."
        : "Modo de edição desativado."
    );
  }

  async function recarregarMapa() {
    if (modoEdicao) {
      exibirMensagemEdicao("Salve ou cancele a edição antes de recarregar o mapa.", "erro");
      return;
    }

    exibirMensagemEdicao("Carregando talhões do servidor...");
    try {
      const servidorTalhoes = await FrutLogMapaTalhoes.carregarMapaTalhoes(perfilAtual);
      talhoes = servidorTalhoes;
      codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
      talhaoSelecionado = obterFeature(talhaoSelecionado)?.properties.codigo || talhoes[0]?.properties.codigo || "";
      renderizarBotoesTalhao();
      if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
      renderizarMapa();
      exibirMensagemEdicao("Mapa de talhões atualizado com o servidor.");
    } catch (erro) {
      exibirMensagemEdicao(`Falha ao recarregar talhões: ${erro.message}`, "erro");
    }
  }

  function configurarEventosDOM() {
    if (configurado) return;
    configurado = true;

    document.getElementById("btn-editar-talhoes")?.addEventListener("click", ativarOuDesativarEdicao);
    document.getElementById("btn-recarregar-mapa")?.addEventListener("click", recarregarMapa);
    document.getElementById("btn-criar-talhao")?.addEventListener("click", iniciarCriacao);
    document.getElementById("btn-concluir-desenho")?.addEventListener("click", concluirCriacao);
    document.getElementById("btn-dividir-talhao")?.addEventListener("click", iniciarDivisao);
    document.getElementById("btn-excluir-talhao")?.addEventListener("click", excluirTalhaoSelecionado);
    document.getElementById("btn-salvar-talhao")?.addEventListener("click", salvarAlteracoesMapa);
    document.getElementById("btn-cancelar-talhao")?.addEventListener("click", cancelarAlteracoesMapa);
    document.getElementById("btn-aplicar-area-talhao")?.addEventListener("click", aplicarAreaTalhao);

    const campoArea = document.getElementById("talhao-area-hectares");
    if (campoArea) {
      campoArea.addEventListener("input", () => {
        if (!modoEdicao) return;
        const feature = obterFeature(talhaoSelecionado);
        const valor = Number(campoArea.value);
        if (feature && Number.isFinite(valor) && valor > 0) {
          feature.properties.area_hectares = valor;
          feature.properties.area = `${valor} hectares`;
          preencherTexto("talhao-area", `${valor} hectares`);
          preencherTexto("tecnico-talhao-area", `${valor} hectares`);
        }
      });
      campoArea.addEventListener("change", aplicarAreaTalhao);
    }

    const svgMapa = document.getElementById("camada-talhoes");
    if (svgMapa) {
      svgMapa.addEventListener("click", (evento) => {
        if (!modoCriacao && !modoDivisao) return;

        const ponto = obterPontoSvg(evento);

        if (modoDivisao) {
          pontosDivisao.push(ponto);
          if (pontosDivisao.length === 2) {
            dividirTalhaoSelecionado(pontosDivisao[0], pontosDivisao[1]);
            return;
          }
          renderizarMapa();
          exibirMensagemEdicao("Agora clique no segundo ponto da linha de divisão.");
          return;
        }

        // Criar talhão direto com o retângulo de 8 pontos com 1 clique
        pontosCriacao = retanguloComOitoPontos(ponto);
        concluirCriacao();
      });

      svgMapa.addEventListener("dblclick", (evento) => {
        if (modoCriacao) {
          evento.preventDefault();
          concluirCriacao();
        }
      });
    }

    window.addEventListener("pointermove", (evento) => {
      atualizarVertice(evento);
      moverTalhao(evento);
    });

    window.addEventListener("pointerup", () => {
      verticeArrastado = null;
      talhaoArrastado = null;
    });

    window.addEventListener("pointercancel", () => {
      verticeArrastado = null;
      talhaoArrastado = null;
    });

    window.addEventListener("frutlog:talhoes-atualizados", () => {
      if (modoEdicao) return;
      talhoes = FrutLogTalhoes.obterTalhoes();
      codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
      if (!obterFeature(talhaoSelecionado)) {
        talhaoSelecionado = talhoes[0]?.properties.codigo || "";
      }
      renderizarBotoesTalhao();
      if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
      renderizarMapa();
    });
  }

  async function inicializar(opcoes = {}) {
    perfilAtual = opcoes.perfil === "engenheiro" ? "engenheiro" : "admin";
    callbacks.onTalhaoSelecionado = opcoes.onTalhaoSelecionado || null;
    callbacks.onTalhoesAtualizados = opcoes.onTalhoesAtualizados || null;
    callbacks.statusFor = opcoes.statusFor || null;

    talhoes = FrutLogTalhoes.obterTalhoes();
    codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
    talhaoSelecionado = talhoes[0]?.properties.codigo || "";

    configurarEventosDOM();
    atualizarControlesEdicao();
    renderizarBotoesTalhao();
    if (talhaoSelecionado) {
      selecionarTalhao(talhaoSelecionado);
    } else {
      renderizarMapa();
    }

    // Tenta carregar os dados mais recentes do servidor
    try {
      const servidorTalhoes = await FrutLogMapaTalhoes.carregarMapaTalhoes(perfilAtual);
      talhoes = servidorTalhoes;
      codigosIniciais = new Set(talhoes.map((f) => f.properties.codigo));
      if (!obterFeature(talhaoSelecionado)) {
        talhaoSelecionado = talhoes[0]?.properties.codigo || "";
      }
      renderizarBotoesTalhao();
      if (talhaoSelecionado) selecionarTalhao(talhaoSelecionado);
      renderizarMapa();
    } catch (e) {
      // Offline ou inicial: os talhões locais já estão renderizados
      console.warn("EditorMapaTalhoes: utilizando dados locais de talhões.", e.message);
    }

    return {
      talhoes,
      talhaoSelecionado,
    };
  }

  window.FrutLogEditorAdmin = {
    ativo: () => modoEdicao,
  };

  return {
    inicializar,
    obterTalhoes: () => talhoes,
    obterTalhaoSelecionado: () => talhaoSelecionado,
    selecionarTalhao,
    renderizar: renderizarMapa,
    recarregar: recarregarMapa,
    estaEditando: () => modoEdicao,
  };
})();
