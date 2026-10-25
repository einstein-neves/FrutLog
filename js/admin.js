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
  configurarEncerramentoCicloAdmin();
  configurarAcoesHistorico();
  carregarHistoricoQuandoVisivel();
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
let historicoOperacao = [];
let historicoOperacaoCarregado = false;
let filtroHistoricoOperacao = "ativos";
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
let graficoClimaMensalAdmin = null;
let unidadeColheita = "t";
let telemetriaDiariaAdmin = [];
let telemetriaMensalAdmin = [];
let telemetriaMensalEsp32Admin = [];
let talhaoSelecionadoAdmin = "";
let encerrandoCicloAdmin = false;

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
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#\$%";
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
      exibirMensagem("mensagem-funcionario", "Senha provisoria copiada.", "sucesso");
    } catch (erro) {
      exibirMensagem("mensagem-funcionario", `Nao foi possivel copiar a senha: ${erro.message}`, "erro");
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
    botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
    exibirMensagem("mensagem-funcionario", "");
  });

  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const mensagemId = "mensagem-funcionario";

    const editando = Boolean(dados.id);
    const senhaProvisoriaUsada = dados.senha;
    if ((!editando || dados.senha) && (typeof dados.senha !== "string" || dados.senha.length < 8 || dados.senha.length > 10)) {
      exibirMensagem(mensagemId, "A senha provisoria deve possuir entre 8 e 10 caracteres.", "erro");
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
        senha: dados.senha,
      };
      if (editando) {
        await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(dados.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        funcionarios = funcionarios.map((item) => String(item.id) === String(dados.id)
          ? { ...item, ...payload, status: payload.status || item.status, ativo: (payload.status || item.status) === "ativo" }
          : item);
        exibirMensagem(mensagemId, "Funcionario atualizado.", "sucesso");
      } else {
        const resposta = await FrutLog.apiFetch("/funcionarios", {
          method: "POST",
          body: JSON.stringify({ ...payload, status: dados.status || "ativo" }),
        });
        const novoFuncionario = {
          id: resposta.id,
          matricula: resposta.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          profissao: dados.profissao,
          perfil: dados.perfil,
          status: dados.status || "ativo",
          ativo: (dados.status || "ativo") === "ativo",
        };
        funcionarios.push(novoFuncionario);
        exibirMensagem(mensagemId, `Funcionario cadastrado. Matricula: ${novoFuncionario.matricula}. A senha devera ser alterada no primeiro acesso.`, "sucesso");
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
      botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
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
    const ativo = funcionario.status ? funcionario.status === "ativo" : funcionario.ativo === true;
    const status = ativo ? "ativo" : (funcionario.status || "inativo");
    const textoStatus = status === "excluido" ? "Excluido" : ativo ? "Ativo" : "Inativo";
    return `
      <tr>
        <td>${escaparHtml(funcionario.matricula)}</td>
        <td>${escaparHtml(funcionario.nome)}</td>
        <td>${escaparHtml(funcionario.cargo)}</td>
        <td>${escaparHtml(funcionario.profissao || "--")}</td>
        <td>${escaparHtml(funcionario.perfil)}</td>
        <td><span class="badge-status ${status}">${textoStatus}</span></td>
        <td>
          <button class="btn-acao-admin" type="button" data-alternar-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""}>${ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn-acao-admin" type="button" data-editar-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""}>Editar</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""}>Excluir</button>
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

      const status = (funcionario.status ? funcionario.status === "ativo" : funcionario.ativo === true) ? "inativo" : "ativo";
      botaoStatus.disabled = true;
      try {
        await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        funcionarios = funcionarios.map((item) => String(item.id) === String(id) ? { ...item, status, ativo: status === "ativo" } : item);
        renderizarFuncionarios();
        exibirMensagem("mensagem-funcionario", `Funcionario ${status === "ativo" ? "ativado" : "desativado"}.`, "sucesso");
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
      document.getElementById("funcionario-senha").value = "";
      document.getElementById("funcionario-senha").required = false;
      document.getElementById("funcionario-senha").type = "text";
      document.getElementById("btn-mostrar-senha").textContent = "Ocultar senha";
      document.getElementById("funcionario-senha").placeholder = "Deixe vazio para manter a senha atual";
      document.getElementById("btn-cancelar-edicao-funcionario").hidden = false;
      document.getElementById("btn-salvar-funcionario").innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar Alteracoes';
      document.getElementById("form-funcionario").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const botao = evento.target.closest("[data-excluir-funcionario]");
    if (!botao) return;
    const id = botao.dataset.excluirFuncionario;
    const funcionario = funcionarios.find((item) => String(item.id) === String(id));
    if (!funcionario || !window.confirm(`Excluir ${funcionario.nome} do sistema?`)) return;

    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      funcionarios = funcionarios.filter((item) => String(item.id) !== String(id));
      renderizarFuncionarios();
      exibirMensagem("mensagem-funcionario", "Funcionario excluido.", "sucesso");
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-funcionario", erro.message, "erro");
    }
  });

  // A tabela de sensores é redesenhada após cada ação, então use delegação.
  document.getElementById("tabela-sensores-admin")?.addEventListener("click", async (evento) => {
    const excluir = evento.target.closest("[data-excluir-sensor]");
    const alternar = evento.target.closest("[data-alternar-sensor]");
    const botao = excluir || alternar;
    if (!botao) return;
    const id = botao.dataset.excluirSensor || botao.dataset.alternarSensor;
    const sensor = sensores.find((item) => String(item.id) === String(id));
    if (!sensor) return;
    if (excluir && !window.confirm(`Excluir o sensor ${sensor.sensor || sensor.id_externo}?`)) return;

    botao.disabled = true;
    try {
      if (excluir) {
        await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, { method: "DELETE" });
        sensores = sensores.filter((item) => String(item.id) !== String(id));
        exibirMensagem("mensagem-sensor", "Sensor excluído.", "sucesso");
      } else {
        const status = sensor.ativo ? "inativo" : "ativo";
        await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, {
          method: "PATCH", body: JSON.stringify({ status }),
        });
        sensores = sensores.map((item) => String(item.id) === String(id)
          ? { ...item, ativo: status === "ativo", status: status === "ativo" ? "Offline" : "Inativo" }
          : item);
        exibirMensagem("mensagem-sensor", `Sensor ${status === "ativo" ? "ativado" : "desativado"}.`, "sucesso");
      }
      renderizarSensores();
      renderizarPainelTecnico();
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
  select.innerHTML = '<option value="">Selecione o talhao</option>' + codigos
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
        <td><span class="badge-status ${statusClasse}">${escaparHtml(status)}</span></td>
        <td>
          <button class="btn-acao-admin" type="button" data-alternar-sensor="${escaparHtml(sensor.id)}">${sensor.ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-sensor="${escaparHtml(sensor.id)}">Excluir</button>
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

// O histórico é carregado quando o admin se aproxima da seção, para não pesar a abertura do painel.
function carregarHistoricoQuandoVisivel() {
  const secao = document.getElementById("resumo-tecnico");
  if (!secao) return;
  if (!("IntersectionObserver" in window)) {
    carregarHistoricoOperacao();
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((entrada) => entrada.isIntersecting)) return;
    observador.disconnect();
    carregarHistoricoOperacao();
  }, { rootMargin: "160px" });
  observador.observe(secao);
}

async function carregarHistoricoOperacao() {
  const tabela = document.getElementById("tabela-historico-admin");
  if (!tabela) return;
  tabela.innerHTML = '<tr><td colspan="9">Carregando histórico...</td></tr>';
  try {
    const resposta = await FrutLog.apiFetch("/admin/historico-operacao");
    historicoOperacao = Array.isArray(resposta.historico) ? resposta.historico : [];
    historicoOperacaoCarregado = true;
    renderizarHistoricoAdmin();
  } catch (erro) {
    mostrarLinhasVazias("tabela-historico-admin", 9, `Falha ao carregar histórico: ${erro.message}`);
  }
}

function renderizarHistoricoAdmin() {
  const situacaoAtualPorTalhao = new Map((painelTecnico.talhoes || []).map((item) => [item.id, item]));
  const registrosFiltrados = historicoOperacao.filter((item) => {
    const estaArquivado = Boolean(item.arquivadoEm || item.talhaoArquivadoEm);
    if (filtroHistoricoOperacao === "arquivados") return estaArquivado;
    if (filtroHistoricoOperacao === "ativos") return !estaArquivado;
    return true;
  });
  preencherTabela("tabela-historico-admin", 9, registrosFiltrados.map((item) => {
    const sensoresTexto = item.sensores?.length
      ? item.sensores.map((sensor) => `${escaparHtml(sensor.identificador)} · ${escaparHtml(sensor.metrica)} (${escaparHtml(sensor.status)})`).join("<br>")
      : "Sem sensor associado";
    const colheitasTexto = item.colheitas?.length
      ? item.colheitas.map((colheita) => {
        const arquivada = Boolean(colheita.arquivado_em);
        const acao = `<button class="btn-acao-admin${arquivada ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(colheita.id)}" data-tipo-historico="colheita">${arquivada ? "Restaurar colheita" : "Arquivar colheita"}</button>`;
        return `${formatarData(colheita.colhido_em)} · ${escaparHtml(colheita.quantidade)} ${escaparHtml(colheita.unidade)} ${acao}`;
      }).join("<br>")
      : "Sem colheita registrada";
    const alertas = item.alertas || [];
    const alertasTexto = alertas.length
      ? `${alertas.length} registro(s): ${alertas.map((alerta) => `${escaparHtml(alerta.titulo)} (${escaparHtml(alerta.status)})`).join("; ")}`
      : "Sem alertas";
    const operacaoAtual = situacaoAtualPorTalhao.get(item.talhao);
    const pendenciaAtual = operacaoAtual && operacaoAtual.situacao !== "Normal"
      ? `<strong>${escaparHtml(operacaoAtual.prioridade)}</strong><br>`
      : "";
    const situacao = item.tipo === "talhao" ? "Sem ciclo cadastrado" : item.status;
    const arquivado = Boolean(item.arquivadoEm);
    const acaoArquivar = !arquivado && item.tipo === "ciclo" && item.status === "ativo"
      ? '<button class="btn-acao-admin" type="button" disabled title="Encerre o ciclo antes de arquivar">Ciclo ativo</button>'
      : `<button class="btn-acao-admin${arquivado ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(item.registroId)}" data-tipo-historico="${escaparHtml(item.tipo)}">${arquivado ? "Restaurar" : "Arquivar"}</button>`;
    const acaoTalhao = item.tipo === "talhao" ? "" : ` <button class="btn-acao-admin${item.talhaoArquivadoEm ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(item.talhaoId)}" data-tipo-historico="talhao">${item.talhaoArquivadoEm ? "Restaurar talhão" : "Arquivar talhão"}</button>`;
    const ciclo = item.tipo === "talhao"
      ? "Talhão cadastrado, sem ciclo de cultivo"
      : `Plantio: ${formatarData(item.plantadoEm)}<br>Previsão: ${formatarData(item.previsaoColheita)}${item.encerradoEm ? `<br>Encerrado: ${formatarData(item.encerradoEm)}` : ""}`;
    return `<tr>
      <td>${formatarData(item.talhaoCriadoEm)}</td>
      <td><strong>${escaparHtml(item.talhao)}</strong><br>${escaparHtml(item.produto)}${item.variedade ? ` / ${escaparHtml(item.variedade)}` : ""}</td>
      <td>Talhão: ${escaparHtml(item.areaTalhao)} ha${item.areaPlantada != null ? `<br>Plantada: ${escaparHtml(item.areaPlantada)} ha` : ""}</td>
      <td>${ciclo}</td>
      <td>${sensoresTexto}</td>
      <td>${colheitasTexto}</td>
      <td>${pendenciaAtual}${alertasTexto}</td>
      <td><span class="badge-status ${normalizarStatus(operacaoAtual?.situacao || situacao)}">${escaparHtml(operacaoAtual?.situacao || situacao)}</span>${operacaoAtual?.prioridade ? `<br><small>${escaparHtml(operacaoAtual.prioridade)}</small>` : ""}</td>
      <td>${acaoArquivar}${acaoTalhao}</td>
    </tr>`;
  }));
}

function configurarAcoesHistorico() {
  document.getElementById("filtro-historico-admin")?.addEventListener("change", (evento) => {
    filtroHistoricoOperacao = evento.currentTarget.value;
    renderizarHistoricoAdmin();
  });
  document.getElementById("tabela-historico-admin")?.addEventListener("click", async (evento) => {
    const botao = evento.target.closest("[data-alternar-arquivo]");
    if (!botao) return;
    const tipo = botao.dataset.tipoHistorico;
    const id = botao.dataset.alternarArquivo;
    const registro = tipo === "colheita"
      ? historicoOperacao.flatMap((item) => item.colheitas || []).find((item) => String(item.id) === String(id))
      : historicoOperacao.find((item) => item.tipo === tipo && String(item.registroId) === String(id));
    if (!registro) return;
    const arquivar = !registro.arquivadoEm;
    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/admin/historico-operacao/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ arquivado: arquivar }),
      });
      exibirMensagem("mensagem-dados-tecnicos", arquivar ? "Registro arquivado e preservado." : "Registro restaurado.", "sucesso");
      await carregarHistoricoOperacao();
      if (tipo === "talhao") {
        FrutLog.notificarAtualizacaoTalhoes();
        window.dispatchEvent(new Event("frutlog:talhoes-atualizados"));
      }
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
    }
  });
}

function renderizarPainelTecnico() {
  const talhoes = painelTecnico.talhoes || [];
  document.getElementById("resumo-total-talhoes").textContent = talhoes.length;
  document.getElementById("resumo-total-sensores").textContent = sensores.length;
  document.getElementById("resumo-total-inspecoes").textContent = (painelTecnico.inspecoes || []).length;
  document.getElementById("resumo-total-tarefas").textContent = (painelTecnico.tarefas || []).length;
  document.getElementById("resumo-total-alertas").textContent = (painelTecnico.alertas || []).length;

  if (historicoOperacaoCarregado) renderizarHistoricoAdmin();
  preencherSelectTalhoes();
}

function renderizarMapaAdmin() {
  const mapa = document.getElementById("camada-talhoes");
  if (!mapa || typeof FrutLogTalhoes === "undefined") return;
  const features = FrutLogTalhoes.obterTalhoes();
  const estados = new Map((painelTecnico.talhoes || []).map((item) => [item.id, item.situacao || item.status]));
  if (!features.some((feature) => feature.properties.codigo === talhaoSelecionadoAdmin)) {
    talhaoSelecionadoAdmin = features[0]?.properties.codigo || "";
  }
  renderizarBotoesTalhaoAdmin(features);
  FrutLogMapaTalhoes.renderizarMapaTalhoes(mapa, features, {
    selectedCode: talhaoSelecionadoAdmin,
    statusFor: (feature) => statusTemperaturaTalhaoAdmin(feature, estados.get(feature.properties.codigo)),
    onSelect: (feature) => selecionarTalhaoAdmin(feature.properties.codigo),
  });
  if (talhaoSelecionadoAdmin) renderizarDetalhesTalhaoAdmin(talhaoSelecionadoAdmin);
}

function renderizarBotoesTalhaoAdmin(features) {
  const container = document.getElementById("botoes-talhao");
  if (!container) return;
  container.innerHTML = features.map((feature) => {
    const codigo = feature.properties.codigo;
    const ativo = codigo === talhaoSelecionadoAdmin ? " active" : "";
    return `<button class="btn-talhao${ativo}" type="button" data-talhao-admin="${escaparHtml(codigo)}">${escaparHtml(codigo)}</button>`;
  }).join("");
  container.querySelectorAll("[data-talhao-admin]").forEach((botao) => {
    botao.addEventListener("click", () => selecionarTalhaoAdmin(botao.dataset.talhaoAdmin));
  });
}

function selecionarTalhaoAdmin(codigo) {
  talhaoSelecionadoAdmin = codigo;
  const features = FrutLogTalhoes.obterTalhoes();
  renderizarBotoesTalhaoAdmin(features);
  const mapa = document.getElementById("camada-talhoes");
  mapa?.querySelectorAll(".talhao-mapa").forEach((poligono) => {
    poligono.classList.toggle("selecionado", poligono.dataset.talhao === codigo);
  });
  renderizarDetalhesTalhaoAdmin(codigo);
}

function renderizarDetalhesTalhaoAdmin(codigo) {
  const feature = FrutLogTalhoes.obterTalhoes().find((item) => item.properties.codigo === codigo);
  if (!feature) return;
  const dadosTalhao = (painelTecnico.talhoes || []).find((item) => item.id === codigo) || {};
  const plantio = (painelTecnico.plantios || []).find((item) => item.talhao === codigo) || {};
  const botaoEncerrarCiclo = document.getElementById("btn-encerrar-ciclo-talhao");
  if (botaoEncerrarCiclo) botaoEncerrarCiclo.disabled = encerrandoCicloAdmin || !plantio.id;
  const sensores = (painelTecnico.sensores || []).filter((item) => item.talhao === codigo);
  const sensorAtivo = (tipo) => sensores.find((item) => item.tipo === tipo && item.status !== "Inativo");
  const temperatura = sensorAtivo("temperatura");
  const umidadeAr = sensorAtivo("umidadeAr");
  const umidadeSolo = sensorAtivo("umidadeSolo");
  const props = feature.properties;
  const monitorado = FrutLogTalhoes.aplicarMonitoramento({
    ...feature,
    properties: {
      ...props,
      status: dadosTalhao.situacao || dadosTalhao.status || props.status,
      prioridade: dadosTalhao.prioridade || props.prioridade,
      diaria: { ...props.diaria, temperatura: temperatura?.valor ?? null },
    },
  }).properties;
  const preencher = (id, valor) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor ?? "--";
  };

  preencher("tecnico-titulo-talhao", `Detalhes: Talhão ${codigo}`);
  preencher("tecnico-talhao-produto", plantio.produto || props.produto || "--");
  preencher("tecnico-talhao-variedade", plantio.variedade || props.variedade || "--");
  preencher("tecnico-talhao-area", props.area_hectares ? `${props.area_hectares} hectares` : props.area || "--");
  preencher("tecnico-talhao-solo", plantio.solo || props.solo || "--");
  preencher("tecnico-talhao-plantio", plantio.plantado_em || props.plantio || "--");
  preencher("tecnico-talhao-colheita", plantio.previsao_colheita || props.colheita || "--");
  preencher("tecnico-talhao-sensor", dadosTalhao.sensor || sensores[0]?.sensor || "Não associado");
  preencher("tecnico-talhao-limite", props.parametros?.temperaturaMaxima != null ? `${props.parametros.temperaturaMaxima} °C` : "--");
  preencher("tecnico-talhao-temperatura", temperatura?.valor != null ? `${temperatura.valor} °C` : "--");
  preencher("tecnico-talhao-umidade", umidadeAr?.valor != null || umidadeSolo?.valor != null
    ? `${umidadeAr?.valor ?? "--"}% ar / ${umidadeSolo?.valor ?? "--"}% solo`
    : "--");
  preencher("tecnico-talhao-prioridade", monitorado.prioridade || "Rotina de acompanhamento");
  preencher("tecnico-talhao-status", FrutLog.textoInterface(monitorado.status || "Sem leitura"));
  const badge = document.getElementById("tecnico-talhao-status");
  if (badge) badge.className = `badge-status ${normalizarStatus(monitorado.status || "sem-leitura")}`;
}

function configurarEncerramentoCicloAdmin() {
  const botao = document.getElementById("btn-encerrar-ciclo-talhao");
  if (!botao) return;
  botao.addEventListener("click", async () => {
    const codigo = talhaoSelecionadoAdmin;
    const ciclo = (painelTecnico.plantios || []).find((item) => item.talhao === codigo);
    if (!codigo || !ciclo?.id || encerrandoCicloAdmin) return;
    if (!window.confirm(`Encerrar o ciclo atual do talhão ${codigo}? O registro ficará no histórico.`)) return;

    encerrandoCicloAdmin = true;
    botao.disabled = true;
    const mensagem = document.getElementById("mensagem-encerramento-ciclo");
    try {
      // A API registra o encerramento no banco; atualizar os painéis remove o ciclo da visão atual.
      await FrutLog.apiFetch("/plantios/encerrar-ciclo", {
        method: "POST",
        body: JSON.stringify({ talhao: codigo, cicloId: ciclo.id }),
      });
      await carregarDadosConectados();
      if (historicoOperacaoCarregado) await carregarHistoricoOperacao();
      renderizarMapaAdmin();
      if (mensagem) {
        mensagem.textContent = `Ciclo do talhão ${codigo} encerrado e mantido no histórico. Já é possível cadastrar outro produto.`;
        mensagem.className = "mensagem-feedback sucesso";
      }
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      if (mensagem) {
        mensagem.textContent = erro.message;
        mensagem.className = "mensagem-feedback erro";
      }
    } finally {
      encerrandoCicloAdmin = false;
      renderizarDetalhesTalhaoAdmin(codigo);
    }
  });
}

function statusTemperaturaTalhaoAdmin(feature, fallbackStatus) {
  const sensores = (painelTecnico.sensores || []).filter((item) => item.talhao === feature.properties.codigo);
  const temperatura = sensores.find((item) => item.tipo === "temperatura" && item.status !== "Inativo");
  return FrutLogTalhoes.aplicarMonitoramento({
    ...feature,
    properties: {
      ...feature.properties,
      status: fallbackStatus || feature.properties.status,
      diaria: { ...feature.properties.diaria, temperatura: temperatura?.valor ?? null },
    },
  }).properties.status;
}

function configurarGraficos() {
  document.querySelectorAll("[data-unidade-admin]").forEach((botao) => {
    botao.addEventListener("click", () => {
      unidadeColheita = botao.dataset.unidadeAdmin;
      document.querySelectorAll("[data-unidade-admin]").forEach((item) => item.classList.toggle("active", item === botao));
      renderizarGraficoColheita();
    });
  });
}

function definirColheitasAnuais(colheitas) {
  colheitasAnuais = Array.isArray(colheitas) ? colheitas : [];
}

function renderizarGraficoColheita() {
  const canvas = document.getElementById("grafico-colheita-anual");
  if (!canvas || typeof Chart === "undefined") return;
  if (graficoColheita) graficoColheita.destroy();
  const dados = colheitasAnuais.filter((item) => item.unidade === unidadeColheita);
  if (!dados.length) return;

  graficoColheita = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map((item) => item.ano),
      datasets: [{ data: dados.map((item) => item.quantidade), backgroundColor: "#2e7d32", borderRadius: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}

function renderizarGraficoClimaMensalAdmin() {
  const canvas = document.getElementById("grafico-clima-mensal");
  if (!canvas || typeof Chart === "undefined") return;
  if (graficoClimaMensalAdmin) graficoClimaMensalAdmin.destroy();

  const leituras = [...telemetriaMensalAdmin, ...telemetriaMensalEsp32Admin];
  const meses = [...new Set(leituras.map((item) => item.mes).filter(Boolean))].sort();
  const metricas = [
    { codigo: "temperatura", label: "Temperatura (°C)" },
    { codigo: "chuva", label: "Chuva (mm)" },
    { codigo: "umidadeAr", label: "Umidade do ar (%)" },
    { codigo: "umidadeSolo", label: "Umidade do solo (%)" },
  ];
  const valores = Object.fromEntries(metricas.map(({ codigo }) => [codigo, new Map()]));
  leituras.forEach((item) => {
    const valor = Number(item.valor_medio);
    if (valores[item.codigo_metrica] && Number.isFinite(valor)) {
      const porMes = valores[item.codigo_metrica];
      const atual = porMes.get(item.mes) || { soma: 0, quantidade: 0 };
      atual.soma += valor;
      atual.quantidade += 1;
      porMes.set(item.mes, atual);
    }
  });

  graficoClimaMensalAdmin = new Chart(canvas, {
    type: "line",
    data: {
      labels: meses,
      datasets: metricas.map(({ codigo, label }) => ({
        label,
        data: meses.map((mes) => {
          const item = valores[codigo].get(mes);
          return item ? item.soma / item.quantidade : null;
        }),
        tension: 0.3,
        borderWidth: 2,
      })),
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
  });
}

async function carregarDadosConectados() {
  const resultados = await Promise.allSettled([
    FrutLog.apiFetch("/funcionarios"),
    FrutLog.apiFetch("/sensores"),
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLog.apiFetch("/colheitas/anual"),
    FrutLog.apiFetch("/telemetria/diaria"),
    FrutLog.apiFetch("/telemetria/esp32-mensal"),
  ]);
  if (resultados[0].status === "fulfilled") { funcionarios = resultados[0].value.usuarios || []; renderizarFuncionarios(); }
  if (resultados[1].status === "fulfilled") { sensores = resultados[1].value.sensores || []; renderizarSensores(); }
  if (resultados[2].status === "fulfilled") { painelTecnico = resultados[2].value; renderizarPainelTecnico(); }
  if (resultados[3].status === "fulfilled") { definirColheitasAnuais(resultados[3].value.colheitas); renderizarGraficoColheita(); }
  if (resultados[4].status === "fulfilled") telemetriaMensalAdmin = resultados[4].value.mensal || [];
  if (resultados[5].status === "fulfilled") telemetriaMensalEsp32Admin = resultados[5].value.mensal || [];
  renderizarGraficoClimaMensalAdmin();
}

async function carregarMapaAdmin() {
  await FrutLogMapaTalhoes.carregarMapaTalhoes("admin");
  preencherSelectTalhoes();
  renderizarMapaAdmin();
}

async function atualizarDadosCampoConectados() {
  const atualizacoes = [
    FrutLog.apiFetch("/painel-tecnico"),
    carregarMapaAdmin(),
  ];
  if (historicoOperacaoCarregado) atualizacoes.push(carregarHistoricoOperacao());
  const [painel] = await Promise.allSettled(atualizacoes);
  if (painel.status === "fulfilled") {
    painelTecnico = painel.value;
    renderizarPainelTecnico();
    renderizarMapaAdmin();
  }
}
