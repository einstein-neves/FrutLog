const assert = require("node:assert/strict");
const { criarToken } = require("../api/session");

const variaveisOriginais = {};
const variaveis = {
  SUPABASE_URL: "https://frutlog-teste.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  JWT_SECRET: "frutlog-test-secret-with-at-least-32-characters",
  IOT_API_KEY: "iot-test-key",
  FRONTEND_ORIGIN: "https://frutlog.example"
};
Object.keys(variaveis).forEach((chave) => {
  variaveisOriginais[chave] = process.env[chave];
  process.env[chave] = variaveis[chave];
});

const handler = require("../api/[...route]");
const agora = new Date();
const usuario = { id: "usuario-1", matricula: "T001", nome: "Tecnico de teste", perfil: "tecnico" };
let perfilBanco = usuario.perfil;
const requisicoesBanco = [];
let leituraEm = agora.toISOString();
let falharLeitura = false;

function respostaBanco(registro) {
  return new Response(JSON.stringify(registro), {
    status: falharLeitura && registro === "v_ultima_leitura_sensor" ? 503 : 200,
    headers: { "Content-Type": "application/json" }
  });
}

global.fetch = async (url, init = {}) => {
  const endereco = new URL(url);
  const recurso = endereco.pathname.split("/").pop();
  requisicoesBanco.push({ recurso, search: endereco.search, method: init.method || "GET" });
  if (recurso === "usuario") {
    return respostaBanco([{ id: usuario.id, matricula: usuario.matricula, perfil: perfilBanco, status: "ativo" }]);
  }
  if (recurso === "organizacao") return respostaBanco([{ id: "org-1" }]);
  if (recurso === "fazenda") return respostaBanco([{ id: "fazenda-1" }]);
  if (recurso === "talhao") {
    if (init.method === "PATCH") return respostaBanco([]);
    return respostaBanco([{ id: "talhao-1", codigo: "T14", area_hectares: 2 }]);
  }
  if (recurso === "dispositivo") {
    return respostaBanco([{
      id: "dispositivo-1",
      id_externo: "001",
      talhao_id: "talhao-1",
      status: "online",
      ultimo_sinal_em: agora.toISOString()
    }]);
  }
  if (recurso === "sensor") {
    return respostaBanco([{
      id: "sensor-1",
      id_externo: "001",
      dispositivo_id: "dispositivo-1",
      codigo_metrica: "temperatura",
      unidade: "°C",
      status: "ativo"
    }]);
  }
  if (recurso === "v_ultima_leitura_sensor") {
    if (falharLeitura) {
      return new Response(JSON.stringify({ message: "banco indisponível" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }
    return respostaBanco([{
      sensor_id: "sensor-1",
      valor: 35,
      unidade: "°C",
      coletado_em: leituraEm
    }]);
  }
  if (recurso === "colheita" && init.method === "POST") {
    return respostaBanco([{
      id: "colheita-1",
      talhao_id: "talhao-1",
      colhido_em: "2026-11-02",
      quantidade: 120,
      unidade: "kg",
      ano: 2026
    }]);
  }
  if (recurso === "cultura" && init.method === "POST") {
    return respostaBanco([{ id: "cultura-1", nome_comum: "Manga" }]);
  }
  if (recurso === "cultivar" && init.method === "POST") {
    return respostaBanco([{ id: "cultivar-1", cultura_id: "cultura-1", nome: "Palmer" }]);
  }
  if (["cultura", "cultivar", "ciclo_cultura"].includes(recurso)) return respostaBanco([]);
  if (recurso === "relatorio_campo_diario") {
    return respostaBanco([{
      id: "relatorio-1",
      usuario_id: usuario.id,
      tecnico_nome: usuario.nome,
      data_relatorio: "2026-11-01",
      criado_em: "2026-11-02T18:00:00.000Z",
      status: "enviado",
      conteudo: "Inspeção realizada."
    }]);
  }
  if (["inspecao", "ciclo_cultura", "ocorrencia", "problema_sensor", "alerta", "cultivar", "cultura"].includes(recurso)) {
    return respostaBanco([]);
  }
  throw new Error(`Consulta inesperada no teste: ${endereco}`);
};

function fazerRequisicao(method, path, body, perfil = "tecnico") {
  return new Promise((resolve) => {
    const textoBody = body === undefined ? "" : JSON.stringify(body);
    perfilBanco = perfil === "admin" ? "administrador" : perfil;
    const token = criarToken({ ...usuario, perfil }, process.env.JWT_SECRET);
    const req = {
      method,
      url: path,
      headers: { authorization: `Bearer ${token}` },
      socket: { remoteAddress: "127.0.0.1" },
      on(evento, callback) {
        if (evento === "data" && textoBody) callback(Buffer.from(textoBody));
        if (evento === "end") callback();
        return this;
      }
    };
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(nome, valor) { headers[nome] = valor; },
      writeHead(status, valores = {}) { this.statusCode = status; Object.assign(headers, valores); },
      end(conteudo = "") {
        resolve({
          status: this.statusCode,
          headers,
          body: conteudo ? JSON.parse(conteudo) : null
        });
      }
    };
    handler(req, res);
  });
}

async function executar() {
  try {
    let resposta = await fazerRequisicao("GET", "/api/sensores");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.sensores[0].status, "Online");
    assert.equal(resposta.body.sensores[0].dados_recentes, true);
    assert.equal(resposta.body.sensores[0].ultima_leitura_em, leituraEm);
    assert.ok(requisicoesBanco.some((item) => item.recurso === "talhao" && item.search.includes("fazenda_id=in.(fazenda-1)")));
    console.log("PASSOU  lista de sensores consulta apenas os talhões da fazenda ativa");

    resposta = await fazerRequisicao("GET", "/api/talhoes");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.talhoes[0].codigo, "T14");
    assert.ok(requisicoesBanco.some((item) => item.recurso === "talhao" && item.search.includes("arquivado_em=is.null")));
    console.log("PASSOU  rota de talhões lista os talhões ativos da organização");

    leituraEm = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    resposta = await fazerRequisicao("GET", "/api/painel-tecnico");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.sensores[0].status, "Online");
    assert.equal(resposta.body.sensores[0].dados_recentes, false);
    assert.equal(resposta.body.talhoes[0].situacao, "Dados desatualizados");
    assert.equal(resposta.body.talhoes[0].dados_recentes, false);
    assert.ok(resposta.body.tarefas.some((tarefa) => tarefa.talhao === "T14"));
    console.log("PASSOU  painel destaca talhão sem leitura recente e cria tarefa de verificação");

    falharLeitura = true;
    const registrarErro = console.error;
    console.error = () => {};
    try {
      resposta = await fazerRequisicao("GET", "/api/sensores");
    } finally {
      console.error = registrarErro;
    }
    assert.equal(resposta.status, 500);
    assert.match(resposta.body.mensagem, /Falha no banco de dados/);
    console.log("PASSOU  falha de banco não é convertida em lista de sensores vazia");

    falharLeitura = false;
    resposta = await fazerRequisicao("POST", "/api/colheitas", {}, "admin");
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.mensagem, /talhão, data, quantidade positiva/);
    console.log("PASSOU  API de colheita rejeita dados obrigatórios ausentes");

    resposta = await fazerRequisicao("POST", "/api/colheitas", {
      talhao: "T14",
      colhidoEm: "2026-11-02",
      quantidade: 120,
      unidade: "kg"
    }, "admin");
    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.colheita.quantidade, 120);
    assert.equal(resposta.body.cicloEncerrado, false);
    console.log("PASSOU  fluxo de colheita persiste dados e devolve confirmação");

    resposta = await fazerRequisicao("POST", "/api/plantios", {}, "admin");
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.mensagem, /Dados de plantio inválidos/);
    console.log("PASSOU  cadastro de produto rejeita dados incompletos antes de consultar o banco");

    resposta = await fazerRequisicao("POST", "/api/plantios", {
      produto: "Manga",
      variedade: "Palmer",
      talhao: "T14",
      solo: "Arenoso",
      dataPlantio: "2026-10-01",
      dataColheita: "2027-03-01",
      temperaturaMaxima: "30"
    }, "admin");
    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.sucesso, true);
    console.log("PASSOU  cadastro de produto cria cultura, variedade e ciclo ativo");

    resposta = await fazerRequisicao("GET", "/api/relatorios-diarios", undefined, "engenheiro");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.relatorios[0].criado_em, "2026-11-02T18:00:00.000Z");
    assert.equal(resposta.body.relatorios[0].tecnico_matricula, usuario.matricula);
    console.log("PASSOU  rota de relatórios fornece autor, status e horário de recebimento");
  } finally {
    Object.keys(variaveisOriginais).forEach((chave) => {
      if (variaveisOriginais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = variaveisOriginais[chave];
    });
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
