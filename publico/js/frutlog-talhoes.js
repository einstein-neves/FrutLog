/* =========================================================
   FRUTLOG - DADOS DE TALHOES
   Geometrias GeoJSON sincronizadas com a API.
   ========================================================= */

const FrutLogTalhoes = (() => {
  const CHAVE_RASCUNHO = "frutlog_talhoes_geojson";
  const CHAVE_RASCUNHO_SESSAO = "frutlog_talhoes_geojson";

  // Escala do mapa: 1 unidade do viewBox (500x400) ao quadrado vale 1/1000 hectare.
  // A barra do mapa nao tem mais o campo "Area do talhao (ha)", por isso a area
  // passa a ser calculada a partir da propria geometria desenhada. O divisor 1000
  // ja era a convencao usada no editor do admin e foi centralizado aqui para que
  // Engenharia e Administracao cheguem sempre ao mesmo numero.
  const UNIDADES_SVG_POR_HECTARE = 1000;

  const dadosIniciais = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "talhao-a1",
        properties: { codigo: "A1", area_hectares: 15.5, area: "15.5 hectares" },
        geometry: {
          type: "Polygon",
          coordinates: [[[180, 135], [278, 14], [298, 18], [340, 55], [285, 120], [260, 140], [202, 141], [180, 135]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-a2",
        properties: { codigo: "A2", area_hectares: 12.0, area: "12.0 hectares" },
        geometry: {
          type: "Polygon",
          coordinates: [[[116, 120], [136, 127], [172, 127], [195, 142], [240, 147], [235, 215], [185, 215], [145, 205], [115, 190], [116, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b1",
        properties: { codigo: "B1", area_hectares: 18.2, area: "18.2 hectares" },
        geometry: {
          type: "Polygon",
          coordinates: [[[285, 120], [305, 85], [340, 95], [380, 140], [350, 170], [320, 205], [285, 235], [250, 220], [235, 185], [250, 150], [270, 135], [285, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b2",
        properties: { codigo: "B2", area_hectares: 10.8, area: "10.8 hectares" },
        geometry: {
          type: "Polygon",
          coordinates: [[[75, 85], [115, 120], [187, 107], [230, 105], [220, 85], [280, 5], [230, 5], [75, 85]]],
        },
      },
    ],
  };

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function lerRascunhoSalvo() {
    return localStorage.getItem(CHAVE_RASCUNHO) || sessionStorage.getItem(CHAVE_RASCUNHO_SESSAO);
  }

  function gravarRascunhoSalvo(colecao) {
    const conteudo = JSON.stringify(colecao);

    localStorage.setItem(CHAVE_RASCUNHO, conteudo);
    sessionStorage.setItem(CHAVE_RASCUNHO_SESSAO, conteudo);
  }

  function removerRascunhoInvalido() {
    localStorage.removeItem(CHAVE_RASCUNHO);
    sessionStorage.removeItem(CHAVE_RASCUNHO_SESSAO);
  }

  function normalizarNumero(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === "") return null;
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isNaN(numero) ? null : numero;
  }

  function calcularStatusMonitoramento(feature) {
    const temperaturaAtual = normalizarNumero(feature?.properties?.diaria?.temperatura);
    const temperaturaMaxima = normalizarNumero(feature?.properties?.parametros?.temperaturaMaxima);

    if (temperaturaMaxima === null) {
      return {
        status: "Sem leitura",
        prioridade: "Configure a temperatura maxima para habilitar o alerta termico.",
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: null,
      };
    }

    if (temperaturaAtual === null) {
      return {
        status: "Sem leitura",
        prioridade: feature?.properties?.prioridade || "Sem leitura suficiente para alerta automático.",
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    if (temperaturaAtual >= temperaturaMaxima) {
      return {
        status: "Critico",
        prioridade: `Temperatura ${temperaturaAtual} C atingiu ou ultrapassou o limite de ${temperaturaMaxima} C.`,
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    if (temperaturaAtual >= temperaturaMaxima - 3) {
      return {
        status: "Atencao",
        prioridade: `Temperatura ${temperaturaAtual} C proxima do limite de ${temperaturaMaxima} C.`,
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    return {
      status: "Normal",
      prioridade: `Temperatura ${temperaturaAtual} C dentro do limite de ${temperaturaMaxima} C.`,
      leituraTemperatura: temperaturaAtual,
      limiteTemperatura: temperaturaMaxima,
    };
  }

  function aplicarMonitoramento(feature) {
    const resultado = calcularStatusMonitoramento(feature);
    const clone = clonar(feature);

    clone.properties.status = resultado.status;
    clone.properties.monitoramento = {
      origem: "Banco de dados",
      temperaturaAtual: resultado.leituraTemperatura,
      temperaturaMaxima: resultado.limiteTemperatura,
      status: resultado.status,
      mensagem: resultado.prioridade,
    };

    if (clone.properties.sensor === "Não associado") {
      clone.properties.prioridade = "Associar sensor ao talhão para monitoramento.";
    } else {
      clone.properties.prioridade = resultado.prioridade;
    }

    return clone;
  }

  function aplicarMonitoramentoColecao(colecao) {
    return {
      ...colecao,
      features: (colecao.features || []).map(aplicarMonitoramento),
    };
  }

  function sanitizarAreasColecao(colecao) {
    const iniciaisPorCodigo = new Map(dadosIniciais.features.map((f) => [f.properties.codigo, f]));
    (colecao.features || []).forEach((feature) => {
      if (!feature.properties) feature.properties = {};
      const areaAtual = Number(feature.properties.area_hectares);
      if (!Number.isFinite(areaAtual) || areaAtual <= 0) {
        const inicial = iniciaisPorCodigo.get(feature.properties.codigo);
        const parsed = Number(String(feature.properties.area || "").replace(/[^\d,.-]/g, "").replace(",", "."));
        const fallback = Number.isFinite(parsed) && parsed > 0
          ? parsed
          : (inicial?.properties?.area_hectares || 10.0);
        feature.properties.area_hectares = fallback;
        feature.properties.area = `${fallback} hectares`;
      }
    });
    return colecao;
  }

  function obterColecao() {
    const rascunho = lerRascunhoSalvo();

    if (!rascunho) {
      return aplicarMonitoramentoColecao(sanitizarAreasColecao(clonar(dadosIniciais)));
    }

    try {
      return aplicarMonitoramentoColecao(sanitizarAreasColecao(JSON.parse(rascunho)));
    } catch (erro) {
      console.error("GeoJSON de talhões inválido:", erro);
      removerRascunhoInvalido();
      return aplicarMonitoramentoColecao(sanitizarAreasColecao(clonar(dadosIniciais)));
    }
  }

  function salvarColecao(colecao) {
    const colecaoMonitorada = aplicarMonitoramentoColecao(sanitizarAreasColecao(colecao));

    gravarRascunhoSalvo(colecaoMonitorada);
    return clonar(colecaoMonitorada);
  }

  function carregarDoServidor(registros) {
    if (!Array.isArray(registros)) {
      throw new Error("Resposta inválida ao carregar talhões do servidor.");
    }

    const locais = obterTalhoes();
    const porCodigo = new Map(locais.map((feature) => [feature.properties.codigo, feature]));
    const iniciaisPorCodigo = new Map(dadosIniciais.features.map((feature) => [feature.properties.codigo, feature]));
    const features = registros.map((registro) => {
      const codigo = registro.codigo;
      const local = porCodigo.get(codigo);
      const inicial = iniciaisPorCodigo.get(codigo);
      const coordenadas = Array.isArray(registro.coordenadas)
        ? registro.coordenadas
        : registro.coordenadas?.coordinates?.[0];
      const coordenadasValidas = Array.isArray(coordenadas)
        && coordenadas.length >= 4
        && coordenadas.every((ponto) => Array.isArray(ponto)
          && ponto.length === 2
          && ponto.every((valor) => Number.isFinite(Number(valor))));
      const geometriaLocal = local?.geometry?.coordinates?.[0]?.length >= 4
        ? local.geometry
        : inicial?.geometry;
      const geometria = coordenadasValidas
        ? { type: "Polygon", coordinates: [coordenadas] }
        : geometriaLocal || { type: "Polygon", coordinates: [[]] };

      const areaInformada = Number(registro.area_hectares);
      const areaLocal = Number(local?.properties?.area_hectares) || Number(inicial?.properties?.area_hectares);
      const area = Number.isFinite(areaInformada) && areaInformada > 0
        ? areaInformada
        : (Number.isFinite(areaLocal) && areaLocal > 0 ? areaLocal : 10.0);
      const geometriaPendente = geometria.coordinates?.[0]?.length < 4;
      return {
        type: "Feature",
        id: registro.id || local?.id || `talhao-${String(codigo).toLowerCase()}`,
        properties: {
          ...(local?.properties || {}),
          codigo,
          nome: registro.nome || local?.properties?.nome || codigo,
          area_hectares: area,
          area: `${area} hectares`,
          parametros: {
            ...(local?.properties?.parametros || {}),
            temperaturaMaxima: registro.temperatura_maxima === null || registro.temperatura_maxima === undefined
              ? local?.properties?.parametros?.temperaturaMaxima ?? null
              : Number(registro.temperatura_maxima),
          },
          geometriaPendente,
        },
        geometry: geometria,
      };
    });

    return substituirTalhoes(features);
  }

  function obterTalhoes() {
    return obterColecao().features;
  }

  function substituirTalhoes(features) {
    return salvarColecao({ type: "FeatureCollection", features: clonar(features) }).features;
  }

  function atualizarTelemetriaTalhao(codigo, leitura) {
    const colecao = obterColecao();
    const talhao = colecao.features.find((feature) => feature.properties.codigo === codigo);

    if (!talhao) return colecao.features;

    talhao.properties.diaria = {
      ...talhao.properties.diaria,
      ...leitura,
    };

    return salvarColecao(colecao).features;
  }

  function criarFeature(codigo, pontos, propriedades = {}) {
    const anel = fecharAnel(pontos);
    const areaInformada = Number(propriedades.area_hectares);
    const areaValida = Number.isFinite(areaInformada) && areaInformada > 0 ? areaInformada : 10.0;

    return {
      type: "Feature",
      id: `talhao-${codigo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      properties: {
        codigo,
        status: "Normal",
        produto: "--",
        variedade: "--",
        area_hectares: areaValida,
        area: `${areaValida} hectares`,
        solo: "--",
        plantio: "--",
        colheita: "--",
        sensor: "Não associado",
        parametros: { temperaturaMaxima: null },
        apontamentoTecnico: {
          data: "--",
          tecnico: "--",
          problema: "--",
          recomendacao: "--",
        },
        diaria: { temperatura: null, umidadeAr: null, umidadeSolo: null, chuva: null },
        mensal: [],
        prioridade: "Aguardando vistoria",
        ...propriedades,
        codigo,
      },
      geometry: { type: "Polygon", coordinates: [anel] },
    };
  }

  /**
   * Area do poligono em unidades do viewBox do mapa (formula do sapateiro).
   * @param {Array<Array<number>>} pontos - Vertices do talhao, sem repetir o primeiro.
   * @returns {number} Area em unidades SVG ao quadrado; 0 quando nao ha poligono.
   */
  function calcularAreaSvg(pontos) {
    if (!Array.isArray(pontos) || pontos.length < 3) return 0;

    return Math.abs(pontos.reduce((soma, ponto, indice) => {
      const proximo = pontos[(indice + 1) % pontos.length];
      return soma + (ponto[0] * proximo[1]) - (proximo[0] * ponto[1]);
    }, 0)) / 2;
  }

  /**
   * Recalcula a area do talhao a partir da forma desenhada no mapa.
   *
   * Substitui o antigo campo manual "Area do talhao (ha)" da barra de ferramentas:
   * - com `pontosAnteriores`, a area muda na mesma proporcao da geometria, para
   *   que um talhao ja cadastrado com area conferida em campo nao perca o valor
   *   real so porque um vertice foi arrastado;
   * - sem `pontosAnteriores` (talhao novo), a area vem da escala do mapa.
   *
   * ATENCAO (banco): o valor gravado em `properties.area_hectares` e o mesmo
   * enviado em PUT /talhoes/geometrias e usado por POST /plantios, que recusa
   * talhao sem area positiva.
   *
   * @param {object} feature - Feature GeoJSON do talhao (alterada no lugar).
   * @param {Array<Array<number>>} [pontosAnteriores] - Vertices antes da edicao.
   * @returns {number|null} Area em hectares com 2 casas, ou null sem geometria.
   */
  function recalcularAreaAutomatica(feature, pontosAnteriores) {
    if (!feature) return null;
    if (!feature.properties) feature.properties = {};

    const areaAtualSvg = calcularAreaSvg(obterPontos(feature));
    if (areaAtualSvg <= 0) return null;

    const areaAnteriorSvg = calcularAreaSvg(pontosAnteriores);
    const hectaresAnteriores = Number(feature.properties.area_hectares);
    const podeEscalar = areaAnteriorSvg > 0
      && Number.isFinite(hectaresAnteriores)
      && hectaresAnteriores > 0;

    const hectares = podeEscalar
      ? (hectaresAnteriores * areaAtualSvg) / areaAnteriorSvg
      : areaAtualSvg / UNIDADES_SVG_POR_HECTARE;

    const arredondado = Number(hectares.toFixed(2));
    if (!Number.isFinite(arredondado) || arredondado <= 0) return null;

    feature.properties.area_hectares = arredondado;
    feature.properties.area = `${arredondado} hectares`;
    return arredondado;
  }

  function fecharAnel(pontos) {
    const anel = pontos.map((ponto) => [Number(ponto[0]), Number(ponto[1])]);
    const primeiro = anel[0];
    const ultimo = anel[anel.length - 1];

    if (primeiro && ultimo && (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1])) {
      anel.push([...primeiro]);
    }

    return anel;
  }

  function obterPontos(feature) {
    const pontos = feature.geometry?.coordinates?.[0];
    return Array.isArray(pontos) && pontos.length > 1 ? pontos.slice(0, -1) : [];
  }

  return {
    criarFeature,
    aplicarMonitoramento,
    atualizarTelemetriaTalhao,
    calcularAreaSvg,
    calcularStatusMonitoramento,
    fecharAnel,
    recalcularAreaAutomatica,
    carregarDoServidor,
    obterColecao,
    obterPontos,
    obterTalhoes,
    salvarColecao,
    substituirTalhoes,
  };
})();
