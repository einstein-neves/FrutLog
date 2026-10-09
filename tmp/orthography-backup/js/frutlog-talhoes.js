/* =========================================================
   FRUTLOG - DADOS DE TALHOES
   Geometrias GeoJSON sincronizadas com a API.
   ========================================================= */

const FrutLogTalhoes = (() => {
  const CHAVE_RASCUNHO = "frutlog_talhoes_geojson";
  const CHAVE_RASCUNHO_SESSAO = "frutlog_talhoes_geojson";

  const dadosIniciais = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "talhao-a1",
        properties: { codigo: "A1" },
        geometry: {
          type: "Polygon",
          coordinates: [[[180, 135], [278, 14], [298, 18], [340, 55], [285, 120], [260, 140], [202, 141], [180, 135]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-a2",
        properties: { codigo: "A2" },
        geometry: {
          type: "Polygon",
          coordinates: [[[116, 120], [136, 127], [172, 127], [195, 142], [240, 147], [235, 215], [185, 215], [145, 205], [115, 190], [116, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b1",
        properties: { codigo: "B1" },
        geometry: {
          type: "Polygon",
          coordinates: [[[285, 120], [305, 85], [340, 95], [380, 140], [350, 170], [320, 205], [285, 235], [250, 220], [235, 185], [250, 150], [270, 135], [285, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b2",
        properties: { codigo: "B2" },
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
    const numero = Number(String(valor ?? "").replace(",", "."));
    return Number.isNaN(numero) ? null : numero;
  }

  function calcularStatusMonitoramento(feature) {
    const temperaturaAtual = normalizarNumero(feature?.properties?.diaria?.temperatura);
    const temperaturaMaxima = normalizarNumero(feature?.properties?.parametros?.temperaturaMaxima);

    if (temperaturaAtual === null || temperaturaMaxima === null) {
      return {
        status: feature?.properties?.status || "Sem leitura",
        prioridade: feature?.properties?.prioridade || "Sem leitura suficiente para alerta automatico.",
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    if (temperaturaAtual > temperaturaMaxima) {
      return {
        status: "Critico",
        prioridade: `Temperatura ${temperaturaAtual} C acima do limite de ${temperaturaMaxima} C.`,
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    if (temperaturaAtual >= temperaturaMaxima - 1) {
      return {
        status: "Atencao",
        prioridade: `Temperatura ${temperaturaAtual} C proxima do limite de ${temperaturaMaxima} C.`,
        leituraTemperatura: temperaturaAtual,
        limiteTemperatura: temperaturaMaxima,
      };
    }

    return {
      status: "Sem leitura",
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

    if (clone.properties.sensor === "Nao associado") {
      clone.properties.prioridade = "Associar sensor ao talhao para monitoramento.";
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

  function obterColecao() {
    const rascunho = lerRascunhoSalvo();

    if (!rascunho) {
      return aplicarMonitoramentoColecao(clonar(dadosIniciais));
    }

    try {
      return aplicarMonitoramentoColecao(JSON.parse(rascunho));
    } catch (erro) {
      console.error("GeoJSON de talhoes invalido:", erro);
      removerRascunhoInvalido();
      return aplicarMonitoramentoColecao(clonar(dadosIniciais));
    }
  }

  function salvarColecao(colecao) {
    const colecaoMonitorada = aplicarMonitoramentoColecao(colecao);

    gravarRascunhoSalvo(colecaoMonitorada);
    return clonar(colecaoMonitorada);
  }

  function carregarDoServidor(registros) {
    if (!Array.isArray(registros)) {
      throw new Error("Resposta invalida ao carregar talhoes do servidor.");
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

      const area = Number(registro.area_hectares);
      const geometriaPendente = geometria.coordinates?.[0]?.length < 4;
      return {
        type: "Feature",
        id: registro.id || local?.id || `talhao-${String(codigo).toLowerCase()}`,
        properties: {
          ...(local?.properties || {}),
          codigo,
          nome: registro.nome || local?.properties?.nome || codigo,
          area_hectares: Number.isFinite(area) ? area : null,
          area: Number.isFinite(area) ? `${area} hectares` : local?.properties?.area || "--",
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

    return {
      type: "Feature",
      id: `talhao-${codigo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      properties: {
        codigo,
        status: "Normal",
        produto: "--",
        variedade: "--",
        area: "--",
        solo: "--",
        plantio: "--",
        colheita: "--",
        sensor: "Nao associado",
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
    calcularStatusMonitoramento,
    fecharAnel,
    carregarDoServidor,
    obterColecao,
    obterPontos,
    obterTalhoes,
    salvarColecao,
    substituirTalhoes,
  };
})();
