/* =========================================================
   FRUTLOG - TECNICO AGRICOLA
   Visualizacao de talhoes e registros de campo.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  verificarSessao();
  FrutLog.configurarLogout();
  configurarAbas();
  configurarRelatorioDiario();
  document.getElementById("relatorio-data").value = dataLocalISO();
  const dataRegistro = document.getElementById("registro-data");
  if (dataRegistro) dataRegistro.value = dataLocalISO();
  preencherFiltroMetricaTelemetria();
  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    try {
      await carregarPainelTecnico();
      await carregarTelemetriaDiaria();
    } catch (erro) {
      console.error("Falha ao carregar o painel do técnico:", erro);
      exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
    }
  }
  carregarTalhoes();
  configurarMapaTalhoes();
  carregarTarefasDia();
  carregarHistoricoRegistros();
  carregarSensores();
  carregarAlertas();
  carregarGraficoMetricas();
  atualizarRelatorioAutomatico();
  configurarFormularios();
  selecionarTalhao(talhoes[0]?.properties.codigo || "");

  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    window.setInterval(async () => {
      try {
        await carregarPainelTecnico();
        await carregarTelemetriaDiaria();
        carregarTalhoes();
        carregarTarefasDia();
        carregarHistoricoRegistros();
        carregarSensores();
        carregarAlertas();
        carregarGraficoMetricas();
        atualizarRelatorioAutomatico();
        selecionarTalhao(document.querySelector(".btn-talhao.active")?.dataset.talhao || talhoes[0]?.properties.codigo);
      } catch (erro) {
        console.error("Falha ao sincronizar o painel do técnico:", erro);
        exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
      }
    }, 15000);
  }
  window.addEventListener("frutlog:talhoes-atualizados", async () => {
    try {
      await carregarPainelTecnico();
      carregarTalhoes();
      carregarTarefasDia();
      selecionarTalhao(document.querySelector(".btn-talhao.active")?.dataset.talhao || talhoes[0]?.properties.codigo);
    } catch (erro) {
      exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
    }
  });
  window.addEventListener("focus", () => {
    if (FrutLog.AUTENTICACAO_API_ATIVA) {
      window.dispatchEvent(new Event("frutlog:talhoes-atualizados"));
    }
  });
});

let talhoes = FrutLogTalhoes.obterTalhoes();

let historicoInspecoes = [];
let historicoOcorrencias = [];
let historicoProblemasSensores = [];
let sensoresDoServidor = [];
let painelTecnico = {};
let graficoMetricas = null;
let graficoClimaMensalTecnico = null;
let telemetriaDiaria = [];
let telemetriaMensal = [];
let talhaoSelecionadoId = null;
let telemetriaMensalEsp32 = [];
let tipoRegistroAtual = "inspecao";
let relatorioEditadoManualmente = false;
let relatorioEnviadoEm = null;
let ultimoRelatorioGerado = "";

// Métricas que o sistema sabe medir (mesmos códigos usados no banco e no cadastro de sensores).
const METRICAS_TELEMETRIA = {
  temperatura: { nome: "Temperatura", unidade: "°C", cor: "#ef6c00" },
  umidadeAr: { nome: "Umidade do ar", unidade: "%", cor: "#1565c0" },
  umidadeSolo: { nome: "Umidade do solo", unidade: "%", cor: "#2e7d32" },
};
const PALETA_TALHOES = ["#2e7d32", "#1565c0", "#ef6c00", "#6a1b9a", "#c62828", "#00838f"];
// Talhão onde o ESP32 está instalado. Os dados do ThingSpeak são mostrados só para ele.
const TALHAO_DO_ESP32 = "A1";

function dataLocalISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function configurarAbas() {
  const paineis = [...document.querySelectorAll(".painel-aba-tecnico")];
  const links = [...document.querySelectorAll(".menu .nav-link")];

  const ativar = (idPainel) => {
    paineis.forEach((painel) => {
      painel.hidden = painel.id !== idPainel;
    });
    links.forEach((link) => {
      const ativo = link.hash === `#${idPainel}`;
      link.classList.toggle("active", ativo);
      if (ativo) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  links.forEach((link) => link.addEventListener("click", (evento) => {
    const id = link.hash.slice(1);
    if (!paineis.some((painel) => painel.id === id)) return;
    evento.preventDefault();
    ativar(id);
    history.replaceState(null, "", link.hash);
  }));

  if (paineis.length) {
    const idInicial = window.location.hash.slice(1);
    const existe = paineis.some((painel) => painel.id === idInicial);
    ativar(existe ? idInicial : paineis[0].id);
  }
}

function configurarRelatorioDiario() {
  const formulario = document.getElementById("form-relatorio-diario");
  const campo = document.getElementById("relatorio-conteudo");
  campo?.addEventListener("input", () => {
    relatorioEditadoManualmente = campo.value !== ultimoRelatorioGerado;
  });
  document.getElementById("relatorio-data")?.addEventListener("change", () => {
    relatorioEnviadoEm = null;
    atualizarRelatorioAutomatico({ forcar: true });
  });
  document.getElementById("btn-regenerar-relatorio")?.addEventListener("click", () => {
    atualizarRelatorioAutomatico({ forcar: true });
    exibirMensagem("mensagem-relatorio-diario", "Texto regenerado com os registros mais recentes.", "sucesso");
  });
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    try {
      if (!FrutLog.AUTENTICACAO_API_ATIVA) {
        throw new Error("O envio de relatórios requer a API autenticada.");
      }
      const resposta = await FrutLog.apiFetch("/relatorios-diarios", {
        method: "POST",
        body: JSON.stringify(dados),
      });
      exibirMensagem(
        "mensagem-relatorio-diario",
        `Relatório registrado e disponível para Engenharia e Administração (${formatarData(resposta.relatorio.data_relatorio)}).`,
        "sucesso"
      );
      relatorioEnviadoEm = dados.data;
      preencherTexto("relatorio-auto-status", `Relatório de ${formatarData(dados.data)} enviado.`);
    } catch (erro) {
      exibirMensagem("mensagem-relatorio-diario", erro.message, "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function verificarSessao() {
  return FrutLog.verificarSessao(["tecnico"]);
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

function normalizarClasse(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function preencherTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor;
}

function atualizarTalhoesMonitorados() {
  if (FrutLog.AUTENTICACAO_API_ATIVA) return;
  talhoes = talhoes.map((feature) => FrutLogTalhoes.aplicarMonitoramento(feature));
}

async function carregarPainelTecnico() {
  const [painel, talhoesServidor] = await Promise.all([
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLogMapaTalhoes.carregarMapaTalhoes("tecnico"),
  ]);
  painelTecnico = painel;
  sensoresDoServidor = painel.sensores || [];
  talhoes = talhoesServidor;
  atualizarSelectSensoresRegistro();

  const plantioPorTalhao = new Map((painel.plantios || []).map((plantio) => [plantio.talhao, plantio]));
  const monitoramentoPorTalhao = new Map((painel.talhoes || []).map((talhao) => [talhao.id, talhao]));
  const sensoresPorTalhao = new Map();
  sensoresDoServidor.forEach((sensor) => {
    if (!sensoresPorTalhao.has(sensor.talhao)) sensoresPorTalhao.set(sensor.talhao, []);
    sensoresPorTalhao.get(sensor.talhao).push(sensor);
  });

  talhoes = talhoes.map((feature) => {
    const codigo = feature.properties.codigo;
    const estado = monitoramentoPorTalhao.get(codigo);
    const plantio = plantioPorTalhao.get(codigo);
    const sensores = sensoresPorTalhao.get(codigo) || [];
    const sensorAtivo = (tipo) => sensores.find((item) => item.tipo === tipo && item.status !== "Inativo");
    const temperatura = sensorAtivo("temperatura");
    const umidadeSolo = sensorAtivo("umidadeSolo");
    const umidadeAr = sensorAtivo("umidadeAr");
    const props = {
      ...feature.properties,
      produto: plantio?.produto || feature.properties.produto || "--",
      variedade: plantio?.variedade || feature.properties.variedade || "--",
      solo: plantio?.solo || feature.properties.solo || "--",
      plantio: plantio?.plantado_em || feature.properties.plantio || "--",
      colheita: plantio?.previsao_colheita || feature.properties.colheita || "--",
      area: `${feature.properties.area_hectares ?? feature.properties.area ?? "--"}${feature.properties.area_hectares ? " hectares" : ""}`,
      sensor: estado?.sensor || sensores[0]?.sensor || "Não associado",
      status: estado?.situacao || "Sem leitura",
      prioridade: estado?.prioridade || "Aguardando leitura de sensor.",
      diaria: {
        ...feature.properties.diaria,
        temperatura: temperatura?.valor ?? "--",
        umidadeSolo: umidadeSolo?.valor ?? "--",
        umidadeAr: umidadeAr?.valor ?? "--",
      },
      monitoramento: {
        temperaturaAtual: temperatura?.valor ?? null,
        temperaturaMaxima: feature.properties.parametros?.temperaturaMaxima ?? null,
      },
    };
    return FrutLogTalhoes.aplicarMonitoramento({ ...feature, properties: props });
  });

  historicoInspecoes = painel.inspecoes || [];
  historicoOcorrencias = painel.ocorrencias || [];
  historicoProblemasSensores = painel.problemasSensores || [];
  exibirMensagem("mensagem-dados-tecnicos", "Dados sincronizados com o servidor.", "sucesso");
  preencherFiltroTelemetria();
  carregarGraficoMetricas();
}

function preencherFiltroTelemetria() {
  const select = document.getElementById("filtro-talhao-telemetria");
  if (!select) return;
  const selecionado = select.value;
  const codigos = talhoes.map((feature) => feature.properties.codigo);
  select.innerHTML = '<option value="">Todos os talhões</option>' +
    codigos.map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(codigo)}</option>`).join("");
  if (codigos.includes(selecionado)) select.value = selecionado;
}

async function carregarTelemetriaDiaria() {
  const tabela = document.getElementById("tabela-telemetria-tecnico");
  if (!tabela || !FrutLog.AUTENTICACAO_API_ATIVA) return;
  const mensagem = document.getElementById("mensagem-telemetria-diaria");
  try {
    const resposta = await FrutLog.apiFetch("/telemetria/diaria");
    telemetriaDiaria = resposta.leituras || [];
    telemetriaMensal = resposta.mensal || [];
    try {
      telemetriaMensalEsp32 = (await FrutLog.apiFetch("/telemetria/esp32-mensal")).mensal || [];
    } catch (erro) {
      telemetriaMensalEsp32 = [];
    }
    renderizarTelemetriaDiaria();
    renderizarTelemetriaMensal();
    renderizarGraficoClimaMensalTecnico();
    carregarGraficoMetricas();
    if (mensagem) {
      mensagem.textContent = `Consolidado desde ${formatarData(resposta.desde)}.`;
      mensagem.className = "mensagem-feedback";
    }
  } catch (erro) {
    if (mensagem) {
      mensagem.textContent = erro.message;
      mensagem.className = "mensagem-feedback erro";
    }
    tabela.innerHTML = `<tr><td colspan="6">${escaparHtml(erro.message)}</td></tr>`;
  }
}

function renderizarTelemetriaDiaria() {
  renderizarResumoTelemetriaDiaria();
  const tabela = document.getElementById("tabela-telemetria-tecnico");
  if (!tabela) return;
  const talhaoSelecionado = document.getElementById("filtro-talhao-telemetria")?.value || "";
  const metricaSelecionada = document.getElementById("filtro-metrica-telemetria")?.value || "";
  const linhas = telemetriaDiaria.filter((item) =>
    (!talhaoSelecionado || item.talhao === talhaoSelecionado) &&
    (!metricaSelecionada || item.codigo_metrica === metricaSelecionada));
  if (!linhas.length) {
    tabela.innerHTML = '<tr><td colspan="6">Ainda não há telemetria diária para o filtro selecionado.</td></tr>';
    return;
  }
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
  };
  tabela.innerHTML = linhas.map((item) => `
    <tr>
      <td>${escaparHtml(formatarData(item.dia))}</td>
      <td>${escaparHtml(item.talhao)} · ${escaparHtml(metricas[item.codigo_metrica] || item.codigo_metrica)}</td>
      <td>${escaparHtml(item.valor_medio)}</td>
      <td>${escaparHtml(item.valor_minimo)}</td>
      <td>${escaparHtml(item.valor_maximo)}</td>
      <td>${escaparHtml(item.leituras_contabilizadas)}</td>
    </tr>
  `).join("");
}

function renderizarResumoTelemetriaDiaria() {
  const tabela = document.getElementById("tabela-telemetria-diaria");
  if (!tabela) return;
  const filtro = document.getElementById("filtro-talhao-telemetria")?.value || "";
  const grupos = new Map();
  telemetriaDiaria.filter((item) => !filtro || item.talhao === filtro).forEach((item) => {
    const chave = JSON.stringify([item.dia, item.talhao]);
    if (!grupos.has(chave)) grupos.set(chave, { dia: item.dia, talhao: item.talhao, valores: {} });
    grupos.get(chave).valores[item.codigo_metrica] = item.valor_medio;
  });
  const linhas = [...grupos.values()].sort((a, b) => String(b.dia).localeCompare(String(a.dia)) || String(a.talhao).localeCompare(String(b.talhao)));
  tabela.innerHTML = linhas.length ? linhas.map((item) => `
    <tr><td>${escaparHtml(formatarData(item.dia))}</td><td>${escaparHtml(item.talhao)}</td>
    ${["temperatura", "umidadeAr", "umidadeSolo"].map((metrica) => `<td>${escaparHtml(item.valores[metrica] ?? "--")}</td>`).join("")}</tr>
  `).join("") : '<tr><td colspan="5">Ainda não há telemetria diária para o filtro selecionado.</td></tr>';
}

function renderizarTelemetriaMensal() {
  const tabela = document.getElementById("tabela-telemetria-mensal-tecnico");
  if (!tabela) return;
  // O ESP32 (ThingSpeak) não é vinculado a talhão; mínimo, máximo e leituras vêm calculados pelo servidor.
  const linhasEsp32 = telemetriaMensalEsp32.map((item) => ({
    ...item,
    talhao: "ESP32 (ThingSpeak)",
  }));
  const linhas = [...telemetriaMensal, ...linhasEsp32]
    .sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  if (!linhas.length) {
    tabela.innerHTML = '<tr><td colspan="6">Ainda não há consolidado mensal de telemetria.</td></tr>';
    return;
  }
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
  };
  tabela.innerHTML = linhas.map((item) => `
    <tr>
      <td>${escaparHtml(item.mes)}</td>
      <td>${escaparHtml(item.talhao)} · ${escaparHtml(metricas[item.codigo_metrica] || item.codigo_metrica)}</td>
      <td>${escaparHtml(item.valor_medio ?? "--")}</td>
      <td>${escaparHtml(item.valor_minimo ?? "--")}</td>
      <td>${escaparHtml(item.valor_maximo ?? "--")}</td>
      <td>${escaparHtml(item.leituras_contabilizadas ?? "--")}</td>
    </tr>
  `).join("");
}

function renderizarGraficoClimaMensalTecnico() {
  const canvas = document.getElementById("grafico-clima-mensal-tecnico");
  if (!canvas || typeof Chart === "undefined") return;
  if (graficoClimaMensalTecnico) graficoClimaMensalTecnico.destroy();

  const dadosMensais = [...telemetriaMensal, ...telemetriaMensalEsp32];
  const meses = [...new Set(dadosMensais.map((item) => item.mes).filter(Boolean))].sort();
  const mediaDoMes = (mes, codigo) => {
    const valores = dadosMensais
      .filter((item) => item.mes === mes && item.codigo_metrica === codigo && Number.isFinite(Number(item.valor_medio)))
      .map((item) => Number(item.valor_medio));
    return valores.length ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : null;
  };

  graficoClimaMensalTecnico = new Chart(canvas, {
    type: "line",
    data: {
      labels: meses,
      datasets: Object.entries(METRICAS_TELEMETRIA).map(([codigo, info]) => ({
        label: `${info.nome} (${info.unidade})`,
        data: meses.map((mes) => mediaDoMes(mes, codigo)),
        borderColor: info.cor,
        backgroundColor: info.cor,
        tension: 0.3,
        borderWidth: 2,
        spanGaps: true,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "°C / %" } },
      },
    },
  });
}

function formatarData(dataISO) {
  if (!dataISO) return "--";
  const data = String(dataISO).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return data ? `${data[3]}/${data[2]}/${data[1]}` : dataISO;
}

function obterPontos(feature) {
  return FrutLogTalhoes.obterPontos(feature);
}

function pontosParaString(pontos) {
  return pontos.map((ponto) => `${ponto[0]},${ponto[1]}`).join(" ");
}

function obterSensores() {
  if (FrutLog.AUTENTICACAO_API_ATIVA) return sensoresDoServidor;
  atualizarTalhoesMonitorados();

  return talhoes.map((feature) => {
    const props = feature.properties;
    const monitoramento = props.monitoramento || {};

    return {
      sensor: props.sensor || "Não associado",
      talhao: props.codigo,
      status: props.sensor === "Não associado" ? "Atencao" : monitoramento.status || props.status,
      comunicacao: props.apontamentoTecnico?.data || "--",
      leitura: monitoramento.temperaturaAtual !== null && monitoramento.temperaturaAtual !== undefined
        ? `${monitoramento.temperaturaAtual} C`
        : "--",
    };
  });
}

function obterTarefasDia() {
  if (FrutLog.AUTENTICACAO_API_ATIVA) return painelTecnico.tarefas || [];
  atualizarTalhoesMonitorados();

  return talhoes
    .filter((feature) => feature.properties.status !== "Normal" || feature.properties.sensor === "Não associado")
    .map((feature) => ({
      talhao: feature.properties.codigo,
      prioridade: feature.properties.status === "Critico" ? "Critico" : "Atencao",
      atividade: feature.properties.prioridade || "Verificar situação do talhão.",
    }));
}

function obterAlertas() {
  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    return (painelTecnico.alertas || []).map((alerta) => ({
      nivel: alerta.severidade || "atencao",
      titulo: alerta.titulo,
      texto: alerta.mensagem,
    }));
  }
  atualizarTalhoesMonitorados();

  return talhoes
    .filter((feature) => feature.properties.status !== "Normal" || feature.properties.sensor === "Não associado")
    .map((feature) => ({
      nivel: feature.properties.status === "Critico" ? "critico" : "atencao",
      titulo: `Talhão ${feature.properties.codigo} exige acompanhamento`,
      texto: feature.properties.sensor === "Não associado"
        ? "Talhão sem sensor associado após configuração ou divisão."
        : feature.properties.prioridade,
    }));
}

function preencherSelectTalhoes(select) {
  if (!select) return;

  const atual = select.value;
  const opcoes = talhoes
    .map((feature) => {
      const codigo = escaparHtml(feature.properties.codigo);
      return `<option value="${codigo}">${codigo}</option>`;
    })
    .join("");
  select.innerHTML = `<option value="">${opcoes ? "Selecione o talhão" : "Nenhum talhão carregado"}</option>${opcoes}`;
  if (talhoes.some((feature) => feature.properties.codigo === atual)) select.value = atual;
}

function nomeMetrica(codigo) {
  return METRICAS_TELEMETRIA[codigo]?.nome || codigo || "Métrica";
}

function rotuloStatusSensor(status) {
  return ({ Online: "Online", Offline: "Offline", Manutencao: "Em manutenção", Desativado: "Desativado" })[status] || status || "Sem status";
}

function valorSensorValido(sensor) {
  return sensor.valor !== null && sensor.valor !== undefined && sensor.valor !== "" && Number.isFinite(Number(sensor.valor));
}

// Sensores reais cadastrados (vindos do servidor) e ativos no talhão escolhido.
function sensoresAtivosDoTalhao(codigoTalhao) {
  if (!codigoTalhao) return [];
  return sensoresDoServidor.filter((sensor) => sensor.ativo && sensor.talhao === codigoTalhao);
}

function atualizarSelectSensoresRegistro() {
  const select = document.getElementById("registro-sensor");
  if (!select) return;
  const ajuda = document.getElementById("registro-sensor-ajuda");
  const codigoTalhao = document.getElementById("registro-talhao")?.value || "";
  const anterior = select.value;
  const sensores = sensoresAtivosDoTalhao(codigoTalhao);
  const rotuloVazio = tipoRegistroAtual === "sensor" ? "Sensor ausente / não cadastrado" : "Sem sensor associado";

  select.innerHTML = `<option value="">${rotuloVazio}</option>` + sensores
    .map((sensor) => `<option value="${escaparHtml(sensor.id)}">${escaparHtml(sensor.sensor)} · ${escaparHtml(nomeMetrica(sensor.tipo))} (${escaparHtml(rotuloStatusSensor(sensor.status))})</option>`)
    .join("");
  // Mantém a escolha do técnico quando o painel é sincronizado a cada 15 s.
  if (sensores.some((sensor) => sensor.id === anterior)) select.value = anterior;

  if (ajuda) {
    ajuda.textContent = !codigoTalhao
      ? "Selecione um talhão para listar os sensores cadastrados nele."
      : sensores.length
        ? `${sensores.length} sensor(es) ativo(s) cadastrado(s) no talhão ${codigoTalhao}.`
        : `Nenhum sensor ativo cadastrado no talhão ${codigoTalhao}.`;
  }
}

function carregarTarefasDia() {
  const lista = document.getElementById("lista-tarefas");
  if (!lista) return;

  const tarefasDia = obterTarefasDia();

  if (!tarefasDia.length) {
    lista.innerHTML = '<article class="tarefa-card"><strong>Sem tarefas pendentes</strong><p>Não há tarefas atribuídas no momento.</p></article>';
    return;
  }

  lista.innerHTML = tarefasDia.map((tarefa) => `
    <article class="tarefa-card ${normalizarClasse(tarefa.prioridade)}">
      <span class="badge-status ${normalizarClasse(tarefa.prioridade)}">Talhão ${escaparHtml(tarefa.talhao)}</span>
      <strong>${escaparHtml(FrutLog.textoInterface(tarefa.prioridade))}</strong>
      <p>${escaparHtml(tarefa.atividade)}</p>
    </article>
  `).join("");
}

function carregarTalhoes() {
  const lista = document.getElementById("lista-talhoes");

  atualizarTalhoesMonitorados();
  renderizarBotoesTalhao();
  renderizarMapa();

  if (lista) {
    lista.innerHTML = talhoes.length ? talhoes.map((feature) => {
      const props = feature.properties;
      return `
        <article class="talhao-card ${normalizarClasse(props.status)}">
          <h3>Talhão ${escaparHtml(props.codigo)}</h3>
          <p><strong>Situação:</strong> ${escaparHtml(FrutLog.textoInterface(props.status))}</p>
          <p><strong>Cultura:</strong> ${escaparHtml(props.produto)} ${escaparHtml(props.variedade)}</p>
          <p><strong>Área:</strong> ${escaparHtml(props.area)}</p>
          <button class="btn-filtro" type="button" data-selecionar-talhao="${escaparHtml(props.codigo)}">Ver no mapa</button>
        </article>
      `;
    }).join("") : '<article class="tarefa-card"><strong>Nenhum talhão cadastrado</strong><p>Os talhões aparecerão aqui após o cadastro e sincronização.</p></article>';
  }

  preencherSelectTalhoes(document.getElementById("registro-talhao"));
  atualizarSelectSensoresRegistro();
}

function renderizarBotoesTalhao() {
  const botoesTalhao = document.getElementById("botoes-talhao");
  if (!botoesTalhao) return;

  if (!talhoes.some((feature) => feature.properties.codigo === talhaoSelecionadoId)) {
    talhaoSelecionadoId = talhoes[0]?.properties.codigo || null;
  }
  botoesTalhao.innerHTML = talhoes.map((feature) => {
    const codigo = feature.properties.codigo;
    const ativo = codigo === talhaoSelecionadoId ? " active" : "";
    return `<button class="btn-talhao${ativo}" type="button" data-talhao="${escaparHtml(codigo)}">${escaparHtml(codigo)}</button>`;
  }).join("");
}

function renderizarMapa() {
  const svgMapa = document.getElementById("camada-talhoes");
  if (!svgMapa) return;

  atualizarTalhoesMonitorados();
  const pendentes = talhoes.filter((feature) => feature.properties.geometriaPendente).length;
  preencherTexto(
    "mensagem-geometria-talhoes",
    !talhoes.length
      ? "Nenhum talhão retornado pelo servidor. Verifique os cadastros e a fazenda vinculada."
      : pendentes
        ? `${pendentes} talhão(es) ainda sem limites desenhados no mapa. A Engenharia pode concluir o desenho.`
        : `${talhoes.length} talhão(es) carregado(s) do servidor.`
  );

  FrutLogMapaTalhoes.renderizarMapaTalhoes(svgMapa, talhoes, {
    selectedCode: talhaoSelecionadoId,
    statusFor: (feature) => feature.properties.status,
    onSelect: (feature) => selecionarTalhao(feature.properties.codigo),
  });
}

const ROTULOS_TIPO_REGISTRO = { inspecao: "Inspeção", ocorrencia: "Ocorrência" };

function carregarHistoricoRegistros() {
  const tabela = document.getElementById("tabela-registros-campo");
  if (!tabela) return;
  const filtro = document.getElementById("filtro-historico-tipo")?.value || "";

  const registros = [
    ...historicoInspecoes.map((item) => ({
      tipo: "inspecao", data: item.data, talhao: item.talhao, sensor: item.sensor,
      detalhe: `${FrutLog.textoInterface(item.situacao)} · ${item.problemas || "Sem ocorrência"}`,
      observacao: item.observacoes,
    })),
    ...historicoOcorrencias.map((item) => ({
      tipo: "ocorrencia", data: item.data, talhao: item.talhao, sensor: null,
      detalhe: item.tipo || item.problema, observacao: item.observacao,
    })),

  ]
    .filter((item) => !filtro || item.tipo === filtro)
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));

  tabela.innerHTML = registros.length ? registros.map((item) => `
    <tr>
      <td>${escaparHtml(formatarData(item.data))}</td>
      <td>${escaparHtml(ROTULOS_TIPO_REGISTRO[item.tipo])}</td>
      <td>${escaparHtml(item.talhao || "--")}</td>
      <td>${escaparHtml(item.sensor || "--")}</td>
      <td>${escaparHtml(item.detalhe || "--")}</td>
      <td>${escaparHtml(item.observacao || "-")}</td>
    </tr>
  `).join("") : '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
}

function selecionarTalhao(idTalhao) {
  atualizarTalhoesMonitorados();
  const talhao = talhoes.find((item) => item.properties.codigo === idTalhao);
  if (!talhao) return;

  talhaoSelecionadoId = idTalhao;
  const props = talhao.properties;
  const monitoramento = props.monitoramento || {};

  document.querySelectorAll(".btn-talhao").forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.talhao === idTalhao);
  });

  document.querySelectorAll(".talhao-mapa").forEach((area) => {
    area.classList.toggle("selecionado", area.dataset.talhao === idTalhao);
  });

  preencherTexto("tecnico-titulo-talhao", `Detalhes: Talhão ${props.codigo}`);
  preencherTexto("tecnico-talhao-produto", props.produto || "--");
  preencherTexto("tecnico-talhao-variedade", props.variedade || "--");
  preencherTexto("tecnico-talhao-area", props.area);
  preencherTexto("tecnico-talhao-solo", props.solo || "--");
  preencherTexto("tecnico-talhao-plantio", props.plantio || "--");
  preencherTexto("tecnico-talhao-colheita", props.colheita || "--");
  preencherTexto("tecnico-talhao-sensor", props.sensor || "Não associado");
  preencherTexto("tecnico-talhao-limite", monitoramento.temperaturaMaxima !== null && monitoramento.temperaturaMaxima !== undefined ? `${monitoramento.temperaturaMaxima} C` : "--");
  preencherTexto("tecnico-talhao-temperatura", monitoramento.temperaturaAtual !== null && monitoramento.temperaturaAtual !== undefined ? `${monitoramento.temperaturaAtual} C` : "--");
  preencherTexto("tecnico-talhao-umidade", props.diaria?.umidadeAr ? `${props.diaria.umidadeAr}% ar / ${props.diaria.umidadeSolo || "--"}% solo` : "--");
  preencherTexto("tecnico-talhao-prioridade", props.prioridade || "Rotina de acompanhamento");

  const badge = document.getElementById("tecnico-talhao-status");
  if (badge) {
    badge.textContent = FrutLog.textoInterface(props.status);
    badge.className = `badge-status ${classeStatusMapa(props.status)}`;
  }
}

function classeStatusMapa(status) {
  const normalizado = normalizarClasse(status).replace(/\s+/g, "-");
  return ["normal", "atencao", "critico", "sem-leitura"].includes(normalizado)
    ? normalizado
    : "normal";
}

function configurarMapaTalhoes() {
  document.getElementById("botoes-talhao")?.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".btn-talhao");
    if (botao) selecionarTalhao(botao.dataset.talhao);
  });
  document.getElementById("lista-talhoes")?.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-selecionar-talhao]");
    if (botao) selecionarTalhao(botao.dataset.selecionarTalhao);
  });
}

function carregarSensores() {
  const tabela = document.getElementById("tabela-sensores");
  const sensores = obterSensores();

  if (tabela) {
    if (!sensores.length) {
      tabela.innerHTML = '<tr><td colspan="5">Nenhum sensor cadastrado.</td></tr>';
    } else tabela.innerHTML = sensores.map((item) => `
      <tr>
        <td>${escaparHtml(item.sensor)}</td>
        <td>${escaparHtml(item.talhao)}</td>
        <td><span class="status-sensor ${normalizarClasse(item.status)}">${escaparHtml(FrutLog.textoInterface(item.status))}</span></td>
        <td>${escaparHtml(formatarData(item.comunicacao))}</td>
        <td>${escaparHtml(item.leitura)}</td>
      </tr>
    `).join("");
  }

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

function preencherFiltroMetricaTelemetria() {
  const select = document.getElementById("filtro-metrica-telemetria");
  if (!select) return;
  select.innerHTML = '<option value="">Todas as métricas</option>' + Object.entries(METRICAS_TELEMETRIA)
    .map(([codigo, info]) => `<option value="${codigo}">${escaparHtml(info.nome)}</option>`).join("");
}

function carregarAlertas() {
  const lista = document.getElementById("lista-alertas");
  if (!lista) return;

  const alertas = obterAlertas();

  if (!alertas.length) {
    lista.innerHTML = '<article class="alerta-tecnico"><strong>Sem alertas</strong><p>Nenhum alerta importante registrado.</p></article>';
    return;
  }

  lista.innerHTML = alertas.map((alerta) => `
    <article class="alerta-tecnico ${alerta.nivel}">
      <strong>${alerta.titulo}</strong>
      <p>${alerta.texto}</p>
    </article>
  `).join("");
}

function exibirMensagem(id, texto, tipo = "sucesso") {
  const elemento = document.getElementById(id);
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `mensagem-feedback ${tipo}`;
}

async function atualizarDadosAposRegistro() {
  await carregarPainelTecnico();
  carregarTalhoes();
  carregarTarefasDia();
  carregarHistoricoRegistros();
  carregarSensores();
  carregarAlertas();
  carregarGraficoMetricas();
  atualizarRelatorioAutomatico();
}

function obterDadosFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

function definirData(id, iso) {
  const campo = document.getElementById(id);
  if (!campo) return;
  campo.value = iso;
  if (campo._flatpickr) campo._flatpickr.setDate(iso, false);
}

function definirTipoRegistro(tipo) {
  tipoRegistroAtual = tipo;
  document.querySelectorAll("[data-tipo-registro]").forEach((botao) => {
    const ativo = botao.dataset.tipoRegistro === tipo;
    botao.classList.toggle("active", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });
  // Mostra só os campos do tipo escolhido; campos ocultos ficam desabilitados e não bloqueiam o envio.
  document.querySelectorAll("#form-registro-campo [data-tipos]").forEach((grupo) => {
    const visivel = grupo.dataset.tipos.split(" ").includes(tipo);
    grupo.hidden = !visivel;
    grupo.querySelectorAll("input, select, textarea").forEach((controle) => {
      controle.disabled = !visivel;
      if (controle.dataset.obrigatorio === "true") controle.required = visivel;
    });
  });
  const rotuloBotao = document.querySelector("#btn-registrar-campo span");
  if (rotuloBotao) rotuloBotao.textContent = `Registrar ${ROTULOS_TIPO_REGISTRO[tipo]}`;
  atualizarSelectSensoresRegistro();
  exibirMensagem("mensagem-registro-campo", "", "sucesso");
}

async function registrarCampo(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const dados = obterDadosFormulario(formulario);
  const botao = formulario.querySelector('[type="submit"]');
  if (botao) botao.disabled = true;

  try {
    if (!dados.talhao) throw new Error("Selecione o talhão.");
    if (tipoRegistroAtual !== "ocorrencia" && !/^\d{4}-\d{2}-\d{2}$/.test(dados.data || "")) {
      throw new Error("Selecione uma data válida.");
    }

    if (tipoRegistroAtual === "inspecao") {
      if (!dados.situacao) throw new Error("Informe a situação da plantação.");
      await FrutLog.apiFetch("/inspecoes", {
        method: "POST",
        body: JSON.stringify({
          talhao: dados.talhao,
          data: dados.data,
          situacao: dados.situacao,
          sensor_id: dados.sensor_id || null,
          problemas: dados.problemas || "Sem ocorrência",
          observacoes: dados.observacoes || "-",
        }),
      });
    } else if (tipoRegistroAtual === "ocorrencia") {
      if (!dados.tipo) throw new Error("Selecione o problema da ocorrência.");
      await FrutLog.apiFetch("/ocorrencias", {
        method: "POST",
        body: JSON.stringify({
          talhao: dados.talhao,
          tipo: dados.tipo,
          observacao: dados.observacoes || "-",
        }),
      });
    } else {
      if (!dados.problema) throw new Error("Descreva o problema do sensor.");
      const sensor = sensoresDoServidor.find((item) => item.id === dados.sensor_id);
      await FrutLog.apiFetch("/sensores/problemas", {
        method: "POST",
        body: JSON.stringify({
          sensor: sensor?.sensor || "",
          talhao: dados.talhao,
          data: dados.data,
          problema: dados.problema,
          observacao: dados.observacoes || "-",
        }),
      });
    }

    await atualizarDadosAposRegistro();
    exibirMensagem("mensagem-registro-campo", `${ROTULOS_TIPO_REGISTRO[tipoRegistroAtual]} registrada com sucesso. O relatório diário foi atualizado.`);
    // Limpa o formulário, mantendo talhão e data para lançar o próximo registro.
    const talhaoAtual = dados.talhao;
    const dataAtual = dados.data || dataLocalISO();
    formulario.reset();
    document.getElementById("registro-talhao").value = talhaoAtual;
    definirData("registro-data", dataAtual);
    atualizarSelectSensoresRegistro();
  } catch (erro) {
    exibirMensagem("mensagem-registro-campo", erro.message, "erro");
  } finally {
    if (botao) botao.disabled = false;
  }
}

function formatarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "--";
}

function montarRelatorioAutomatico(dia) {
  const doDia = (itens) => itens.filter((item) => String(item.data || "").slice(0, 10) === dia);
  const inspecoes = doDia(historicoInspecoes);
  const ocorrencias = doDia(historicoOcorrencias);

  const telemetria = telemetriaDiaria.filter((item) => String(item.dia).slice(0, 10) === dia);
  const hoje = dia === dataLocalISO();
  const tecnico = FrutLog.obterSessao?.()?.nome;
  const util = (valor) => {
    const texto = String(valor ?? "").trim();
    return texto && texto !== "-" ? texto : "";
  };
  const linhas = [`RELATÓRIO DIÁRIO DE CAMPO — ${formatarData(dia)}`];
  if (tecnico) linhas.push(`Técnico responsável: ${tecnico}`);

  linhas.push("", `1. INSPEÇÕES DE CAMPO (${inspecoes.length})`);
  if (inspecoes.length) {
    inspecoes.forEach((item) => {
      const partes = [`Talhão ${item.talhao}: situação ${FrutLog.textoInterface(item.situacao)}`];
      if (item.sensor) partes.push(`sensor ${item.sensor}`);
      partes.push(`problemas: ${util(item.problemas) || "sem ocorrência"}`);
      if (util(item.observacoes)) partes.push(`obs.: ${util(item.observacoes)}`);
      linhas.push(`- ${partes.join("; ")}.`);
    });
  } else linhas.push("- Nenhuma inspeção registrada neste dia.");

  linhas.push("", `2. OCORRÊNCIAS (${ocorrencias.length})`);
  if (ocorrencias.length) {
    ocorrencias.forEach((item) => {
      const obs = util(item.observacao);
      linhas.push(`- Talhão ${item.talhao}: ${item.tipo || item.problema}${obs ? ` — ${obs}` : ""}.`);
    });
  } else linhas.push("- Nenhuma ocorrência registrada neste dia.");



  linhas.push("", "3. TELEMETRIA DO DIA (médias por talhão)");
  const talhoesComTelemetria = [...new Set(telemetria.map((item) => item.talhao).filter(Boolean))].sort();
  if (talhoesComTelemetria.length) {
    talhoesComTelemetria.forEach((codigo) => {
      const partes = Object.entries(METRICAS_TELEMETRIA).flatMap(([metrica, info]) => {
        const leitura = telemetria.find((item) => item.talhao === codigo && item.codigo_metrica === metrica);
        return leitura
          ? [`${info.nome} ${formatarNumero(leitura.valor_medio)} ${info.unidade} (mín. ${formatarNumero(leitura.valor_minimo)} / máx. ${formatarNumero(leitura.valor_maximo)})`]
          : [];
      });
      linhas.push(`- Talhão ${codigo}: ${partes.join("; ")}.`);
    });
  } else linhas.push("- Sem leituras de sensores consolidadas para este dia.");

  const recomendacoes = new Set();
  if (hoje) {
    const fora = talhoes.filter((feature) => feature.properties.status !== "Normal");
    linhas.push("", "4. SITUAÇÃO ATUAL DOS TALHÕES");
    if (fora.length) {
      fora.forEach((feature) => {
        const props = feature.properties;
        linhas.push(`- Talhão ${props.codigo}: ${FrutLog.textoInterface(props.status)} — ${props.prioridade}.`);
        if (props.prioridade && props.status !== "Sem leitura") recomendacoes.add(`Talhão ${props.codigo}: ${props.prioridade}.`);
      });
    } else if (talhoes.length) linhas.push("- Todos os talhões estão em condição normal.");
    else linhas.push("- Nenhum talhão carregado.");
  }
  inspecoes.filter((item) => item.situacao === "Critico").forEach((item) => recomendacoes.add(`Priorizar o acompanhamento do talhão ${item.talhao} (inspeção crítica).`));

  ocorrencias.forEach((item) => recomendacoes.add(`Acompanhar a ocorrência "${item.tipo || item.problema}" no talhão ${item.talhao}.`));

  linhas.push("", `${hoje ? 5 : 4}. RECOMENDAÇÕES`);
  if (recomendacoes.size) [...recomendacoes].forEach((texto) => linhas.push(`- ${texto}`));
  else linhas.push("- Manter a rotina de acompanhamento dos talhões.");

  let texto = linhas.join("\n");
  if (texto.length > 6000) texto = `${texto.slice(0, 5940).trimEnd()}\n[Texto resumido: revise antes de enviar]`;
  const resumo = `${inspecoes.length} inspeção(ões), ${ocorrencias.length} ocorrência(s), telemetria de ${talhoesComTelemetria.length} talhão(ões)`;
  return { texto, resumo };
}

function atualizarRelatorioAutomatico({ forcar = false } = {}) {
  const campo = document.getElementById("relatorio-conteudo");
  const dia = document.getElementById("relatorio-data")?.value || "";
  if (!campo || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;

  if (!forcar && relatorioEnviadoEm === dia) {
    preencherTexto("relatorio-auto-status", `Relatório de ${formatarData(dia)} já enviado.`);
    return;
  }
  const { texto, resumo } = montarRelatorioAutomatico(dia);
  if (!forcar && relatorioEditadoManualmente) {
    preencherTexto(
      "relatorio-auto-status",
      texto !== ultimoRelatorioGerado
        ? "Texto editado por você. Há dados novos: use “Regenerar automaticamente” para incluí-los."
        : "Texto editado por você."
    );
    return;
  }
  ultimoRelatorioGerado = texto;
  relatorioEditadoManualmente = false;
  if (campo.value !== texto) campo.value = texto;
  preencherTexto("relatorio-auto-status", `Gerado automaticamente: ${resumo}.`);
}

function configurarFormularios() {
  document.getElementById("form-registro-campo")?.addEventListener("submit", registrarCampo);
  document.getElementById("registro-talhao")?.addEventListener("change", atualizarSelectSensoresRegistro);
  document.querySelectorAll("[data-tipo-registro]").forEach((botao) => {
    botao.addEventListener("click", () => definirTipoRegistro(botao.dataset.tipoRegistro));
  });
  definirTipoRegistro(tipoRegistroAtual);
  document.getElementById("filtro-historico-tipo")?.addEventListener("change", carregarHistoricoRegistros);
  document.getElementById("filtro-talhao-telemetria")?.addEventListener("change", renderizarTelemetriaDiaria);
  document.getElementById("filtro-metrica-telemetria")?.addEventListener("change", renderizarTelemetriaDiaria);
  document.getElementById("filtro-metrica-tecnico")?.addEventListener("change", carregarGraficoMetricas);
  document.getElementById("filtro-talhao-metrica-tecnico")?.addEventListener("change", carregarGraficoMetricas);
}
