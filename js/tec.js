/* =========================================================
   FRUTLOG - TECNICO AGRICOLA
   Estrutura preparada para API REST e dados de IoT via backend.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  verificarSessao();
  FrutLog.configurarLogout();
  carregarTarefasDia();
  carregarTalhoes();
  configurarMapaTalhoes();
  carregarHistoricoInspecoes();
  carregarSensores();
  carregarAlertas();
  configurarFormularios();
  selecionarTalhao("A1");
});

const talhoes = [
  { id: "A1", situacao: "Normal", cultura: "Uva Isabel", area: "10 hectares", sensor: "TEMP-A1-01", leitura: "31 C", prioridade: "Rotina de acompanhamento" },
  { id: "A2", situacao: "Atencao", cultura: "Manga Tommy Atkins", area: "8 hectares", sensor: "SOLO-A2-01", leitura: "35%", prioridade: "Verificar umidade do solo" },
  { id: "B1", situacao: "Normal", cultura: "Uva Sugar Crisp", area: "9 hectares", sensor: "CHUVA-B1-01", leitura: "3,1 mm", prioridade: "Rotina de acompanhamento" },
  { id: "B2", situacao: "Critico", cultura: "Melao Goldex", area: "7,6 hectares", sensor: "SOLO-B2-01", leitura: "28%", prioridade: "Checar sensor e irrigacao" },
];

const sensores = [
  { sensor: "TEMP-A1-01", talhao: "A1", status: "Online", comunicacao: "13/09/2026 09:30", leitura: "31 C" },
  { sensor: "SOLO-A2-01", talhao: "A2", status: "Atencao", comunicacao: "13/09/2026 08:55", leitura: "35%" },
  { sensor: "CHUVA-B1-01", talhao: "B1", status: "Online", comunicacao: "13/09/2026 09:28", leitura: "3,1 mm" },
  { sensor: "SOLO-B2-01", talhao: "B2", status: "Offline", comunicacao: "12/09/2026 17:10", leitura: "28%" },
];

const alertas = [
  { nivel: "atencao", titulo: "Talhao A2 exige acompanhamento", texto: "Umidade do solo abaixo do ideal para a fase atual." },
  { nivel: "critico", titulo: "Sensor SOLO-B2-01 offline", texto: "Ultima comunicacao registrada em 12/09/2026 as 17:10." },
];

const tarefasDia = [
  { talhao: "B2", prioridade: "Critica", atividade: "Verificar sensor SOLO-B2-01 e irrigacao." },
  { talhao: "A2", prioridade: "Atencao", atividade: "Reavaliar umidade do solo no periodo da tarde." },
  { talhao: "A1", prioridade: "Normal", atividade: "Registrar vistoria preventiva da plantacao." },
];

const historicoInspecoes = [
  { data: "13/09/2026", talhao: "A2", situacao: "Atencao", problemas: "Umidade baixa", observacoes: "Monitorar proxima leitura do sensor." },
  { data: "12/09/2026", talhao: "B2", situacao: "Critico", problemas: "Sensor offline", observacoes: "Necessario checar comunicacao do equipamento." },
  { data: "11/09/2026", talhao: "B1", situacao: "Normal", problemas: "Sem ocorrencia", observacoes: "Plantacao em desenvolvimento regular." },
];

function verificarSessao() {
  return FrutLog.verificarSessao(["tecnico"]);
}

function normalizarClasse(texto) {
  return texto.toLowerCase();
}

function preencherTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.textContent = valor;
  }
}

function preencherSelectTalhoes(select) {
  if (!select) return;

  select.innerHTML = '<option value="">Selecione o talhao</option>' + talhoes
    .map((talhao) => `<option value="${talhao.id}">${talhao.id}</option>`)
    .join("");
}

function carregarTarefasDia() {
  const lista = document.getElementById("lista-tarefas");
  if (!lista) return;

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

  lista.innerHTML = talhoes.map((talhao) => `
    <article class="talhao-card ${normalizarClasse(talhao.situacao)}">
      <h3>Talhao ${talhao.id}</h3>
      <p><strong>Situacao:</strong> ${talhao.situacao}</p>
      <p><strong>Cultura:</strong> ${talhao.cultura}</p>
      <p><strong>Area:</strong> ${talhao.area}</p>
    </article>
  `).join("");

  [
    "inspecao-talhao",
    "ocorrencia-talhao",
    "problema-sensor-talhao",
  ].forEach((id) => preencherSelectTalhoes(document.getElementById(id)));
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

function selecionarTalhao(idTalhao) {
  const talhao = talhoes.find((item) => item.id === idTalhao);
  if (!talhao) return;

  document.querySelectorAll(".btn-talhao").forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.talhao === idTalhao);
  });

  document.querySelectorAll(".talhao-mapa").forEach((area) => {
    area.classList.toggle("selecionado", area.dataset.talhao === idTalhao);
  });

  preencherTexto("tecnico-titulo-talhao", `Detalhes: Talhao ${talhao.id}`);
  preencherTexto("tecnico-talhao-cultura", talhao.cultura);
  preencherTexto("tecnico-talhao-area", talhao.area);
  preencherTexto("tecnico-talhao-sensor", talhao.sensor);
  preencherTexto("tecnico-talhao-leitura", talhao.leitura);
  preencherTexto("tecnico-talhao-prioridade", talhao.prioridade);

  const badge = document.getElementById("tecnico-talhao-status");
  if (badge) {
    badge.textContent = talhao.situacao;
    badge.className = `badge-status ${normalizarClasse(talhao.situacao)}`;
  }
}

function configurarMapaTalhoes() {
  document.querySelectorAll(".btn-talhao").forEach((botao) => {
    botao.addEventListener("click", () => selecionarTalhao(botao.dataset.talhao));
  });

  document.querySelectorAll(".talhao-mapa").forEach((area) => {
    area.addEventListener("click", () => selecionarTalhao(area.dataset.talhao));
  });
}

function carregarSensores() {
  const tabela = document.getElementById("tabela-sensores");
  const selectSensor = document.getElementById("problema-sensor-id");

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
    // TODO: confirmar endpoint com o backend.
    // await FrutLog.apiFetch("/inspecoes", { method: "POST", body: JSON.stringify(dados) });
    console.info("Inspecao preparada para API:", dados);
    historicoInspecoes.unshift({
      data: dados.data,
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
    // TODO: confirmar endpoint com o backend.
    // await FrutLog.apiFetch("/ocorrencias", { method: "POST", body: JSON.stringify(dados) });
    console.info("Ocorrencia preparada para API:", dados);
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
    // TODO: confirmar endpoint com o backend.
    // await FrutLog.apiFetch("/sensores/problemas", { method: "POST", body: JSON.stringify(dados) });
    console.info("Problema de sensor preparado para API:", dados);
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
