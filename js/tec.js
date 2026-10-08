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
  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    try {
      await carregarPainelTecnico();
      await carregarTelemetriaDiaria();
    } catch (erro) {
      console.error("Falha ao carregar o painel do tecnico:", erro);
      exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
    }
  }
  carregarTalhoes();
  configurarMapaTalhoes();
  carregarTarefasDia();
  carregarHistoricoInspecoes();
  carregarHistoricoOcorrencias();
  carregarSensores();
  carregarHistoricoProblemasSensores();
  carregarAlertas();
  carregarGraficoMetricas();
  configurarFormularios();
  selecionarTalhao(talhoes[0]?.properties.codigo || "");

  if (FrutLog.AUTENTICACAO_API_ATIVA) {
    window.setInterval(async () => {
      try {
        await carregarPainelTecnico();
        await carregarTelemetriaDiaria();
        carregarTalhoes();
        carregarTarefasDia();
        carregarHistoricoInspecoes();
        carregarHistoricoOcorrencias();
        carregarSensores();
        carregarHistoricoProblemasSensores();
        carregarAlertas();
        carregarGraficoMetricas();
        selecionarTalhao(document.querySelector(".btn-talhao.active")?.dataset.talhao || talhoes[0]?.properties.codigo);
      } catch (erro) {
        console.error("Falha ao sincronizar o painel do tecnico:", erro);
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
let telemetriaDiaria = [];
let telemetriaMensal = [];
let talhaoSelecionadoId = null;

function dataLocalISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function configurarAbas() {
  const abas = [...document.querySelectorAll(".aba-tecnico")];
  const links = [...document.querySelectorAll(".menu .nav-link")];
  const ativar = (abaAtiva) => {
    abas.forEach((aba) => {
      const ativa = aba === abaAtiva;
      aba.classList.toggle("ativa", ativa);
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      document.getElementById(aba.getAttribute("aria-controls")).hidden = !ativa;
    });
    links.forEach((link) => {
      const ativo = link.hash === `#${abaAtiva.getAttribute("aria-controls")}`;
      link.classList.toggle("active", ativo);
      if (ativo) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  abas.forEach((aba, indice) => {
    aba.addEventListener("click", () => ativar(aba));
    aba.addEventListener("keydown", (evento) => {
      let proximo = indice;
      if (evento.key === "ArrowRight") proximo = (indice + 1) % abas.length;
      else if (evento.key === "ArrowLeft") proximo = (indice - 1 + abas.length) % abas.length;
      else if (evento.key === "Home") proximo = 0;
      else if (evento.key === "End") proximo = abas.length - 1;
      else return;
      evento.preventDefault();
      abas[proximo].focus();
      ativar(abas[proximo]);
    });
  });
  links.forEach((link) => link.addEventListener("click", (evento) => {
    const aba = abas.find((item) => item.getAttribute("aria-controls") === link.hash.slice(1));
    if (!aba) return;
    evento.preventDefault();
    ativar(aba);
    history.replaceState(null, "", link.hash);
  }));
  if (abas.length) ativar(abas[0]);
}

function configurarRelatorioDiario() {
  const formulario = document.getElementById("form-relatorio-diario");
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    try {
      if (!FrutLog.AUTENTICACAO_API_ATIVA) {
        throw new Error("O envio de relatorios requer a API autenticada.");
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
      formulario.reset();
      document.getElementById("relatorio-data").value = dataLocalISO();
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
  atualizarSelectSensoresInspecao();

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
      sensor: estado?.sensor || sensores[0]?.sensor || "Nao associado",
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
    return { ...feature, properties: props };
  });

  historicoInspecoes = painel.inspecoes || [];
  historicoOcorrencias = painel.ocorrencias || [];
  historicoProblemasSensores = painel.problemasSensores || [];
  exibirMensagem("mensagem-dados-tecnicos", "Dados sincronizados com o servidor.", "sucesso");
  preencherFiltroTelemetria();
}

function preencherFiltroTelemetria() {
  const select = document.getElementById("filtro-talhao-telemetria");
  if (!select) return;
  const selecionado = select.value;
  const codigos = talhoes.map((feature) => feature.properties.codigo);
  select.innerHTML = '<option value="">Todos os talhoes</option>' +
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
    renderizarTelemetriaDiaria();
    renderizarTelemetriaMensal();
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
  const tabela = document.getElementById("tabela-telemetria-tecnico");
  if (!tabela) return;
  const talhaoSelecionado = document.getElementById("filtro-talhao-telemetria")?.value || "";
  const linhas = telemetriaDiaria.filter((item) => !talhaoSelecionado || item.talhao === talhaoSelecionado);
  if (!linhas.length) {
    tabela.innerHTML = '<tr><td colspan="6">Ainda nao ha telemetria diaria para o filtro selecionado.</td></tr>';
    return;
  }
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
    chuva: "Chuva",
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

function renderizarTelemetriaMensal() {
  const tabela = document.getElementById("tabela-telemetria-mensal-tecnico");
  if (!tabela) return;
  if (!telemetriaMensal.length) {
    tabela.innerHTML = '<tr><td colspan="6">Ainda nao ha consolidado mensal de telemetria.</td></tr>';
    return;
  }
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
    chuva: "Chuva",
  };
  tabela.innerHTML = telemetriaMensal.map((item) => `
    <tr>
      <td>${escaparHtml(item.mes)}</td>
      <td>${escaparHtml(item.talhao)} · ${escaparHtml(metricas[item.codigo_metrica] || item.codigo_metrica)}</td>
      <td>${escaparHtml(item.valor_medio)}</td>
      <td>${escaparHtml(item.valor_minimo)}</td>
      <td>${escaparHtml(item.valor_maximo)}</td>
      <td>${escaparHtml(item.leituras_contabilizadas)}</td>
    </tr>
  `).join("");
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
      sensor: props.sensor || "Nao associado",
      talhao: props.codigo,
      status: props.sensor === "Nao associado" ? "Atencao" : monitoramento.status || props.status,
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
    .filter((feature) => feature.properties.status !== "Normal" || feature.properties.sensor === "Nao associado")
    .map((feature) => ({
      talhao: feature.properties.codigo,
      prioridade: feature.properties.status === "Critico" ? "Critico" : "Atencao",
      atividade: feature.properties.prioridade || "Verificar situacao do talhao.",
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
    .filter((feature) => feature.properties.status !== "Normal" || feature.properties.sensor === "Nao associado")
    .map((feature) => ({
      nivel: feature.properties.status === "Critico" ? "critico" : "atencao",
      titulo: `Talhao ${feature.properties.codigo} exige acompanhamento`,
      texto: feature.properties.sensor === "Nao associado"
        ? "Talhao sem sensor associado apos configuracao ou divisao."
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
  select.innerHTML = `<option value="">${opcoes ? "Selecione o talhao" : "Nenhum talhao carregado"}</option>${opcoes}`;
  if (talhoes.some((feature) => feature.properties.codigo === atual)) select.value = atual;
}

function atualizarSelectSensoresInspecao() {
  const select = document.getElementById("inspecao-sensor");
  const codigoTalhao = document.getElementById("inspecao-talhao")?.value;
  if (!select) return;
  const sensores = sensoresDoServidor.filter((sensor) => sensor.ativo && sensor.talhao === codigoTalhao);
  select.innerHTML = '<option value="">Sem sensor associado</option>' + sensores
    .map((sensor) => {
      const status = sensor.status === "Online" ? "Online" : "Cadastrado, aguardando leitura";
      return `<option value="${escaparHtml(sensor.id)}">${escaparHtml(sensor.sensor)} - ${escaparHtml(sensor.tipo)} (${status})</option>`;
    })
    .join("");
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
      <strong>${escaparHtml(tarefa.prioridade)}</strong>
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
          <p><strong>Situação:</strong> ${escaparHtml(props.status)}</p>
          <p><strong>Cultura:</strong> ${escaparHtml(props.produto)} ${escaparHtml(props.variedade)}</p>
          <p><strong>Área:</strong> ${escaparHtml(props.area)}</p>
          <button class="btn-filtro" type="button" data-selecionar-talhao="${escaparHtml(props.codigo)}">Ver no mapa</button>
        </article>
      `;
    }).join("") : '<article class="tarefa-card"><strong>Nenhum talhão cadastrado</strong><p>Os talhões aparecerão aqui após o cadastro e sincronização.</p></article>';
  }

  [
    "inspecao-talhao",
    "ocorrencia-talhao",
    "problema-sensor-talhao",
  ].forEach((id) => preencherSelectTalhoes(document.getElementById(id)));
  atualizarSelectSensoresInspecao();
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
      ? "Nenhum talhao retornado pelo servidor. Verifique os cadastros e a fazenda vinculada."
      : pendentes
        ? `${pendentes} talhao(es) ainda sem limites desenhados no mapa. A Engenharia pode concluir o desenho.`
        : `${talhoes.length} talhao(es) carregado(s) do servidor.`
  );

  FrutLogMapaTalhoes.renderizarMapaTalhoes(svgMapa, talhoes, {
    selectedCode: talhaoSelecionadoId,
    statusFor: (feature) => feature.properties.status,
    onSelect: (feature) => selecionarTalhao(feature.properties.codigo),
  });
}

function carregarHistoricoInspecoes() {
  const tabela = document.getElementById("tabela-inspecoes");
  if (!tabela) return;

  tabela.innerHTML = historicoInspecoes.map((inspecao) => `
    <tr>
      <td>${formatarData(inspecao.data)}</td>
      <td>${escaparHtml(inspecao.talhao)}</td>
      <td>${escaparHtml(inspecao.sensor || "--")}</td>
      <td><span class="status-sensor ${normalizarClasse(inspecao.situacao)}">${escaparHtml(inspecao.situacao)}</span></td>
      <td>${escaparHtml(inspecao.problemas || "Sem ocorrência")}</td>
      <td>${escaparHtml(inspecao.observacoes || "-")}</td>
    </tr>
  `).join("");
}

function carregarHistoricoOcorrencias() {
  const tabela = document.getElementById("tabela-ocorrencias");
  if (!tabela) return;

  if (!historicoOcorrencias.length) {
    tabela.innerHTML = '<tr><td colspan="3">Nenhuma ocorrência registrada.</td></tr>';
    return;
  }

  tabela.innerHTML = historicoOcorrencias.map((ocorrencia) => `
    <tr>
      <td>${escaparHtml(ocorrencia.talhao)}</td>
      <td>${escaparHtml(ocorrencia.tipo || ocorrencia.problema)}</td>
      <td>${escaparHtml(ocorrencia.observacao || "-")}</td>
    </tr>
  `).join("");
}

function carregarHistoricoProblemasSensores() {
  const tabela = document.getElementById("tabela-problemas-sensores");
  if (!tabela) return;

  if (!historicoProblemasSensores.length) {
    tabela.innerHTML = '<tr><td colspan="5">Nenhum problema de sensor registrado.</td></tr>';
    return;
  }

  tabela.innerHTML = historicoProblemasSensores.map((problema) => `
    <tr>
      <td>${escaparHtml(problema.sensor)}</td>
      <td>${escaparHtml(problema.talhao)}</td>
      <td>${formatarData(problema.data)}</td>
      <td>${escaparHtml(problema.problema)}</td>
      <td>${escaparHtml(problema.observacao || "-")}</td>
    </tr>
  `).join("");
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
    badge.textContent = props.status;
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
  const selectSensor = document.getElementById("problema-sensor-id");
  const sensores = obterSensores();

  if (tabela) {
    if (!sensores.length) {
      tabela.innerHTML = '<tr><td colspan="5">Nenhum sensor cadastrado.</td></tr>';
    } else tabela.innerHTML = sensores.map((item) => `
      <tr>
        <td>${escaparHtml(item.sensor)}</td>
        <td>${escaparHtml(item.talhao)}</td>
        <td><span class="status-sensor ${normalizarClasse(item.status)}">${escaparHtml(item.status)}</span></td>
        <td>${escaparHtml(formatarData(item.comunicacao))}</td>
        <td>${escaparHtml(item.leitura)}</td>
      </tr>
    `).join("");
  }

  if (selectSensor) {
    selectSensor.innerHTML = '<option value="">Sensor ausente / não cadastrado</option>' + sensores
      .filter((item) => item.ativo)
      .map((item) => `<option value="${escaparHtml(item.sensor)}">${escaparHtml(item.sensor)}</option>`)
      .join("");
  }
}

function carregarGraficoMetricas() {
  const select = document.getElementById("filtro-metrica-tecnico");
  const canvas = document.getElementById("grafico-metricas-tecnico");
  const mensagem = document.getElementById("mensagem-grafico-metricas");
  if (!select || !canvas || typeof Chart === "undefined") return;

  const metricas = [...new Set(obterSensores().map((sensor) => sensor.tipo).filter(Boolean))];
  const atual = select.value;
  const nomes = {
    temperatura: "Temperatura",
    umidadeSolo: "Umidade do solo",
    umidadeAr: "Umidade do ar",
    chuva: "Chuva",
  };
  select.innerHTML = metricas.length
    ? metricas.map((metrica) => `<option value="${escaparHtml(metrica)}">${escaparHtml(nomes[metrica] || metrica)}</option>`).join("")
    : '<option value="">Sem métricas</option>';
  if (metricas.includes(atual)) select.value = atual;

  const metricaAtual = select.value;
  const leituras = obterSensores().filter((sensor) =>
    sensor.tipo === metricaAtual && sensor.status !== "Inativo" &&
    sensor.valor !== null && sensor.valor !== undefined && sensor.valor !== "" &&
    Number.isFinite(Number(sensor.valor))
  );
  if (graficoMetricas) graficoMetricas.destroy();
  graficoMetricas = new Chart(canvas, {
    type: "bar",
    data: {
      labels: leituras.map((sensor) => `${sensor.sensor} (${sensor.unidade || ""})`),
      datasets: [{
        label: nomes[metricaAtual] || "Leitura",
        data: leituras.map((sensor) => Number(sensor.valor)),
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

  if (mensagem) {
    mensagem.textContent = leituras.length
      ? `${leituras.length} leitura(s) disponivel(is) para esta metrica.`
      : "Ainda nao ha leituras para a metrica selecionada.";
  }

  select.onchange = carregarGraficoMetricas;
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
  carregarHistoricoInspecoes();
  carregarHistoricoOcorrencias();
  carregarSensores();
  carregarHistoricoProblemasSensores();
  carregarAlertas();
  carregarGraficoMetricas();
}

function obterDadosFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

async function registrarInspecao(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    if (!dados.data || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
      throw new Error("Selecione uma data valida.");
    }

    await FrutLog.apiFetch("/inspecoes", {
      method: "POST",
      body: JSON.stringify({
        talhao: dados.talhao,
        data: dados.data,
        situacao: dados.situacao,
        sensor_id: dados.sensor_id || null,
        problemas: dados.problemas || "Sem ocorrencia",
        observacoes: dados.observacoes || "-"
      })
    });
    await atualizarDadosAposRegistro();
    exibirMensagem("mensagem-inspecao", "Inspeção registrada com sucesso.");
    evento.currentTarget.reset();
    document.getElementById("inspecao-data").value = dataLocalISO();
  } catch (erro) {
    exibirMensagem("mensagem-inspecao", erro.message, "erro");
  }
}

async function registrarOcorrencia(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    await FrutLog.apiFetch("/ocorrencias", {
      method: "POST",
      body: JSON.stringify({
        talhao: dados.talhao,
        tipo: dados.tipo,
        observacao: dados.observacao || "-"
      })
    });
    await atualizarDadosAposRegistro();
    exibirMensagem("mensagem-ocorrencia", "Ocorrência registrada com sucesso.");
    evento.currentTarget.reset();
  } catch (erro) {
    exibirMensagem("mensagem-ocorrencia", erro.message, "erro");
  }
}

async function registrarProblemaSensor(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    if (!dados.data || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
      throw new Error("Selecione uma data valida.");
    }

    await FrutLog.apiFetch("/sensores/problemas", {
      method: "POST",
      body: JSON.stringify({
        sensor: dados.sensor,
        talhao: dados.talhao,
        data: dados.data,
        problema: dados.problema,
        observacao: dados.observacao || "-"
      })
    });
    await atualizarDadosAposRegistro();
    exibirMensagem("mensagem-problema-sensor", "Problema de sensor registrado com sucesso.");
    evento.currentTarget.reset();
    document.getElementById("problema-sensor-data").value = dataLocalISO();
  } catch (erro) {
    exibirMensagem("mensagem-problema-sensor", erro.message, "erro");
  }
}

function configurarFormularios() {
  document.getElementById("form-inspecao")?.addEventListener("submit", registrarInspecao);
  document.getElementById("inspecao-talhao")?.addEventListener("change", atualizarSelectSensoresInspecao);
  atualizarSelectSensoresInspecao();
  document.getElementById("form-ocorrencia")?.addEventListener("submit", registrarOcorrencia);
  document.getElementById("form-problema-sensor")?.addEventListener("submit", registrarProblemaSensor);
  document.getElementById("filtro-talhao-telemetria")?.addEventListener("change", renderizarTelemetriaDiaria);
}
