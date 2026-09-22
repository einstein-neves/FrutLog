/* =========================================================
   FRUTLOG - DADOS DE TALHOES
   Geometrias em estrutura GeoJSON preparada para API futura.
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
        properties: {
          codigo: "A1",
          status: "Normal",
          produto: "Uva",
          variedade: "Uva Isabel",
          area: "10 hectares",
          solo: "Arenoso",
          plantio: "15/03/2026",
          colheita: "20/10/2026",
          sensor: "TEMP-A1-01",
          parametros: { temperaturaMaxima: 32 },
          apontamentoTecnico: {
            data: "13/09/2026",
            tecnico: "Marina",
            problema: "Sem problema registrado.",
            recomendacao: "Manter rotina de acompanhamento.",
          },
          diaria: { temperatura: "31", umidadeAr: "68", umidadeSolo: "45", chuva: "2,4" },
          mensal: [
            { temp: "30", umidAr: "65", umidSolo: "45", chuva: "12", prev: "Out/2026", qtd: "25 t" },
            { temp: "31", umidAr: "68", umidSolo: "42", chuva: "8", prev: "Out/2026", qtd: "28 t" },
          ],
          prioridade: "Rotina de acompanhamento",
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[180, 135], [278, 14], [298, 18], [340, 55], [285, 120], [260, 140], [202, 141], [180, 135]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-a2",
        properties: {
          codigo: "A2",
          status: "Atencao",
          produto: "Manga",
          variedade: "Tommy Atkins",
          area: "8 hectares",
          solo: "Franco Arenoso",
          plantio: "10/02/2026",
          colheita: "18/09/2026",
          sensor: "SOLO-A2-01",
          parametros: { temperaturaMaxima: 32 },
          apontamentoTecnico: {
            data: "13/09/2026",
            tecnico: "Marina",
            problema: "Umidade do solo abaixo do ideal.",
            recomendacao: "Verificar irrigacao e acompanhar nas proximas leituras.",
          },
          diaria: { temperatura: "33", umidadeAr: "61", umidadeSolo: "35", chuva: "1,8" },
          mensal: [
            { temp: "32", umidAr: "60", umidSolo: "38", chuva: "5", prev: "Set/2026", qtd: "40 t" },
            { temp: "33", umidAr: "61", umidSolo: "35", chuva: "2", prev: "Set/2026", qtd: "42 t" },
          ],
          prioridade: "Verificar umidade do solo",
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[116, 120], [136, 127], [172, 127], [195, 142], [240, 147], [235, 215], [185, 215], [145, 205], [115, 190], [116, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b1",
        properties: {
          codigo: "B1",
          status: "Normal",
          produto: "Uva",
          variedade: "Sugar Crisp",
          area: "9 hectares",
          solo: "Arenoso",
          plantio: "05/02/2026",
          colheita: "25/09/2026",
          sensor: "CHUVA-B1-01",
          parametros: { temperaturaMaxima: 31 },
          apontamentoTecnico: {
            data: "13/09/2026",
            tecnico: "Marina",
            problema: "Sem problema registrado.",
            recomendacao: "Manter rotina de acompanhamento.",
          },
          diaria: { temperatura: "30", umidadeAr: "72", umidadeSolo: "48", chuva: "3,1" },
          mensal: [
            { temp: "29", umidAr: "70", umidSolo: "50", chuva: "15", prev: "Set/2026", qtd: "30 t" },
            { temp: "30", umidAr: "72", umidSolo: "48", chuva: "10", prev: "Set/2026", qtd: "35 t" },
          ],
          prioridade: "Rotina de acompanhamento",
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[285, 120], [305, 85], [340, 95], [380, 140], [350, 170], [320, 205], [285, 235], [250, 220], [235, 185], [250, 150], [270, 135], [285, 120]]],
        },
      },
      {
        type: "Feature",
        id: "talhao-b2",
        properties: {
          codigo: "B2",
          status: "Critico",
          produto: "Melao",
          variedade: "Goldex",
          area: "7,6 hectares",
          solo: "Franco Arenoso",
          plantio: "20/01/2026",
          colheita: "15/09/2026",
          sensor: "SOLO-B2-01",
          parametros: { temperaturaMaxima: 34 },
          apontamentoTecnico: {
            data: "12/09/2026",
            tecnico: "Marina",
            problema: "Sensor de solo offline e leitura critica de umidade.",
            recomendacao: "Priorizar vistoria em campo e checar irrigacao.",
          },
          diaria: { temperatura: "35", umidadeAr: "54", umidadeSolo: "28", chuva: "0,8" },
          mensal: [
            { temp: "34", umidAr: "55", umidSolo: "30", chuva: "0", prev: "Set/2026", qtd: "18 t" },
            { temp: "35", umidAr: "54", umidSolo: "28", chuva: "1", prev: "Set/2026", qtd: "20 t" },
          ],
          prioridade: "Checar sensor e irrigacao",
        },
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
        status: "Normal",
        prioridade: "Sem leitura suficiente para alerta automatico.",
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
      origem: "ThingSpeak",
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
    // TODO: substituir por FrutLog.apiFetch("/talhoes/geometrias", ...) quando houver endpoint.
    console.info("GeoJSON dos talhoes preparado para persistencia:", colecaoMonitorada);
    return clonar(colecaoMonitorada);
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
        parametros: { temperaturaMaxima: 30 },
        apontamentoTecnico: {
          data: "--",
          tecnico: "--",
          problema: "Sem problema registrado.",
          recomendacao: "Cadastrar cultivo e associar sensor.",
        },
        diaria: { temperatura: "0", umidadeAr: "--", umidadeSolo: "--", chuva: "--" },
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
    return (feature.geometry.coordinates[0] || []).slice(0, -1);
  }

  return {
    criarFeature,
    aplicarMonitoramento,
    atualizarTelemetriaTalhao,
    calcularStatusMonitoramento,
    fecharAnel,
    obterColecao,
    obterPontos,
    obterTalhoes,
    salvarColecao,
    substituirTalhoes,
  };
})();
