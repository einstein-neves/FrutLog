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
  configurarCadastroProduto();
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

  // Busca leitura nova sozinha, para "Temperatura Atual" merecer o nome.
  // O catch vazio e intencional: erro de rede numa atualizacao de fundo nao
  // deve quebrar o relogio nem poluir a tela -- a proxima rodada tenta de novo.
  setInterval(() => {
    atualizarLeiturasAoVivo().catch(() => {});
  }, INTERVALO_LEITURAS_MS);
  const inicializacoes = await Promise.allSettled([
    carregarDadosConectados(),
    carregarMapaAdmin(),
  ]);
  const errosInicializacao = inicializacoes
    .filter((resultado) => resultado.status === "rejected")
    .map((resultado) => resultado.reason?.message || String(resultado.reason));
  renderizarMapaAdmin();

  // Painel de telemetria por talhao (js/frutlog-telemetria.js), o mesmo que o
  // Engenheiro e o Tecnico usam. Entra DEPOIS de carregarMapaAdmin(), porque
  // os botoes sao os talhoes que o mapa trouxe -- antes disso a lista estaria
  // vazia e o painel nasceria sem botao nenhum.
  if (typeof FrutLogTelemetria !== "undefined") {
    FrutLogTelemetria.montar({ containerId: "telemetria-talhao" });
    FrutLogTelemetria.definirTalhoes(FrutLogTalhoes.obterTalhoes());
  }
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
  if (elemento) {
    elemento.textContent = texto;
    elemento.className = `mensagem-feedback ${tipo}`.trim();
  }
  // Resultado de ação também vira toast: a mensagem da seção pode estar fora da
  // área visível. Texto sem tipo é status em andamento, não merece toast.
  if (tipo === "erro" || tipo === "sucesso") FrutLogFeedback.toast(texto, tipo);
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

  /**
   * Cadastra ou atualiza um funcionário.
   * ATENÇÃO (API): POST /funcionarios cria e devolve a matrícula gerada pelo
   * banco; PUT /funcionarios/:id atualiza. A senha provisória só vai no corpo
   * quando preenchida — enviá-la vazia numa edição mantém a senha atual.
   * @param {SubmitEvent} evento - Envio do formulário #form-funcionario.
   * @returns {Promise<void>}
   */
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    // Validação pré-envio: evita bater na API com campo obrigatório vazio.
    if (!FrutLogFeedback.validarObrigatorios(formulario)) return;
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
    const liberarBotao = FrutLogFeedback.ocupar(botao, editando ? "Salvando..." : "Cadastrando...");
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
      // ATENCAO (DOM): liberar ANTES de reescrever o rótulo. liberarBotao()
      // devolve o conteúdo que o botão tinha ao entrar em carregamento, então
      // chamá-lo depois desfaria a volta ao texto de cadastro. A segunda
      // chamada, no finally, é inofensiva: liberar() só age uma vez.
      liberarBotao();
      botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
    } catch (erro) {
      exibirMensagem(mensagemId, erro.message, "erro");
    } finally {
      liberarBotao();
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

    // Trava o botão: sem isso, dois cliques disparam dois DELETE e o segundo
    // volta com 404.
    const liberarBotao = FrutLogFeedback.ocupar(botao, "Excluindo...");
    try {
      await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      funcionarios = funcionarios.filter((item) => String(item.id) !== String(id));
      renderizarFuncionarios();
      exibirMensagem("mensagem-funcionario", "Funcionario excluido.", "sucesso");
    } catch (erro) {
      liberarBotao();
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

    // Trava o botão durante a ida ao servidor, evitando requisições duplicadas.
    const liberarBotao = FrutLogFeedback.ocupar(botao, excluir ? "Excluindo..." : "Atualizando...");
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
      liberarBotao();
      exibirMensagem("mensagem-sensor", erro.message, "erro");
    }
  });
}

function configurarFormularioSensor() {
  const formulario = document.getElementById("form-sensor");
  /**
   * Cadastra um sensor e o associa a um talhão.
   * ATENÇÃO (API): POST /sensores devolve o sensor já persistido; usamos o
   * id_externo retornado porque o painel exibe esse código, não o uuid.
   * @param {SubmitEvent} evento - Envio do formulário #form-sensor.
   * @returns {Promise<void>}
   */
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    // Validação pré-envio: evita bater na API com campo obrigatório vazio.
    if (!FrutLogFeedback.validarObrigatorios(formulario)) return;
    const dados = Object.fromEntries(new FormData(formulario));
    const botao = formulario.querySelector('[type="submit"]');
    const liberarBotao = FrutLogFeedback.ocupar(botao, "Cadastrando...");

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
      liberarBotao();
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

/**
 * Lista os códigos de talhão disponíveis para os selects do painel.
 *
 * A base são os talhões desenhados no mapa (mesma fonte do editor de mapa), e
 * em seguida entram os talhões que só aparecem no painel técnico, para não
 * perder nenhum código já existente no banco.
 * @returns {Array<string>} Códigos de talhão, sem repetição.
 */
function obterCodigosTalhoesAdmin() {
  const codigos = (typeof FrutLogTalhoes === "undefined" ? [] : FrutLogTalhoes.obterTalhoes())
    .map((feature) => feature.properties.codigo);
  for (const talhao of painelTecnico.talhoes || []) {
    if (talhao.id && !codigos.includes(talhao.id)) codigos.push(talhao.id);
  }
  return codigos;
}

/**
 * Preenche os selects de talhão do painel administrativo.
 *
 * Atende o cadastro de sensores e o cadastro de produto, de modo que todo
 * talhão criado no mapa apareça nos dois assim que o mapa é recarregado
 * (carregarMapaAdmin) ou o painel técnico é renderizado.
 * @returns {void}
 */
function preencherSelectTalhoes() {
  const codigos = obterCodigosTalhoesAdmin();
  const opcoes = codigos
    .map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(codigo)}</option>`)
    .join("");

  const select = document.getElementById("sensor-talhao");
  if (select) {
    const selecionado = select.value;
    select.innerHTML = '<option value="">Selecione o talhao</option>' + opcoes;
    if (codigos.includes(selecionado)) select.value = selecionado;
  }

  // Cadastro de produto: mesmo recurso do painel do Engenheiro.
  const selectProduto = document.getElementById("talhao");
  if (selectProduto) {
    const selecionadoProduto = selectProduto.value;
    const vazio = codigos.length ? "Selecione o talhão" : "Nenhum talhão cadastrado";
    selectProduto.innerHTML = `<option value="">${vazio}</option>` + opcoes;
    if (codigos.includes(selecionadoProduto)) selectProduto.value = selecionadoProduto;
    atualizarSensoresDoTalhaoProduto();
    atualizarResumoCicloAtualAdmin();
  }
}

/**
 * Lista no cadastro de produto os sensores ativos do talhão escolhido.
 * @returns {void}
 */
function atualizarSensoresDoTalhaoProduto() {
  const select = document.getElementById("sensor-associado");
  if (!select) return;

  const codigoTalhao = document.getElementById("talhao")?.value;
  const disponiveis = (painelTecnico.sensores || sensores || [])
    .filter((sensor) => sensor.talhao === codigoTalhao && sensor.ativo);

  if (!disponiveis.length) {
    select.innerHTML = '<option value="Nenhum sensor ativo cadastrado para este talhao">Nenhum sensor ativo cadastrado para este talhão</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = disponiveis.map((sensor) => {
    const situacao = sensor.status === "Online" ? "Online" : "Cadastrado, aguardando leitura";
    return `<option>${escaparHtml(sensor.sensor)} - ${escaparHtml(sensor.tipo)} (${situacao})</option>`;
  }).join("");
  select.disabled = false;
}

/**
 * Mostra o ciclo de cultivo ativo do talhão escolhido no cadastro de produto.
 *
 * ATENÇÃO (API): POST /plantios devolve 409 quando o talhão já tem ciclo ativo,
 * então o aviso aqui evita que o usuário tente cadastrar duas vezes.
 * @returns {object|null} Ciclo ativo do talhão, ou null quando não há.
 */
function atualizarResumoCicloAtualAdmin() {
  const codigo = document.getElementById("talhao")?.value;
  const saida = document.getElementById("dados-ciclo-atual");
  const ciclo = (painelTecnico.plantios || []).find((item) => item.talhao === codigo);
  if (!saida) return ciclo || null;

  if (!codigo) {
    saida.textContent = "Selecione um talhão para consultar o ciclo ativo.";
  } else if (ciclo) {
    const produto = [ciclo.produto, ciclo.variedade].filter(Boolean).join(" / ") || "Produto sem identificação";
    saida.textContent = `${produto} · plantado em ${formatarData(ciclo.plantado_em)} · previsão de colheita ${formatarData(ciclo.previsao_colheita)}.`;
  } else {
    saida.textContent = "Não há ciclo ativo neste talhão. Você já pode cadastrar um produto.";
  }
  return ciclo || null;
}

/**
 * Liga o formulário "Cadastrar Produto" do painel administrativo.
 *
 * É o mesmo recurso do painel do Engenheiro (eng.html/eng.js), com os mesmos
 * campos e a mesma rota, para que Administração e Engenharia cadastrem ciclos
 * de cultivo exatamente da mesma forma.
 *
 * ATENÇÃO (API): POST /plantios aceita os perfis engenheiro e admin, cria
 * cultura/cultivar quando ainda não existem, grava a temperatura máxima no
 * talhão e exige que o talhão tenha área em hectares positiva.
 * @returns {void}
 */
function configurarCadastroProduto() {
  const formulario = document.getElementById("formulario-plantio");
  if (!formulario) return;

  document.getElementById("talhao")?.addEventListener("change", () => {
    atualizarSensoresDoTalhaoProduto();
    atualizarResumoCicloAtualAdmin();
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    // Validação pré-envio: evita bater na API com campo obrigatório vazio.
    if (!FrutLogFeedback.validarObrigatorios(formulario)) return;

    const dados = Object.fromEntries(new FormData(formulario));
    if (!obterCodigosTalhoesAdmin().includes(dados.talhao)) {
      FrutLogFeedback.toast("Selecione um talhão válido antes de cadastrar o produto.", "aviso");
      return;
    }

    const botao = formulario.querySelector('[type="submit"]');
    const liberarBotao = FrutLogFeedback.ocupar(botao, "Cadastrando...");
    try {
      await FrutLog.apiFetch("/plantios", {
        method: "POST",
        body: JSON.stringify(dados),
      });
      // Recarrega o painel para que mapa, detalhes e resumo mostrem o ciclo novo.
      await carregarDadosConectados();
      renderizarMapaAdmin();
      exibirMensagem("mensagem-plantio", "Produto cadastrado no banco de dados.", "sucesso");
      formulario.reset();
      preencherSelectTalhoes();
      FrutLog.notificarAtualizacaoTalhoes();
    } catch (erro) {
      exibirMensagem("mensagem-plantio", erro.message, "erro");
    } finally {
      liberarBotao();
    }
  });
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
  tabela.innerHTML = '<tr><td colspan="6">Carregando histórico...</td></tr>';
  try {
    const resposta = await FrutLog.apiFetch("/admin/historico-operacao");
    historicoOperacao = Array.isArray(resposta.historico) ? resposta.historico : [];
    historicoOperacaoCarregado = true;
    renderizarHistoricoAdmin();
  } catch (erro) {
    mostrarLinhasVazias("tabela-historico-admin", 6, `Falha ao carregar histórico: ${erro.message}`);
  }
}

// Registro aberto no leitor de detalhes. Guardado fora da renderizacao para que
// o modal se atualize sozinho depois de arquivar algo, que recarrega a tabela.
let detalheHistoricoAberto = "";

/**
 * Formata uma área em hectares no padrão pt-BR (vírgula decimal).
 * @param {number|string} valor - Área em hectares.
 * @returns {string} Ex.: "15,5 ha"; "--" quando o valor não é numérico.
 */
function formatarArea(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "--";
  return `${numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

/**
 * Monta a chave que identifica um registro do histórico de forma única.
 * Usa o id vindo da API e cai para tipo:registroId caso ele falte.
 * @param {object} item - Registro devolvido por GET /admin/historico-operacao.
 * @returns {string} Chave usada pelo botão "Ver detalhes" e pelo leitor.
 */
function chaveHistorico(item) {
  return item.id || `${item.tipo}:${item.registroId}`;
}

/**
 * Monta o contador em pílula exibido na coluna "Registros".
 * Substitui as listas que antes estouravam a célula da tabela.
 * @param {string} icone - Classe do ícone FontAwesome (ex.: "fa-microchip").
 * @param {number} total - Quantidade a exibir.
 * @param {string} rotulo - Nome do que está sendo contado, para leitor de tela.
 * @param {boolean} [alerta=false] - true pinta de vermelho quando total > 0.
 * @returns {string} HTML do chip.
 */
function chipHistorico(icone, total, rotulo, alerta = false) {
  const vazio = !total;
  return `<span class="chip-historico${vazio ? " chip-historico-vazio" : ""}${alerta && total ? " chip-historico-alerta" : ""}" title="${escaparHtml(`${total} ${rotulo}`)}">
    <i class="fa-solid ${icone}" aria-hidden="true"></i>${total}<span class="sr-only"> ${escaparHtml(rotulo)}</span>
  </span>`;
}

/**
 * Envolve um trecho do leitor de detalhes numa seção com título.
 * @param {string} titulo - Título da seção (ex.: "Sensores").
 * @param {string} conteudo - HTML já montado do corpo da seção.
 * @returns {string} HTML da seção.
 */
function blocoDetalheHistorico(titulo, conteudo) {
  return `<section class="detalhe-bloco"><h3>${escaparHtml(titulo)}</h3>${conteudo}</section>`;
}

/**
 * Monta uma lista do leitor de detalhes ou a frase de lista vazia.
 * @param {string[]} itens - Itens já em HTML (<li>...</li>).
 * @param {string} vazio - Texto exibido quando não há itens.
 * @returns {string} HTML da <ul> ou do parágrafo de vazio.
 */
function listaDetalheHistorico(itens, vazio) {
  if (!itens.length) return `<p class="detalhe-vazio">${escaparHtml(vazio)}</p>`;
  return `<ul class="detalhe-lista">${itens.join("")}</ul>`;
}

/**
 * Monta uma colheita como linha do leitor: dado à esquerda, ação à direita.
 * @param {object} colheita - Registro cru da tabela colheita. ATENÇÃO: vem do
 *   banco em snake_case (arquivado_em, colhido_em), diferente dos ciclos.
 * @returns {string} HTML do <li> com o botão de arquivar ou restaurar.
 */
function linhaColheitaHistorico(colheita) {
  const arquivada = Boolean(colheita.arquivado_em);
  return `<li class="detalhe-item">
    <span>${formatarData(colheita.colhido_em)} · ${escaparHtml(colheita.quantidade)} ${escaparHtml(colheita.unidade)}</span>
    <button class="btn-acao-admin${arquivada ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(colheita.id)}" data-tipo-historico="colheita">${arquivada ? "Restaurar" : "Arquivar"}</button>
  </li>`;
}

/**
 * Cria (uma vez) e devolve o <dialog> do leitor de detalhes do histórico.
 * ATENÇÃO (DOM): o dialog nasce no <body>, FORA de .historico-operacao-admin,
 * por isso o CSS dele é escopado por #modal-detalhe-historico.
 * Os cliques são delegados aqui: fechar e os botões de arquivar/restaurar que
 * aparecem dentro do leitor passam por este mesmo listener.
 * @returns {HTMLDialogElement} O dialog pronto para receber conteúdo.
 */
function garantirModalHistorico() {
  let modal = document.getElementById("modal-detalhe-historico");
  if (modal) return modal;

  modal = document.createElement("dialog");
  modal.id = "modal-detalhe-historico";
  modal.className = "modal-leitura-relatorio";
  modal.setAttribute("aria-labelledby", "modal-detalhe-historico-titulo");
  document.body.append(modal);

  modal.addEventListener("click", (evento) => {
    if (evento.target === modal || evento.target.closest("[data-fechar-detalhe]")) {
      modal.close();
      return;
    }
    const botao = evento.target.closest("[data-alternar-arquivo]");
    if (botao) alternarArquivoHistorico(botao);
  });
  modal.addEventListener("close", () => { detalheHistoricoAberto = ""; });
  return modal;
}

/**
 * Monta o HTML interno do leitor de detalhes de um registro do histórico.
 * Reaproveita as classes .modal-leitura-* do leitor de relatórios para as duas
 * telas terem a mesma aparência.
 * @param {object} item - Registro do histórico (ciclo, colheita ou talhão).
 * @param {object} [operacaoAtual] - Situação atual do talhão vinda de
 *   /painel-tecnico, usada no bloco "Situação em campo".
 * @returns {string} HTML completo do dialog (cabeçalho, metadados, corpo, rodapé).
 */
function conteudoModalHistorico(item, operacaoAtual) {
  const sensores = listaDetalheHistorico(
    (item.sensores || []).map((sensor) => `<li class="detalhe-item-simples">${escaparHtml(sensor.identificador)} · ${escaparHtml(sensor.metrica)} <span class="detalhe-apoio">(${escaparHtml(sensor.status)})</span></li>`),
    "Nenhum sensor associado."
  );
  const colheitas = listaDetalheHistorico(
    (item.colheitas || []).map(linhaColheitaHistorico),
    "Nenhuma colheita registrada."
  );
  const alertas = listaDetalheHistorico(
    (item.alertas || []).map((alerta) => `<li class="detalhe-item-simples">${escaparHtml(alerta.titulo)} <span class="detalhe-apoio">(${escaparHtml(alerta.status)})</span></li>`),
    "Nenhum alerta registrado."
  );
  const pendencia = operacaoAtual && operacaoAtual.situacao !== "Normal"
    ? `<p class="detalhe-texto detalhe-pendencia">${escaparHtml(operacaoAtual.prioridade)}</p>`
    : '<p class="detalhe-vazio">Sem pendência aberta.</p>';
  const ciclo = item.tipo === "talhao"
    ? '<span class="detalhe-apoio">Sem ciclo cadastrado</span>'
    : `${formatarData(item.plantadoEm)} → ${formatarData(item.encerradoEm || item.previsaoColheita)}`;
  const situacao = operacaoAtual?.situacao || (item.tipo === "talhao" ? "Sem ciclo cadastrado" : item.status);
  const arquivado = Boolean(item.arquivadoEm);
  const acaoRegistro = !arquivado && item.tipo === "ciclo" && item.status === "ativo"
    ? '<button class="btn-acao-admin" type="button" disabled title="Encerre o ciclo antes de arquivar">Ciclo ativo</button>'
    : `<button class="btn-acao-admin${arquivado ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(item.registroId)}" data-tipo-historico="${escaparHtml(item.tipo)}">${arquivado ? "Restaurar registro" : "Arquivar registro"}</button>`;
  const acaoTalhao = item.tipo === "talhao"
    ? ""
    : `<button class="btn-acao-admin${item.talhaoArquivadoEm ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(item.talhaoId)}" data-tipo-historico="talhao">${item.talhaoArquivadoEm ? "Restaurar talhão" : "Arquivar talhão"}</button>`;

  return `
    <div class="modal-leitura-cabecalho">
      <div>
        <p class="modal-leitura-sobretitulo">Histórico de talhões e cultivos</p>
        <h2 id="modal-detalhe-historico-titulo">Talhão ${escaparHtml(item.talhao)} · ${escaparHtml(item.produto)}${item.variedade ? ` / ${escaparHtml(item.variedade)}` : ""}</h2>
      </div>
      <button type="button" class="modal-leitura-fechar" data-fechar-detalhe aria-label="Fechar detalhes">&times;</button>
    </div>
    <dl class="modal-leitura-metadados">
      <div><dt>Cadastro do talhão</dt><dd>${formatarData(item.talhaoCriadoEm)}</dd></div>
      <div><dt>Ciclo</dt><dd>${ciclo}</dd></div>
      <div><dt>Área</dt><dd>${formatarArea(item.areaTalhao)}${item.areaPlantada != null ? ` · ${formatarArea(item.areaPlantada)} plantados` : ""}</dd></div>
    </dl>
    <div class="modal-leitura-corpo detalhe-historico">
      ${blocoDetalheHistorico("Situação em campo", `<p class="detalhe-texto"><span class="badge-status ${normalizarStatus(situacao)}">${escaparHtml(FrutLog.textoInterface(situacao))}</span></p>${pendencia}`)}
      ${blocoDetalheHistorico("Sensores", sensores)}
      ${blocoDetalheHistorico("Colheitas", colheitas)}
      ${blocoDetalheHistorico("Alertas", alertas)}
    </div>
    <div class="modal-leitura-rodape detalhe-rodape">${acaoRegistro}${acaoTalhao}</div>`;
}

/**
 * Abre o leitor de detalhes de um registro, ou o atualiza se já estiver aberto.
 * Chamado pelo botão "Ver detalhes" e também ao fim de cada re-renderização,
 * para o leitor refletir os dados novos depois de arquivar algo.
 * @param {string} chave - Valor devolvido por chaveHistorico().
 * @returns {void} Fecha o leitor se o registro não existir mais.
 */
function abrirDetalhesHistorico(chave) {
  const modalAberto = document.getElementById("modal-detalhe-historico");
  const item = historicoOperacao.find((registro) => chaveHistorico(registro) === chave);
  if (!item) {
    // O registro sumiu do histórico: fecha o leitor em vez de deixar dado velho.
    if (modalAberto?.open) modalAberto.close();
    return;
  }
  const operacaoAtual = (painelTecnico.talhoes || []).find((talhao) => talhao.id === item.talhao);
  const modal = garantirModalHistorico();
  modal.innerHTML = conteudoModalHistorico(item, operacaoAtual);
  detalheHistoricoAberto = chave;
  if (!modal.open) modal.showModal();
}

/**
 * Redesenha a tabela "Histórico de talhões e cultivos".
 * Mostra uma linha enxuta por registro (talhão, ciclo, área, contadores,
 * situação e ações); o conteúdo pesado fica no leitor de detalhes.
 * Respeita o filtro ativo (ativos / arquivados / todos).
 * ATENÇÃO (DOM): lê as globais historicoOperacao, painelTecnico e
 * filtroHistoricoOperacao, e escreve no <tbody> #tabela-historico-admin.
 * @returns {void}
 */
function renderizarHistoricoAdmin() {
  const situacaoAtualPorTalhao = new Map((painelTecnico.talhoes || []).map((item) => [item.id, item]));
  const registrosFiltrados = historicoOperacao.filter((item) => {
    const estaArquivado = Boolean(item.arquivadoEm || item.talhaoArquivadoEm);
    if (filtroHistoricoOperacao === "arquivados") return estaArquivado;
    if (filtroHistoricoOperacao === "ativos") return !estaArquivado;
    return true;
  });
  preencherTabela("tabela-historico-admin", 6, registrosFiltrados.map((item) => {
    const operacaoAtual = situacaoAtualPorTalhao.get(item.talhao);
    const situacao = operacaoAtual?.situacao || (item.tipo === "talhao" ? "Sem ciclo cadastrado" : item.status);
    const arquivado = Boolean(item.arquivadoEm);

    const ciclo = item.tipo === "talhao"
      ? '<span class="celula-historico-vazia">Sem ciclo cadastrado</span>'
      : `${formatarData(item.plantadoEm)} <span class="seta-periodo" aria-hidden="true">→</span> ${formatarData(item.encerradoEm || item.previsaoColheita)}<span class="historico-subtexto">${item.encerradoEm ? "Encerrado" : "Previsão de colheita"}</span>`;

    const acaoArquivar = !arquivado && item.tipo === "ciclo" && item.status === "ativo"
      ? '<button class="btn-acao-admin" type="button" disabled title="Encerre o ciclo antes de arquivar">Ciclo ativo</button>'
      : `<button class="btn-acao-admin${arquivado ? "" : " btn-excluir-admin"}" type="button" data-alternar-arquivo="${escaparHtml(item.registroId)}" data-tipo-historico="${escaparHtml(item.tipo)}">${arquivado ? "Restaurar" : "Arquivar"}</button>`;

    return `<tr class="linha-historico">
      <td>
        <strong>${escaparHtml(item.talhao)}</strong>
        <span class="historico-subtexto">${escaparHtml(item.produto)}${item.variedade ? ` / ${escaparHtml(item.variedade)}` : ""}</span>
      </td>
      <td>${ciclo}</td>
      <td>${formatarArea(item.areaTalhao)}${item.areaPlantada != null ? `<span class="historico-subtexto">${formatarArea(item.areaPlantada)} plantados</span>` : ""}</td>
      <td>
        <div class="chips-historico">
          ${chipHistorico("fa-microchip", (item.sensores || []).length, "sensor(es)")}
          ${chipHistorico("fa-box-open", (item.colheitas || []).length, "colheita(s)")}
          ${chipHistorico("fa-triangle-exclamation", (item.alertas || []).length, "alerta(s)", true)}
        </div>
      </td>
      <td><span class="badge-status ${normalizarStatus(situacao)}">${escaparHtml(FrutLog.textoInterface(situacao))}</span></td>
      <td>
        <div class="celula-acoes-historico">
          <button class="btn-abrir-relatorio" type="button" data-detalhe-historico="${escaparHtml(chaveHistorico(item))}">Ver detalhes</button>
          ${acaoArquivar}
        </div>
      </td>
    </tr>`;
  }));

  // A tabela foi reconstruida: recarrega o leitor aberto com os dados novos.
  if (detalheHistoricoAberto) abrirDetalhesHistorico(detalheHistoricoAberto);
}

/**
 * Arquiva ou restaura o registro do botão clicado.
 * Fica fora do listener porque os mesmos botões aparecem na tabela e dentro do
 * leitor de detalhes. Decide o sentido da ação pelo estado atual do registro.
 * @param {HTMLButtonElement} botao - Botão com data-alternar-arquivo (id) e
 *   data-tipo-historico ("talhao" | "ciclo" | "colheita").
 * @returns {Promise<void>} Recarrega o histórico ao concluir; em caso de falha
 *   mostra a mensagem do servidor e mantém a tela como estava.
 */
async function alternarArquivoHistorico(botao) {
  const tipo = botao.dataset.tipoHistorico;
  const id = botao.dataset.alternarArquivo;
  const registro = tipo === "colheita"
    ? historicoOperacao.flatMap((item) => item.colheitas || []).find((item) => String(item.id) === String(id))
    : historicoOperacao.find((item) => item.tipo === tipo && String(item.registroId) === String(id));
  if (!registro) return;
  // Ciclos e talhões chegam com arquivadoEm; as colheitas vêm cruas do banco,
  // com arquivado_em. Sem olhar os dois, "Restaurar colheita" voltava a arquivar.
  const arquivar = !(registro.arquivadoEm || registro.arquivado_em);
  // Trava o botão durante a ida ao servidor: sem isso, dois cliques rápidos
  // disparam dois PATCH e o segundo desfaz o primeiro.
  const liberarBotao = FrutLogFeedback.ocupar(botao, arquivar ? "Arquivando..." : "Restaurando...");
  try {
    // ATENÇÃO (API): esta rota não apaga nada, só preenche ou limpa
    // arquivado_em. Ciclos, colheitas e talhões continuam no banco.
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
    exibirMensagem("mensagem-dados-tecnicos", erro.message, "erro");
  } finally {
    // O botão pode ter sumido do DOM na re-renderização da tabela; liberar()
    // trata esse caso sem erro.
    liberarBotao();
  }
}

/**
 * Liga os eventos da seção de histórico: troca de filtro e cliques na tabela.
 * ATENÇÃO (DOM): usa delegação no <tbody>, então funciona para as linhas que
 * ainda serão criadas em re-renderizações futuras.
 * @returns {void}
 */
function configurarAcoesHistorico() {
  document.getElementById("filtro-historico-admin")?.addEventListener("change", (evento) => {
    filtroHistoricoOperacao = evento.currentTarget.value;
    renderizarHistoricoAdmin();
  });
  document.getElementById("tabela-historico-admin")?.addEventListener("click", (evento) => {
    const botaoDetalhe = evento.target.closest("[data-detalhe-historico]");
    if (botaoDetalhe) {
      abrirDetalhesHistorico(botaoDetalhe.dataset.detalheHistorico);
      return;
    }
    const botao = evento.target.closest("[data-alternar-arquivo]");
    if (botao) alternarArquivoHistorico(botao);
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

/**
 * Preenche o cartão "Detalhes do Talhão" da seção de monitoramento.
 *
 * Os ids `talhao-*` são os do cartão em admin.html e os `tecnico-talhao-*` os
 * do painel do Técnico; a função escreve nos dois porque `preencher` ignora
 * elemento ausente, então o mesmo código serve aos dois layouts.
 * @param {string} codigo - Código do talhão selecionado no mapa.
 * @returns {void}
 */
function renderizarDetalhesTalhaoAdmin(codigo) {
  const feature = FrutLogTalhoes.obterTalhoes().find((item) => item.properties.codigo === codigo);
  if (!feature) return;
  const dadosTalhao = (painelTecnico.talhoes || []).find((item) => item.id === codigo) || {};
  const plantio = (painelTecnico.plantios || []).find((item) => item.talhao === codigo) || {};
  const inspecao = (painelTecnico.inspecoes || []).find((item) => item.talhao === codigo) || {};
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

  // Cartão de detalhes do admin.html (ids sem o prefixo "tecnico-").
  preencher("titulo-talhao", `Detalhes: Talhão ${codigo}`);
  preencher("talhao-produto", plantio.produto || props.produto || "--");
  preencher("talhao-variedade", plantio.variedade || props.variedade || "--");
  preencher("talhao-area", props.area_hectares ? `${props.area_hectares} hectares` : props.area || "--");
  preencher("talhao-solo", plantio.solo || props.solo || "--");
  preencher("talhao-plantio", plantio.plantado_em ? formatarData(plantio.plantado_em) : (props.plantio || "--"));
  preencher("talhao-colheita", plantio.previsao_colheita ? formatarData(plantio.previsao_colheita) : (props.colheita || "--"));
  // Sem ciclo ativo nao se mostra teto de temperatura. O limite pertence a
  // CULTURA, e a que estava plantada ja foi colhida -- exibir o numero antigo
  // daria a entender que alguem ainda esta sendo vigiado por ele. `plantio` ja
  // vem de /painel-tecnico filtrado por status=ativo, entao a ausencia de id
  // e a prova de que o ciclo foi encerrado.
  const temCicloAtivo = Boolean(plantio.id);
  preencher("talhao-temperatura-maxima", temCicloAtivo && props.parametros?.temperaturaMaxima != null
    ? `${props.parametros.temperaturaMaxima} °C`
    : "--");

  // Leitura real e diagnostico, logo ao lado do limite cadastrado: o usuario ve
  // na mesma tela o que foi configurado, o que o sensor mediu e a conclusao.
  // Tudo sai de props.monitoramento, preenchido por aplicarMonitoramento() a
  // partir do veredito de GET /predador/analise (ou do calculo de reserva).
  const ia = monitorado.monitoramento || {};
  // Mostra a idade junto do valor: "33.1 °C · há 2 min" nao deixa duvida sobre
  // estar vendo o agora ou um dado parado. Sem leitura validada pelo nucleo o
  // campo fica "--" -- antes ele caia na media do dia e continuava se chamando
  // "Temperatura Atual", que e pior que campo vazio.
  const minutos = ia.coletadoEm ? Math.round((Date.now() - new Date(ia.coletadoEm)) / 60000) : null;
  preencher("talhao-temperatura-atual", ia.temperaturaAtual != null
    ? `${ia.temperaturaAtual} °C${minutos != null ? ` · há ${minutos} min` : ""}`
    : "--");
  preencher("talhao-umidade-solo", ia.umidadeSolo != null ? `${ia.umidadeSolo} %` : "--");
  preencher("talhao-diagnostico", ia.mensagem || monitorado.prioridade || "--");
  preencher("talhao-diagnostico-origem", ia.origem ? `Fonte: ${ia.origem}` : "");

  // A barra lateral da linha repete a cor do mapa, para o diagnostico escrito e
  // o talhao pintado nunca contarem historias diferentes.
  const linhaIa = document.getElementById("talhao-diagnostico")?.closest(".destaque-ia");
  if (linhaIa) {
    linhaIa.className = `item-detalhe destaque-ia status-${normalizarStatus(monitorado.status || "sem-leitura")}`;
  }

  preencher("talhao-inspecao-data", inspecao.data ? formatarData(inspecao.data) : "--");
  preencher("talhao-inspecao-tecnico", inspecao.data ? "Registrado em campo" : "--");
  preencher("talhao-inspecao-problema", inspecao.problemas || "Nenhuma inspeção registrada.");
  preencher("talhao-inspecao-recomendacao", inspecao.observacoes || "--");

  const textoStatus = FrutLog.textoInterface(monitorado.status || "Sem leitura");
  const classeStatus = `badge-status ${normalizarStatus(monitorado.status || "sem-leitura")}`;
  ["tecnico-talhao-status", "talhao-status"].forEach((id) => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = textoStatus;
    badge.className = classeStatus;
  });
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
    // Trava o botão enquanto a API processa: encerrar o mesmo ciclo duas vezes
    // devolve 409 e confunde o usuário.
    const liberarBotao = FrutLogFeedback.ocupar(botao, "Encerrando...");
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
      // Ciclo encerrado: o cadastro de produto volta a aceitar este talhão.
      preencherSelectTalhoes();
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
      FrutLogFeedback.toast(erro.message, "erro");
    } finally {
      encerrandoCicloAdmin = false;
      liberarBotao();
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
  const graficoAtivo = Chart.getChart(canvas);
  if (graficoAtivo) graficoAtivo.destroy();
  graficoColheita = null;
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
    FrutLog.apiFetch("/predador/analise"),
  ]);
  // O diagnostico do Predador entra ANTES de qualquer renderizacao: e ele que
  // define a cor do talhao no mapa e o status no painel de detalhes, dentro de
  // FrutLogTalhoes.calcularStatusMonitoramento. Se chegasse depois, a tela seria
  // pintada pela regra local de reserva e so mudaria no proximo render.
  // allSettled e nao all: se a rota do Predador cair, o resto do painel carrega
  // igual e o mapa usa o calculo de reserva.
  if (resultados[6].status === "fulfilled") {
    FrutLogTalhoes.definirDiagnosticos(resultados[6].value.talhoes || []);
  }
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

// De quanto em quanto tempo a tela vai buscar leitura nova.
// 60s casa com o ritmo da ponte (PONTE_INTERVALO_SEGUNDOS), entao a tela nunca
// pede mais rapido do que o dado aparece. Tambem fica bem longe do limite de
// 120 requisicoes/min por IP do servidor.
const INTERVALO_LEITURAS_MS = 60000;

/**
 * Rebusca as leituras e repinta o mapa, sem recarregar a pagina.
 *
 * POR QUE EXISTE: "Temperatura Atual" so e atual se a tela for buscar sozinha.
 * Antes o painel so se atualizava no F5 ou ao salvar um talhao -- o numero
 * podia ficar parado por horas com cara de agora, que e exatamente o problema
 * que esta rotina e o campo de idade ao lado do valor vieram corrigir juntos.
 *
 * E DE PROPOSITO mais leve que atualizarDadosCampoConectados(): nao rechama
 * carregarMapaAdmin(), porque a geometria dos talhoes nao muda sozinha -- so
 * muda quando alguem edita. O que muda a cada minuto e a leitura.
 * @returns {Promise<void>}
 */
async function atualizarLeiturasAoVivo() {
  // Nao encosta no mapa enquanto alguem esta desenhando: repintar por baixo
  // apagaria os pontos em ajuste. A classe e posta por editor-mapa-talhoes.js,
  // entao os dois arquivos conversam pelo DOM, sem um importar o outro.
  if (document.querySelector(".mapa-container.modo-edicao")) return;

  // Aba em segundo plano nao precisa de dado fresco: economiza requisicao e
  // evita que varias abas abertas somem contra o limite do servidor.
  if (document.hidden) return;

  const [painel, predador] = await Promise.allSettled([
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLog.apiFetch("/predador/analise"),
  ]);

  if (predador.status === "fulfilled") {
    FrutLogTalhoes.definirDiagnosticos(predador.value.talhoes || []);
  }
  if (painel.status === "fulfilled") {
    painelTecnico = painel.value;
    renderizarPainelTecnico();
  }

  // Falha de rede aqui NAO vira mensagem na tela: e atualizacao de fundo, e a
  // proxima rodada tenta de novo. Avisar a cada minuto so geraria ruido e
  // ensinaria o usuario a ignorar aviso de erro.
  renderizarMapaAdmin();
}

async function atualizarDadosCampoConectados() {
  const atualizacoes = [
    FrutLog.apiFetch("/painel-tecnico"),
    carregarMapaAdmin(),
    // Rebusca o diagnostico junto com o resto: se o engenheiro acabou de mudar a
    // temperatura maxima de um talhao, a cor no mapa precisa mudar no mesmo
    // refresh, e nao so no proximo F5.
    FrutLog.apiFetch("/predador/analise"),
  ];
  if (historicoOperacaoCarregado) atualizacoes.push(carregarHistoricoOperacao());
  const [painel, , predador] = await Promise.allSettled(atualizacoes);
  if (predador.status === "fulfilled") {
    FrutLogTalhoes.definirDiagnosticos(predador.value.talhoes || []);
  }
  if (painel.status === "fulfilled") {
    painelTecnico = painel.value;
    renderizarPainelTecnico();
    renderizarMapaAdmin();
  }

  // Redesenha os botoes do painel de telemetria: esta funcao roda quando a
  // lista de talhoes muda (evento frutlog:talhoes-atualizados), entao e aqui
  // que talhao recem-criado ganha botao e talhao arquivado perde o dele --
  // sem precisar de F5. Nao entra na atualizacao de 60s de proposito: ali a
  // lista nao mudou, e chamar isto faria o painel buscar duas vezes por
  // minuto em vez de uma.
  if (typeof FrutLogTelemetria !== "undefined") {
    FrutLogTelemetria.definirTalhoes(FrutLogTalhoes.obterTalhoes());
  }
}
