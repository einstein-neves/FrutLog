/* =========================================================
   FRUTLOG - TECNICO AGRICOLA
   Visualizacao de talhoes e registros de campo.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  verificarSessao();
  FrutLog.configurarLogout();
  carregarTalhoes();
  configurarMapaTalhoes();
  carregarTarefasDia();
  carregarHistoricoInspecoes();
  carregarHistoricoOcorrencias();
  carregarSensores();
  carregarHistoricoProblemasSensores();
  carregarAlertas();
  configurarFormularios();
  selecionarTalhao(talhoes[0]?.properties.codigo || "");
});

let talhoes = FrutLogTalhoes.obterTalhoes();

const historicoInspecoes = [
  { data: "13/09/2026", talhao: "A2", situacao: "Atencao", problemas: "Umidade baixa", observacoes: "Monitorar proxima leitura do sensor." },
  { data: "12/09/2026", talhao: "B2", situacao: "Critico", problemas: "Sensor offline", observacoes: "Necessario checar comunicacao do equipamento." },
  { data: "11/09/2026", talhao: "B1", situacao: "Normal", problemas: "Sem ocorrencia", observacoes: "Plantacao em desenvolvimento regular." },
];

const historicoOcorrencias = [];
const historicoProblemasSensores = [];

function verificarSessao() {
  return FrutLog.verificarSessao(["tecnico"]);
}

function normalizarClasse(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function preencherTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor;
}

function atualizarTalhoesMonitorados() {
  talhoes = talhoes.map((feature) => FrutLogTalhoes.aplicarMonitoramento(feature));
}

function formatarData(dataISO) {
  if (!dataISO) return "--";
  const [ano, mes, dia] = dataISO.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataISO;
}

function obterPontos(feature) {
  return FrutLogTalhoes.obterPontos(feature);
}

function pontosParaString(pontos) {
  return pontos.map((ponto) => `${ponto[0]},${ponto[1]}`).join(" ");
}

function obterSensores() {
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

  select.innerHTML = '<option value="">Selecione o talhao</option>' + talhoes
    .map((feature) => `<option value="${feature.properties.codigo}">${feature.properties.codigo}</option>`)
    .join("");
}

function carregarTarefasDia() {
  const lista = document.getElementById("lista-tarefas");
  if (!lista) return;

  const tarefasDia = obterTarefasDia();

  if (!tarefasDia.length) {
    lista.innerHTML = '<article class="tarefa-card"><strong>Normal</strong><p>Nenhuma tarefa critica registrada para os talhoes.</p></article>';
    return;
  }

  lista.innerHTML = tarefasDia.map((tarefa) => `
    <article class="tarefa-card ${normalizarClasse(tarefa.prioridade)}">
      <span class="badge-status ${normalizarClasse(tarefa.prioridade)}">Talhao ${tarefa.talhao}</span>
      <strong>${tarefa.prioridade}</strong>
      <p>${tarefa.atividade}</p>
    </article>
  `).join("");
}

function carregarTalhoes() {
  const lista = document.getElementById("lista-talhoes");
  if (!lista) return;

  atualizarTalhoesMonitorados();
  renderizarBotoesTalhao();
  renderizarMapa();

  lista.innerHTML = talhoes.map((feature) => {
    const props = feature.properties;
    return `
      <article class="talhao-card ${normalizarClasse(props.status)}">
        <h3>Talhao ${props.codigo}</h3>
        <p><strong>Situacao:</strong> ${props.status}</p>
        <p><strong>Cultura:</strong> ${props.produto} ${props.variedade}</p>
        <p><strong>Area:</strong> ${props.area}</p>
      </article>
    `;
  }).join("");

  [
    "inspecao-talhao",
    "ocorrencia-talhao",
    "problema-sensor-talhao",
  ].forEach((id) => preencherSelectTalhoes(document.getElementById(id)));
}

function renderizarBotoesTalhao() {
  const botoesTalhao = document.getElementById("botoes-talhao");
  if (!botoesTalhao) return;

  botoesTalhao.innerHTML = talhoes.map((feature, index) => {
    const codigo = feature.properties.codigo;
    const ativo = index === 0 ? " active" : "";
    return `<button class="btn-talhao${ativo}" type="button" data-talhao="${codigo}">${codigo}</button>`;
  }).join("");
}

function renderizarMapa() {
  const svgMapa = document.getElementById("camada-talhoes");
  if (!svgMapa) return;

  atualizarTalhoesMonitorados();
  svgMapa.innerHTML = "";

  talhoes.forEach((feature, index) => {
    const props = feature.properties;
    const poligono = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

    poligono.setAttribute("points", pontosParaString(obterPontos(feature)));
    poligono.dataset.talhao = props.codigo;
    poligono.classList.add("talhao-mapa", `status-${normalizarClasse(props.status)}`);
    poligono.classList.toggle("selecionado", index === 0);
    poligono.addEventListener("click", () => selecionarTalhao(props.codigo));
    svgMapa.appendChild(poligono);
  });
}

function carregarHistoricoInspecoes() {
  const tabela = document.getElementById("tabela-inspecoes");
  if (!tabela) return;

  tabela.innerHTML = historicoInspecoes.map((inspecao) => `
    <tr>
      <td>${inspecao.data}</td>
      <td>${inspecao.talhao}</td>
      <td><span class="status-sensor ${normalizarClasse(inspecao.situacao)}">${inspecao.situacao}</span></td>
      <td>${inspecao.problemas || "Sem ocorrencia"}</td>
      <td>${inspecao.observacoes || "-"}</td>
    </tr>
  `).join("");
}

function carregarHistoricoOcorrencias() {
  const tabela = document.getElementById("tabela-ocorrencias");
  if (!tabela) return;

  if (!historicoOcorrencias.length) {
    tabela.innerHTML = '<tr><td colspan="3">Nenhuma ocorrencia registrada nesta sessao.</td></tr>';
    return;
  }

  tabela.innerHTML = historicoOcorrencias.map((ocorrencia) => `
    <tr>
      <td>${ocorrencia.talhao}</td>
      <td>${ocorrencia.problema}</td>
      <td>${ocorrencia.observacao || "-"}</td>
    </tr>
  `).join("");
}

function carregarHistoricoProblemasSensores() {
  const tabela = document.getElementById("tabela-problemas-sensores");
  if (!tabela) return;

  if (!historicoProblemasSensores.length) {
    tabela.innerHTML = '<tr><td colspan="5">Nenhum problema de sensor registrado nesta sessao.</td></tr>';
    return;
  }

  tabela.innerHTML = historicoProblemasSensores.map((problema) => `
    <tr>
      <td>${problema.sensor}</td>
      <td>${problema.talhao}</td>
      <td>${problema.data}</td>
      <td>${problema.problema}</td>
      <td>${problema.observacao || "-"}</td>
    </tr>
  `).join("");
}

function selecionarTalhao(idTalhao) {
  atualizarTalhoesMonitorados();
  const talhao = talhoes.find((item) => item.properties.codigo === idTalhao);
  if (!talhao) return;

  const props = talhao.properties;
  const monitoramento = props.monitoramento || {};

  document.querySelectorAll(".btn-talhao").forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.talhao === idTalhao);
  });

  document.querySelectorAll(".talhao-mapa").forEach((area) => {
    area.classList.toggle("selecionado", area.dataset.talhao === idTalhao);
  });

  preencherTexto("tecnico-titulo-talhao", `Detalhes: Talhao ${props.codigo}`);
  preencherTexto("tecnico-talhao-produto", props.produto || "--");
  preencherTexto("tecnico-talhao-variedade", props.variedade || "--");
  preencherTexto("tecnico-talhao-area", props.area);
  preencherTexto("tecnico-talhao-solo", props.solo || "--");
  preencherTexto("tecnico-talhao-plantio", props.plantio || "--");
  preencherTexto("tecnico-talhao-colheita", props.colheita || "--");
  preencherTexto("tecnico-talhao-sensor", props.sensor || "Nao associado");
  preencherTexto("tecnico-talhao-limite", monitoramento.temperaturaMaxima !== null && monitoramento.temperaturaMaxima !== undefined ? `${monitoramento.temperaturaMaxima} C` : "--");
  preencherTexto("tecnico-talhao-temperatura", monitoramento.temperaturaAtual !== null && monitoramento.temperaturaAtual !== undefined ? `${monitoramento.temperaturaAtual} C` : "--");
  preencherTexto("tecnico-talhao-umidade", props.diaria?.umidadeAr ? `${props.diaria.umidadeAr}% ar / ${props.diaria.umidadeSolo || "--"}% solo` : "--");
  preencherTexto("tecnico-talhao-prioridade", props.prioridade || "Rotina de acompanhamento");

  const badge = document.getElementById("tecnico-talhao-status");
  if (badge) {
    badge.textContent = props.status;
    badge.className = `badge-status ${normalizarClasse(props.status)}`;
  }
}

function configurarMapaTalhoes() {
  document.getElementById("botoes-talhao")?.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".btn-talhao");
    if (botao) selecionarTalhao(botao.dataset.talhao);
  });
}

function carregarSensores() {
  const tabela = document.getElementById("tabela-sensores");
  const selectSensor = document.getElementById("problema-sensor-id");
  const sensores = obterSensores();

  if (tabela) {
    tabela.innerHTML = sensores.map((item) => `
      <tr>
        <td>${item.sensor}</td>
        <td>${item.talhao}</td>
        <td><span class="status-sensor ${normalizarClasse(item.status)}">${item.status}</span></td>
        <td>${item.comunicacao}</td>
        <td>${item.leitura}</td>
      </tr>
    `).join("");
  }

  if (selectSensor) {
    selectSensor.innerHTML = '<option value="">Selecione o sensor</option>' + sensores
      .map((item) => `<option value="${item.sensor}">${item.sensor}</option>`)
      .join("");
  }
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

function obterDadosFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

async function registrarInspecao(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    console.info("Inspecao preparada para API:", dados);
    historicoInspecoes.unshift({
      data: formatarData(dados.data),
      talhao: dados.talhao,
      situacao: dados.situacao,
      problemas: dados.problemas || "Sem ocorrencia",
      observacoes: dados.observacoes || "-",
    });
    carregarHistoricoInspecoes();
    exibirMensagem("mensagem-inspecao", "Inspecao preparada para envio ao backend.");
    evento.currentTarget.reset();
  } catch (erro) {
    exibirMensagem("mensagem-inspecao", erro.message, "erro");
  }
}

async function registrarOcorrencia(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    console.info("Ocorrencia preparada para API:", dados);
    historicoOcorrencias.unshift({
      talhao: dados.talhao,
      problema: dados.tipo,
      observacao: dados.observacao || "-",
    });
    carregarHistoricoOcorrencias();
    exibirMensagem("mensagem-ocorrencia", "Ocorrencia preparada para envio ao backend.");
    evento.currentTarget.reset();
  } catch (erro) {
    exibirMensagem("mensagem-ocorrencia", erro.message, "erro");
  }
}

async function registrarProblemaSensor(evento) {
  evento.preventDefault();
  const dados = obterDadosFormulario(evento.currentTarget);

  try {
    console.info("Problema de sensor preparado para API:", dados);
    historicoProblemasSensores.unshift({
      sensor: dados.sensor,
      talhao: dados.talhao,
      data: formatarData(dados.data),
      problema: dados.problema,
      observacao: dados.observacao || "-",
    });
    carregarHistoricoProblemasSensores();
    exibirMensagem("mensagem-problema-sensor", "Problema preparado para envio ao backend.");
    evento.currentTarget.reset();
  } catch (erro) {
    exibirMensagem("mensagem-problema-sensor", erro.message, "erro");
  }
}

function configurarFormularios() {
  document.getElementById("form-inspecao")?.addEventListener("submit", registrarInspecao);
  document.getElementById("form-ocorrencia")?.addEventListener("submit", registrarOcorrencia);
  document.getElementById("form-problema-sensor")?.addEventListener("submit", registrarProblemaSensor);
}
