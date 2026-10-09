/* =========================================================
   FRUTLOG - ADMINISTRADOR
   Gestao de usuarios, sensores, talhoes e operacao de campo.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  FrutLog.verificarSessao(["admin"]);
  FrutLog.configurarLogout();
  FrutLog.configurarAbasSidebar();
  configurarFormularioFuncionario();
  configurarFormularioSensor();
  configurarFiltrosFuncionarios();
  configurarAcoesTabelas();
  configurarGraficos();
  preencherSelectTalhoes();
  window.addEventListener("frutlog:colheitas-atualizadas", async () => {
    try {
      const resposta = await FrutLog.apiFetch("/colheitas/anual");
      definirColheitasAnuais(resposta.colheitas);
      renderizarGraficoColheita();
    } catch (erro) {
      exibirMensagem("mensagem-colheita-admin", erro.message, "erro");
    }
  });
  window.addEventListener("frutlog:talhoes-atualizados", atualizarDadosCampoConectados);
  const inicializacoes = await Promise.allSettled([
    carregarDadosConectados(),
    carregarMapaAdmin(),
  ]);
  const errosInicializacao = inicializacoes
    .filter((resultado) => resultado.status === "rejected")
    .map((resultado) => resultado.reason?.message || String(resultado.reason));
  renderizarMapaAdmin();
  if (errosInicializacao.length) {
    exibirMensagem("mensagem-carregamento-admin", `Falha ao carregar os dados: ${errosInicializacao.join(" | ")}`, "erro");
  }
});

let funcionarios = [];
let sensores = [];
let colheitasAnuais = [];
let painelTecnico = {
  talhoes: [],
  inspecoes: [],
  plantios: [],
  ocorrencias: [],
  problemasSensores: [],
  tarefas: [],
  alertas: [],
};
let graficoColheita = null;
let graficoLeituras = null;
let unidadeColheita = "t";
let graficoClima = null;
let telemetriaDiariaAdmin = [];
let telemetriaMensalAdmin = [];
let telemetriaMensalEsp32 = [];

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
}

function formatarData(valor) {
  if (!valor) return "--";
  const dataISO = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dataISO) return `${dataISO[3]}/${dataISO[2]}/${dataISO[1]}`;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return escaparHtml(valor);
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function exibirMensagem(id, texto, tipo = "") {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.className = `mensagem-feedback ${tipo}`.trim();
}

function mostrarLinhasVazias(id, colunas, texto = "Nenhum registro encontrado.") {
  const tabela = document.getElementById(id);
  if (tabela) tabela.innerHTML = `<tr><td colspan="${colunas}">${escaparHtml(texto)}</td></tr>`;
}

function gerarSenhaTemporaria() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const limiteSemVies = 256 - (256 % caracteres.length);
  let senha = "";
  while (senha.length < 10) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limiteSemVies) senha += caracteres[byte % caracteres.length];
      if (senha.length === 10) break;
    }
  }
  return senha;
}

function configurarFormularioFuncionario() {
  const formulario = document.getElementById("form-funcionario");
  const campoId = document.getElementById("funcionario-id");
  const campoMatricula = document.getElementById("funcionario-matricula");
  const campoSenha = document.getElementById("funcionario-senha");
  const botaoGerarSenha = document.getElementById("btn-gerar-senha");
  const botaoMostrarSenha = document.getElementById("btn-mostrar-senha");
  const botaoCopiarSenha = document.getElementById("btn-copiar-senha");
  const botaoSalvar = document.getElementById("btn-salvar-funcionario");
  const botaoCancelar = document.getElementById("btn-cancelar-edicao-funcionario");

  if (campoMatricula) {
    campoMatricula.value = "Gerada ao cadastrar";
    campoMatricula.required = false;
  }
  if (campoSenha) {
    campoSenha.value = gerarSenhaTemporaria();
    campoSenha.type = "text";
  }
  botaoGerarSenha?.addEventListener("click", () => {
    if (campoSenha) campoSenha.value = gerarSenhaTemporaria();
  });
  botaoMostrarSenha?.addEventListener("click", () => {
    const mostrar = campoSenha.type === "password";
    campoSenha.type = mostrar ? "text" : "password";
    botaoMostrarSenha.textContent = mostrar ? "Ocultar senha" : "Mostrar senha";
  });
  botaoCopiarSenha?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(campoSenha.value);
<<<<<<< HEAD
      exibirMensagem("mensagem-funcionario", "Senha provisoria copiada.", "sucesso");
    } catch (erro) {
      exibirMensagem("mensagem-funcionario", `Nao foi possivel copiar a senha: ${erro.message}`, "erro");
=======
      exibirMensagem("mensagem-funcionario", "Senha provisória copiada.", "sucesso");
    } catch (erro) {
      exibirMensagem("mensagem-funcionario", `Não foi possível copiar a senha: ${erro.message}`, "erro");
>>>>>>> master
    }
  });
  botaoCancelar?.addEventListener("click", () => {
    formulario.reset();
    campoId.value = "";
    campoMatricula.value = "Gerada ao cadastrar";
    campoSenha.required = true;
    campoSenha.type = "text";
    botaoMostrarSenha.textContent = "Ocultar senha";
    campoSenha.placeholder = "8 a 10 caracteres";
    campoSenha.value = gerarSenhaTemporaria();
    botaoCancelar.hidden = true;
<<<<<<< HEAD
    botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
=======
    botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionário';
>>>>>>> master
    exibirMensagem("mensagem-funcionario", "");
  });

  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const mensagemId = "mensagem-funcionario";

    const editando = Boolean(dados.id);
    const senhaProvisoriaUsada = dados.senha;
    if ((!editando || dados.senha) && (typeof dados.senha !== "string" || dados.senha.length < 8 || dados.senha.length > 10)) {
<<<<<<< HEAD
      exibirMensagem(mensagemId, "A senha provisoria deve possuir entre 8 e 10 caracteres.", "erro");
=======
      exibirMensagem(mensagemId, "A senha provisória deve possuir entre 8 e 10 caracteres.", "erro");
>>>>>>> master
      campoSenha?.focus();
      return;
    }

    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    try {
      const payload = {
        nome: dados.nome,
        cargo: dados.cargo,
        profissao: dados.profissao,
        perfil: dados.perfil,
        status: dados.status,
      };
      if (dados.senha) payload.senha = dados.senha;
      if (editando) {
        await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(dados.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        funcionarios = funcionarios.map((item) => String(item.id) === String(dados.id)
          ? { ...item, ...payload, status: payload.status, ativo: payload.status === "ativo" }
          : item);
<<<<<<< HEAD
        exibirMensagem(mensagemId, "Funcionario atualizado.", "sucesso");
=======
        exibirMensagem(mensagemId, "Funcionário atualizado.", "sucesso");
>>>>>>> master
      } else {
        const resposta = await FrutLog.apiFetch("/funcionarios", {
          method: "POST",
          body: JSON.stringify({ ...payload, senha: dados.senha }),
        });
        const novoFuncionario = {
          id: resposta.id,
          matricula: resposta.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          profissao: dados.profissao,
          perfil: dados.perfil,
          status: dados.status,
          ativo: dados.status === "ativo",
        };
        funcionarios.push(novoFuncionario);
<<<<<<< HEAD
        exibirMensagem(mensagemId, `Funcionario cadastrado. Matricula: ${novoFuncionario.matricula}. A senha devera ser alterada no primeiro acesso.`, "sucesso");
=======
        exibirMensagem(mensagemId, `Funcionário cadastrado. Matrícula: ${novoFuncionario.matricula}. A senha deverá ser alterada no primeiro acesso.`, "sucesso");
>>>>>>> master
      }
      renderizarFuncionarios();
      formulario.reset();
      campoId.value = "";
      campoMatricula.value = "Gerada ao cadastrar";
      campoSenha.required = true;
      campoSenha.placeholder = "8 a 10 caracteres";
      campoSenha.value = editando ? gerarSenhaTemporaria() : senhaProvisoriaUsada;
      campoSenha.type = "text";
      botaoMostrarSenha.textContent = "Ocultar senha";
      botaoCancelar.hidden = true;
<<<<<<< HEAD
      botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
      if (!editando) {
        exibirMensagem(mensagemId, "Funcionario cadastrado. A senha provisoria usada continua visivel abaixo para ser copiada; o funcionario devera altera-la no primeiro acesso.", "sucesso");
=======
      botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionário';
      if (!editando) {
        exibirMensagem(mensagemId, "Funcionário cadastrado. A senha provisória usada continua visivel abaixo para ser copiada; o funcionário deverá altera-la no primeiro acesso.", "sucesso");
>>>>>>> master
      }
    } catch (erro) {
      exibirMensagem(mensagemId, erro.message, "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function carregarFuncionarios() {
  const tabela = document.getElementById("tabela-funcionarios");
  if (!tabela) return;
  const termo = document.getElementById("filtro-funcionarios")?.value.trim().toLocaleLowerCase("pt-BR") || "";
  const statusFiltro = document.getElementById("filtro-status-funcionarios")?.value || "todos";
  const filtrados = funcionarios.filter((funcionario) => {
    const ativo = funcionario.status ? funcionario.status === "ativo" : funcionario.ativo === true;
    const combinaStatus = statusFiltro === "todos" || (statusFiltro === "ativo" ? ativo : !ativo);
    const texto = [funcionario.matricula, funcionario.nome, funcionario.cargo, funcionario.profissao, funcionario.perfil]
      .join(" ").toLocaleLowerCase("pt-BR");
    return combinaStatus && texto.includes(termo);
  });

  if (!filtrados.length) {
    mostrarLinhasVazias("tabela-funcionarios", 7);
    return;
  }

  tabela.innerHTML = filtrados.map((funcionario) => {
    const ativo = funcionario.status
      ? funcionario.status === "ativo"
      : funcionario.ativo === true;
    const status = ativo ? "ativo" : (funcionario.status || "inativo");
    const textoStatus = status === "excluido" ? "Excluido" : ativo ? "Ativo" : "Inativo";
    return `
      <tr>
        <td>${escaparHtml(funcionario.matricula)}</td>
        <td>${escaparHtml(funcionario.nome)}</td>
        <td>${escaparHtml(funcionario.cargo)}</td>
        <td>${escaparHtml(funcionario.profissao || "--")}</td>
<<<<<<< HEAD
        <td>${escaparHtml(funcionario.perfil)}</td>
=======
        <td>${escaparHtml(FrutLog.textoInterface(funcionario.perfil))}</td>
>>>>>>> master
        <td><span class="badge-status ${status}">${textoStatus}</span></td>
        <td>
          <button class="btn-acao-admin" type="button" data-alternar-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""} aria-label="${ativo ? "Desativar" : "Ativar"} ${escaparHtml(funcionario.nome)}">${ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn-acao-admin" type="button" data-editar-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""} aria-label="Editar ${escaparHtml(funcionario.nome)}">Editar</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""} aria-label="Excluir ${escaparHtml(funcionario.nome)}">Excluir</button>
        </td>
      </tr>`;
  }).join("");
}

function configurarFiltrosFuncionarios() {
  document.getElementById("filtro-funcionarios")?.addEventListener("input", carregarFuncionarios);
  document.getElementById("filtro-status-funcionarios")?.addEventListener("change", carregarFuncionarios);
}

function configurarAcoesTabelas() {
  document.getElementById("tabela-funcionarios")?.addEventListener("click", async (evento) => {
    const botaoStatus = evento.target.closest("[data-alternar-funcionario]");
    if (botaoStatus) {
      const id = botaoStatus.dataset.alternarFuncionario;
      const funcionario = funcionarios.find((item) => String(item.id) === String(id));
      if (!funcionario) return;

      const status = (funcionario.status ? funcionario.status === "ativo" : funcionario.ativo === true)
        ? "inativo"
        : "ativo";
      botaoStatus.disabled = true;
      try {
        await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        funcionarios = funcionarios.map((item) => String(item.id) === String(id)
          ? { ...item, status, ativo: status === "ativo" }
          : item);
        renderizarFuncionarios();
<<<<<<< HEAD
        exibirMensagem("mensagem-funcionario", `Funcionario ${status === "ativo" ? "ativado" : "desativado"}.`, "sucesso");
=======
        exibirMensagem("mensagem-funcionario", `Funcionário ${status === "ativo" ? "ativado" : "desativado"}.`, "sucesso");
>>>>>>> master
      } catch (erro) {
        botaoStatus.disabled = false;
        exibirMensagem("mensagem-funcionario", erro.message, "erro");
      }
      return;
    }

    const botaoEditar = evento.target.closest("[data-editar-funcionario]");
    if (botaoEditar) {
      const funcionario = funcionarios.find((item) => String(item.id) === botaoEditar.dataset.editarFuncionario);
      if (!funcionario) return;
      document.getElementById("funcionario-id").value = funcionario.id;
      document.getElementById("funcionario-matricula").value = funcionario.matricula;
      document.getElementById("funcionario-nome").value = funcionario.nome;
      document.getElementById("funcionario-cargo").value = funcionario.cargo;
      document.getElementById("funcionario-profissao").value = funcionario.profissao || "";
      document.getElementById("funcionario-perfil").value = funcionario.perfil;
      document.getElementById("funcionario-status").value = funcionario.status || (funcionario.ativo ? "ativo" : "inativo");
      document.getElementById("funcionario-senha").value = "";
      document.getElementById("funcionario-senha").required = false;
      document.getElementById("funcionario-senha").type = "text";
      document.getElementById("btn-mostrar-senha").textContent = "Ocultar senha";
      document.getElementById("funcionario-senha").placeholder = "Deixe vazio para manter a senha atual";
      document.getElementById("btn-cancelar-edicao-funcionario").hidden = false;
      document.getElementById("btn-salvar-funcionario").innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar Alteracoes';
<<<<<<< HEAD
      exibirMensagem("mensagem-funcionario", "Opcionalmente, defina uma nova senha provisoria; o funcionario precisara troca-la no proximo acesso.");
=======
      exibirMensagem("mensagem-funcionario", "Opcionalmente, defina uma nova senha provisória; o funcionário precisara troca-la no próximo acesso.");
>>>>>>> master
      document.getElementById("form-funcionario").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const botao = evento.target.closest("[data-excluir-funcionario]");
    if (!botao) return;
    const id = botao.dataset.excluirFuncionario;
    const funcionario = funcionarios.find((item) => String(item.id) === String(id));
<<<<<<< HEAD
    if (!funcionario || !window.confirm(`Excluir ${funcionario.nome} do sistema? Esta acao nao pode ser desfeita.`)) return;
=======
    if (!funcionario || !window.confirm(`Excluir ${funcionario.nome} do sistema? Esta ação não pode ser desfeita.`)) return;
>>>>>>> master

    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      funcionarios = funcionarios.filter((item) => String(item.id) !== String(id));
      renderizarFuncionarios();
<<<<<<< HEAD
      exibirMensagem("mensagem-funcionario", "Funcionario excluido.", "sucesso");
=======
      exibirMensagem("mensagem-funcionario", "Funcionário excluido.", "sucesso");
>>>>>>> master
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-funcionario", erro.message, "erro");
    }
  });

  document.getElementById("tabela-sensores-admin")?.addEventListener("click", async (evento) => {
    const botaoAlternar = evento.target.closest("[data-alternar-sensor]");
    if (botaoAlternar) {
      const id = botaoAlternar.dataset.alternarSensor;
      const sensor = sensores.find((item) => String(item.id) === String(id));
      if (!sensor) return;
      botaoAlternar.disabled = true;
      try {
        await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: sensor.ativo ? "inativo" : "ativo" }),
        });
        const resposta = await FrutLog.apiFetch("/sensores");
        sensores = resposta.sensores || [];
        renderizarSensores();
        renderizarGraficoLeituras();
        exibirMensagem("mensagem-sensor", `Sensor ${sensor.ativo ? "desativado" : "ativado"}.`, "sucesso");
      } catch (erro) {
        botaoAlternar.disabled = false;
        exibirMensagem("mensagem-sensor", erro.message, "erro");
      }
      return;
    }
    const botao = evento.target.closest("[data-excluir-sensor]");
    if (!botao) return;
    const id = botao.dataset.excluirSensor;
    const sensor = sensores.find((item) => String(item.id) === String(id));
<<<<<<< HEAD
    if (!sensor || !window.confirm(`Excluir o sensor ${sensor.sensor}? O historico de leituras associado tambem sera apagado.`)) return;
=======
    if (!sensor || !window.confirm(`Excluir o sensor ${sensor.sensor}? O histórico de leituras associado também será apagado.`)) return;
>>>>>>> master

    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, { method: "DELETE" });
      sensores = sensores.filter((item) => String(item.id) !== String(id));
      renderizarSensores();
      renderizarGraficoLeituras();
      exibirMensagem("mensagem-sensor", "Sensor e leituras historicas associadas excluidos.", "sucesso");
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-sensor", erro.message, "erro");
    }
  });
}

function configurarFormularioSensor() {
  const formulario = document.getElementById("form-sensor");
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;

    try {
      const resposta = await FrutLog.apiFetch("/sensores", {
        method: "POST",
        body: JSON.stringify(dados),
      });
      const sensor = {
        ...resposta.sensor,
        sensor: resposta.sensor.id_externo,
        id: resposta.sensor.id,
        talhao: dados.talhao,
        tipo: dados.tipo,
        unidade: dados.unidade,
        leitura: "Sem leitura",
        valor: null,
        status: "Offline",
        ativo: true,
      };
      sensores.push(sensor);
      renderizarSensores();
      renderizarGraficoLeituras();
      preencherSelectTalhoes();
      exibirMensagem("mensagem-sensor", `Sensor ${sensor.sensor} cadastrado.`, "sucesso");
      formulario.reset();
    } catch (erro) {
      exibirMensagem("mensagem-sensor", erro.message, "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function normalizarStatus(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function renderizarFuncionarios() {
  carregarFuncionarios();
}

function preencherSelectTalhoes() {
  const select = document.getElementById("sensor-talhao");
  if (!select) return;
  const selecionado = select.value;
  const codigos = (typeof FrutLogTalhoes === "undefined" ? [] : FrutLogTalhoes.obterTalhoes())
    .map((feature) => feature.properties.codigo);
  for (const talhao of painelTecnico.talhoes || []) {
    if (talhao.id && !codigos.includes(talhao.id)) codigos.push(talhao.id);
  }
<<<<<<< HEAD
  select.innerHTML = '<option value="">Selecione o talhao</option>' + codigos
=======
  select.innerHTML = '<option value="">Selecione o talhão</option>' + codigos
>>>>>>> master
    .map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(codigo)}</option>`)
    .join("");
  if (codigos.includes(selecionado)) select.value = selecionado;
}

function renderizarSensores() {
  const tabela = document.getElementById("tabela-sensores-admin");
  if (!tabela) return;
  if (!sensores.length) {
    mostrarLinhasVazias("tabela-sensores-admin", 6);
    return;
  }

  tabela.innerHTML = sensores.map((sensor) => {
    const status = sensor.status || (sensor.ativo === false ? "Inativo" : "Online");
    const statusClasse = normalizarStatus(status);
    return `
      <tr>
        <td>${escaparHtml(sensor.sensor || sensor.id_externo)}</td>
        <td>${escaparHtml(sensor.talhao || "--")}</td>
        <td>${escaparHtml(sensor.tipo || sensor.codigo_metrica)}</td>
        <td>${escaparHtml(sensor.leitura || "Sem leitura")}</td>
<<<<<<< HEAD
        <td><span class="badge-status ${statusClasse}">${escaparHtml(status)}</span></td>
=======
        <td><span class="badge-status ${statusClasse}">${escaparHtml(FrutLog.textoInterface(status))}</span></td>
>>>>>>> master
        <td>
          <button class="btn-acao-admin" type="button" data-alternar-sensor="${escaparHtml(sensor.id)}" aria-label="${sensor.ativo ? "Desativar" : "Ativar"} sensor ${escaparHtml(sensor.sensor || sensor.id_externo)}">${sensor.ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-sensor="${escaparHtml(sensor.id)}" aria-label="Excluir sensor ${escaparHtml(sensor.sensor || sensor.id_externo)}">Excluir</button>
        </td>
      </tr>`;
  }).join("");
}

function preencherTabela(id, colunas, linhas) {
  const tabela = document.getElementById(id);
  if (!tabela) return;
  if (!linhas.length) {
    mostrarLinhasVazias(id, colunas);
    return;
  }
  tabela.innerHTML = linhas.join("");
}

function renderizarPainelTecnico() {
  const talhoes = painelTecnico.talhoes || [];
  const inspecoes = painelTecnico.inspecoes || [];
  const plantios = painelTecnico.plantios || [];
  const ocorrencias = painelTecnico.ocorrencias || [];
  const problemas = painelTecnico.problemasSensores || painelTecnico.problemas_sensores || [];
  const tarefas = painelTecnico.tarefas || [];
  const alertas = painelTecnico.alertas || [];

  document.getElementById("resumo-total-talhoes").textContent = talhoes.length;
  document.getElementById("resumo-total-sensores").textContent = sensores.length || (painelTecnico.sensores || []).length;
  document.getElementById("resumo-total-inspecoes").textContent = inspecoes.length;
  document.getElementById("resumo-total-tarefas").textContent = tarefas.length;
  document.getElementById("resumo-total-alertas").textContent = alertas.length;

  preencherTabela("tabela-talhoes-admin", 7, talhoes.map((talhao) => `
    <tr>
      <td>${escaparHtml(talhao.id || talhao.talhao)}</td>
      <td>${escaparHtml(talhao.cultura || talhao.produto || "--")}</td>
      <td>${escaparHtml(talhao.area || "--")}</td>
      <td>${escaparHtml(talhao.sensor || "--")}</td>
      <td>${escaparHtml(talhao.leitura || "--")}</td>
<<<<<<< HEAD
      <td><span class="badge-status ${normalizarStatus(talhao.situacao || talhao.status)}">${escaparHtml(talhao.situacao || talhao.status || "--")}</span></td>
      <td>${escaparHtml(talhao.prioridade || "--")}</td>
=======
      <td><span class="badge-status ${normalizarStatus(talhao.situacao || talhao.status)}">${escaparHtml(FrutLog.textoInterface(talhao.situacao || talhao.status || "--"))}</span></td>
      <td>${escaparHtml(FrutLog.textoInterface(talhao.prioridade || "--"))}</td>
>>>>>>> master
    </tr>`));
  preencherTabela("tabela-inspecoes-admin", 6, inspecoes.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.talhao)}</td>
      <td>${escaparHtml(item.sensor || "--")}</td>
<<<<<<< HEAD
      <td><span class="badge-status ${normalizarStatus(item.situacao)}">${escaparHtml(item.situacao)}</span></td>
      <td>${escaparHtml(item.problemas || "Sem ocorrencia")}</td><td>${escaparHtml(item.observacoes || "--")}</td></tr>`));
=======
      <td><span class="badge-status ${normalizarStatus(item.situacao)}">${escaparHtml(FrutLog.textoInterface(item.situacao))}</span></td>
      <td>${escaparHtml(item.problemas || "Sem ocorrência")}</td><td>${escaparHtml(item.observacoes || "--")}</td></tr>`));
>>>>>>> master
  preencherTabela("tabela-plantios-admin", 5, plantios.map((item) => `
    <tr><td>${escaparHtml(item.talhao || item.talhao_id || "--")}</td>
      <td>${escaparHtml([item.produto || item.cultura, item.variedade].filter(Boolean).join(" / ") || "--")}</td>
      <td>${escaparHtml(item.area ?? item.area_plantada_hectares ?? "--")}</td>
      <td>${formatarData(item.dataPlantio || item.plantado_em)}</td>
      <td>${formatarData(item.dataColheita || item.previsao_colheita)}</td></tr>`));
  preencherTabela("tabela-ocorrencias-admin", 4, ocorrencias.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.talhao)}</td>
      <td>${escaparHtml(item.tipo)}</td><td>${escaparHtml(item.observacao || "--")}</td></tr>`));
  preencherTabela("tabela-problemas-admin", 5, problemas.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.sensor || "--")}</td>
      <td>${escaparHtml(item.talhao || "--")}</td><td>${escaparHtml(item.problema)}</td>
      <td>${escaparHtml(item.observacao || "--")}</td></tr>`));

  const linhasAlertas = [
<<<<<<< HEAD
    ...tarefas.map((item) => `<tr><td>${escaparHtml(item.talhao || "--")}</td><td>${escaparHtml(item.prioridade || "Tarefa")}</td><td>${escaparHtml(item.atividade || "--")}</td><td>Pendente</td></tr>`),
    ...alertas.map((item) => `<tr><td>${escaparHtml(item.titulo || item.talhao || "--")}</td><td>${escaparHtml(item.severidade || item.nivel || "--")}</td><td>${escaparHtml(item.mensagem || item.texto || item.titulo || "--")}</td><td>${escaparHtml(item.status || "Aberto")}</td></tr>`),
=======
    ...tarefas.map((item) => `<tr><td>${escaparHtml(item.talhao || "--")}</td><td>${escaparHtml(FrutLog.textoInterface(item.prioridade || "Tarefa"))}</td><td>${escaparHtml(item.atividade || "--")}</td><td>Pendente</td></tr>`),
    ...alertas.map((item) => `<tr><td>${escaparHtml(item.titulo || item.talhao || "--")}</td><td>${escaparHtml(FrutLog.textoInterface(item.severidade || item.nivel || "--"))}</td><td>${escaparHtml(item.mensagem || item.texto || item.titulo || "--")}</td><td>${escaparHtml(FrutLog.textoInterface(item.status || "Aberto"))}</td></tr>`),
>>>>>>> master
  ];
  preencherTabela("tabela-alertas-admin", 4, linhasAlertas);
  preencherSelectTalhoes();
}

function renderizarMapaAdmin() {
<<<<<<< HEAD
=======
  if (window.FrutLogEditorAdmin?.ativo()) return;
>>>>>>> master
  const mapa = document.getElementById("mapa-talhoes-admin");
  if (!mapa || typeof FrutLogTalhoes === "undefined") return;
  const features = FrutLogTalhoes.obterTalhoes();
  const estados = new Map((painelTecnico.talhoes || []).map((item) => [item.id, item.situacao || item.status]));
  exibirMensagem(
    "mensagem-mapa-admin",
    features.length
<<<<<<< HEAD
      ? `${features.length} talhao(es) carregado(s) do servidor.`
      : "Nenhum talhao retornado pelo servidor. Verifique os cadastros e a fazenda vinculada."
=======
      ? `${features.length} talhão(es) carregado(s) do servidor.`
      : "Nenhum talhão retornado pelo servidor. Verifique os cadastros e a fazenda vinculada."
>>>>>>> master
  );
  const renderizados = FrutLogMapaTalhoes.renderizarMapaTalhoes(mapa, features, {
    statusFor: (feature) => estados.get(feature.properties.codigo) || feature.properties.status,
    onSelect: (feature, evento, poligono) => {
      const codigo = feature.properties.codigo;
      mapa.querySelectorAll(".talhao-mapa").forEach((item) => item.classList.toggle("selecionado", item === poligono));
      const dados = (painelTecnico.talhoes || []).find((item) => item.id === codigo);
      exibirMensagem("mensagem-dados-tecnicos", dados
<<<<<<< HEAD
        ? `Talhao ${codigo}: ${dados.situacao || "sem situacao"}; leitura ${dados.leitura || "indisponivel"}.`
        : `Talhao ${codigo} selecionado.`);
=======
        ? `Talhão ${codigo}: ${dados.situacao || "sem situacao"}; leitura ${dados.leitura || "indisponivel"}.`
        : `Talhão ${codigo} selecionado.`);
>>>>>>> master
    },
  });
  exibirMensagem(
    "mensagem-mapa-admin",
    renderizados
<<<<<<< HEAD
      ? `${renderizados} divisao(oes) de talhao renderizada(s) com dados do servidor.`
      : "Os talhoes foram carregados, mas nenhum possui coordenadas validas para desenhar."
=======
      ? `${renderizados} divisão(oes) de talhão renderizada(s) com dados do servidor.`
      : "Os talhões foram carregados, mas nenhum possui coordenadas validas para desenhar."
>>>>>>> master
  );
}

function classeStatusMapa(valor) {
  const normalizado = normalizarStatus(valor).replace(/\s+/g, "-");
  return ["normal", "atencao", "critico", "sem-leitura", "sem-sensor", "sem-comunicacao", "sensor-inativo", "manutencao"].includes(normalizado)
    ? normalizado
    : "sem-leitura";
}

function renderizarTelemetriaDiariaAdmin() {
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
    chuva: "Chuva",
  };
  preencherTabela("tabela-telemetria-admin", 7, telemetriaDiariaAdmin.map((item) => `
    <tr>
      <td>${formatarData(item.dia)}</td>
      <td>${escaparHtml(item.talhao || "--")}</td>
      <td>${escaparHtml(metricas[item.codigo_metrica] || item.codigo_metrica)}</td>
      <td>${escaparHtml(item.valor_medio)}</td>
      <td>${escaparHtml(item.valor_minimo)}</td>
      <td>${escaparHtml(item.valor_maximo)}</td>
      <td>${escaparHtml(item.leituras_contabilizadas)}</td>
    </tr>
  `));
}

function configurarGraficos() {
  document.querySelectorAll("[data-unidade-admin]").forEach((botao) => {
    botao.addEventListener("click", () => {
      unidadeColheita = botao.dataset.unidadeAdmin;
      document.querySelectorAll("[data-unidade-admin]").forEach((item) => item.classList.toggle("active", item === botao));
      renderizarGraficoColheita();
    });
  });
  renderizarGraficoClima();
}

function definirColheitasAnuais(colheitas) {
  colheitasAnuais = Array.isArray(colheitas) ? colheitas : [];
  if (colheitasAnuais.length && !colheitasAnuais.some((item) => item.unidade === unidadeColheita)) {
    unidadeColheita = colheitasAnuais[0].unidade;
    document.querySelectorAll("[data-unidade-admin]").forEach((botao) => {
      botao.classList.toggle("active", botao.dataset.unidadeAdmin === unidadeColheita);
    });
  }
}

function renderizarGraficoColheita() {
  const canvas = document.getElementById("grafico-colheita-anual");
  if (!canvas || typeof Chart === "undefined") return;
  if (graficoColheita) graficoColheita.destroy();
  const dados = colheitasAnuais.filter((item) => item.unidade === unidadeColheita);
  const unidadeLabel = { t: "Toneladas", sc: "Sacas", kg: "Quilogramas", cx: "Caixas" };
  const unidade = unidadeLabel[unidadeColheita] || unidadeColheita;
  const mensagem = document.getElementById("mensagem-colheita-admin");
  if (!dados.length) {
    graficoColheita = null;
<<<<<<< HEAD
    if (mensagem) mensagem.textContent = "Ainda nao ha registros de colheita para esta unidade.";
=======
    if (mensagem) mensagem.textContent = "Ainda não há registros de colheita para esta unidade.";
>>>>>>> master
    ["resumo-colheita-ultima", "resumo-colheita-menor", "resumo-colheita-maior"].forEach((id) => {
      document.getElementById(id).textContent = "--";
    });
    return;
  }
  if (mensagem) mensagem.textContent = "";

  graficoColheita = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map((item) => item.ano),
      datasets: [{
        label: unidade[0].toUpperCase() + unidade.slice(1),
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

  const menor = dados.reduce((a, b) => a.quantidade < b.quantidade ? a : b);
  const maior = dados.reduce((a, b) => a.quantidade > b.quantidade ? a : b);
  const ultima = dados.reduce((a, b) => a.ano > b.ano ? a : b);
  document.getElementById("resumo-colheita-ultima").textContent = `${ultima.ano}: ${ultima.quantidade} ${unidade}`;
  document.getElementById("resumo-colheita-menor").textContent = `${menor.ano}: ${menor.quantidade} ${unidade}`;
  document.getElementById("resumo-colheita-maior").textContent = `${maior.ano}: ${maior.quantidade} ${unidade}`;
}

function renderizarGraficoLeituras() {
  const canvas = document.getElementById("grafico-leituras-sensores");
  if (!canvas || typeof Chart === "undefined") return;
  const dados = sensores.filter((item) => item.ativo !== false && item.valor !== null && item.valor !== undefined && item.valor !== "" && Number.isFinite(Number(item.valor)));
  if (graficoLeituras) graficoLeituras.destroy();
  graficoLeituras = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map((item) => item.sensor || item.id_externo),
      datasets: [{
<<<<<<< HEAD
        label: "Ultima leitura",
=======
        label: "Última leitura",
>>>>>>> master
        data: dados.map((item) => Number(item.valor)),
        backgroundColor: "#1976d2",
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
}

function renderizarGraficoClima() {
  const canvas = document.getElementById("grafico-clima-mensal");

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  if (graficoClima) {
    graficoClima.destroy();
  }

  const nomesMeses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const dadosMensais = [...telemetriaMensalAdmin, ...telemetriaMensalEsp32];

  // "2026-10" -> "Out/2026"
  const rotuloMes = (mes) => {
    const [ano, numero] = String(mes).split("-");
    return `${nomesMeses[Number(numero) - 1] || numero}/${ano}`;
  };

  // Consolidado mensal vindo da API (os valores diarios do ESP32 ja foram agrupados por mes).
  const meses = [...new Set(
    dadosMensais.map((item) => item.mes).filter(Boolean)
  )].sort();

  // Media do mes para a metrica (media entre as fontes/talhoes que mediram naquele mes).
  const mediaDoMes = (mes, codigo) => {
      const valores = dadosMensais
      .filter((item) =>
        item.mes === mes &&
        item.codigo_metrica === codigo &&
        Number.isFinite(Number(item.valor_medio)))
      .map((item) => Number(item.valor_medio));

    return valores.length
      ? Number((valores.reduce((soma, valor) => soma + valor, 0) / valores.length).toFixed(2))
      : null;
  };

  const serie = (codigo) => meses.map((mes) => mediaDoMes(mes, codigo));

  graficoClima = new Chart(canvas, {
    type: "line",
    data: {
      labels: meses.map(rotuloMes),

      datasets: [
        {
          label: "Temperatura (°C)",
          data: serie("temperatura"),
          borderColor: "#c62828",
          backgroundColor: "rgba(198, 40, 40, 0.12)",
          tension: 0.35,
          spanGaps: true,
        },
        {
          label: "Chuva (mm)",
          data: serie("chuva"),
          borderColor: "#f9a825",
          backgroundColor: "rgba(249, 168, 37, 0.12)",
          tension: 0.35,
          spanGaps: true,
        },
        {
          label: "Umidade do ar (%)",
          data: serie("umidadeAr"),
          borderColor: "#1565c0",
          backgroundColor: "rgba(21, 101, 192, 0.12)",
          tension: 0.35,
          spanGaps: true,
        },
        {
          label: "Umidade do solo (%)",
          data: serie("umidadeSolo"),
          borderColor: "#388e3c",
          backgroundColor: "rgba(56, 142, 60, 0.12)",
          tension: 0.35,
          spanGaps: true,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

async function carregarDadosConectados() {
  const resultados = await Promise.allSettled([
    FrutLog.apiFetch("/funcionarios"),
    FrutLog.apiFetch("/sensores"),
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLog.apiFetch("/colheitas/anual"),
    FrutLog.apiFetch("/telemetria/diaria"),
  ]);
  const erros = [];

  if (resultados[0].status === "fulfilled") {
    funcionarios = resultados[0].value.usuarios || [];
    renderizarFuncionarios();
  } else {
<<<<<<< HEAD
    erros.push(`Funcionarios: ${resultados[0].reason.message}`);
    mostrarLinhasVazias("tabela-funcionarios", 7, "Falha ao carregar funcionarios.");
=======
    erros.push(`Funcionários: ${resultados[0].reason.message}`);
    mostrarLinhasVazias("tabela-funcionarios", 7, "Falha ao carregar funcionários.");
>>>>>>> master
  }

  if (resultados[1].status === "fulfilled") {
    sensores = resultados[1].value.sensores || [];
    renderizarSensores();
    renderizarGraficoClima();
  } else {
    erros.push(`Sensores: ${resultados[1].reason.message}`);
    mostrarLinhasVazias("tabela-sensores-admin", 6, "Falha ao carregar sensores.");
  }

  if (resultados[2].status === "fulfilled") {
    painelTecnico = resultados[2].value;
    renderizarPainelTecnico();
  } else {
    erros.push(`Dados de campo: ${resultados[2].reason.message}`);
    exibirMensagem("mensagem-dados-tecnicos", resultados[2].reason.message, "erro");
  }

  if (resultados[3].status === "fulfilled") {
    definirColheitasAnuais(resultados[3].value.colheitas);
  } else {
    erros.push(`Colheitas: ${resultados[3].reason.message}`);
  }
  if (resultados[4].status === "fulfilled") {
    telemetriaDiariaAdmin = resultados[4].value.leituras || [];
    telemetriaMensalAdmin = resultados[4].value.mensal || [];
    renderizarTelemetriaDiariaAdmin();
    renderizarGraficoClima();
  } else {
<<<<<<< HEAD
    erros.push(`Telemetria diaria: ${resultados[4].reason.message}`);
    mostrarLinhasVazias("tabela-telemetria-admin", 7, "Falha ao carregar telemetria diaria.");
=======
    erros.push(`Telemetria diária: ${resultados[4].reason.message}`);
    mostrarLinhasVazias("tabela-telemetria-admin", 7, "Falha ao carregar telemetria diária.");
>>>>>>> master
  }

  renderizarGraficoColheita();
  renderizarGraficoClima();
  if (erros.length) {
    exibirMensagem("mensagem-carregamento-admin", erros.join(" | "), "erro");
  } else {
    exibirMensagem("mensagem-carregamento-admin", "Dados atualizados do servidor.", "sucesso");
  }

  if (!window.sincronizacaoAdminIniciada) {
    carregarEsp32Mensal();
    window.sincronizacaoAdminIniciada = true;
    window.setInterval(atualizarDadosCampoConectados, 15000);
  }
}

async function carregarEsp32Mensal() {
  try {
    const resposta = await FrutLog.apiFetch("/telemetria/esp32-mensal");
    telemetriaMensalEsp32 = resposta.mensal || [];
    renderizarGraficoClima();
  } catch (erro) {
    console.error("ESP32 mensal:", erro.message);
  }
}

async function carregarMapaAdmin() {
<<<<<<< HEAD
=======
  if (window.FrutLogEditorAdmin?.ativo()) return;
>>>>>>> master
  await FrutLogMapaTalhoes.carregarMapaTalhoes("admin");
  preencherSelectTalhoes();
  renderizarMapaAdmin();
}

window.addEventListener("focus", atualizarDadosCampoConectados);

async function atualizarDadosCampoConectados() {
  const resultados = await Promise.allSettled([
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLog.apiFetch("/sensores"),
    FrutLog.apiFetch("/colheitas/anual"),
    FrutLog.apiFetch("/telemetria/diaria"),
    carregarMapaAdmin(),
  ]);
  const erros = [];

  if (resultados[0].status === "fulfilled") {
    painelTecnico = resultados[0].value;
    renderizarPainelTecnico();
    renderizarMapaAdmin();
  } else {
    erros.push(`Dados de campo: ${resultados[0].reason.message}`);
  }

  if (resultados[1].status === "fulfilled") {
    sensores = resultados[1].value.sensores || [];
    renderizarSensores();
    renderizarGraficoClima();
  } else {
    erros.push(`Sensores: ${resultados[1].reason.message}`);
  }

  if (resultados[2].status === "fulfilled") {
    definirColheitasAnuais(resultados[2].value.colheitas);
    renderizarGraficoColheita();
  } else {
    erros.push(`Colheitas: ${resultados[2].reason.message}`);
  }

  if (resultados[3].status === "fulfilled") {
    telemetriaDiariaAdmin = resultados[3].value.leituras || [];
    telemetriaMensalAdmin = resultados[3].value.mensal || [];
    renderizarTelemetriaDiariaAdmin();
    renderizarGraficoClima();
  } else {
<<<<<<< HEAD
    erros.push(`Telemetria diaria: ${resultados[3].reason.message}`);
=======
    erros.push(`Telemetria diária: ${resultados[3].reason.message}`);
>>>>>>> master
  }

  if (resultados[4].status === "rejected") {
    erros.push(`Geometrias: ${resultados[4].reason.message}`);
  }

  if (erros.length) {
    console.error("Falha ao sincronizar dados operacionais:", erros.join(" | "));
    exibirMensagem("mensagem-carregamento-admin", erros.join(" | "), "erro");
  } else {
    exibirMensagem("mensagem-carregamento-admin", "Dados atualizados do servidor.", "sucesso");
  }
}
