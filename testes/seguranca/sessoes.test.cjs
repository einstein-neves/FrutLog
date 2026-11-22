const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");

Object.assign(process.env, {
  SUPABASE_URL: "https://seguranca.invalid",
  SUPABASE_SECRET_KEY: "sb_secret_ficticia",
  JWT_SECRET: "segredo-ficticio-seguranca-com-mais-de-32-caracteres",
  IOT_API_KEY: "iot-ficticio",
  FRONTEND_ORIGIN: "https://frutlog.invalid",
  TOTP_ENCRYPTION_KEY: "totp-encryption-synthetic-key-with-more-than-thirty-two-characters",
  SECURITY_MISSION_CODE: "SYNTHETIC-TEST",
  TRUSTED_PROXIES: "",
});
const { criarToken, autenticarRequisicao } = require("../../api/session");
const totp = require("../../api/totp");
const app = require("../../src/server");
const originalFetch = global.fetch;
let server, usuarios, consultas, indisponivel, desafios, codigosRecuperacao;
function hash(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `pbkdf2$210000$${salt}$${crypto.pbkdf2Sync(senha, salt, 210000, 32, "sha256").toString("hex")}`;
}
const hashOriginal = hash("Senha1234");
function token(id = "admin", extras = {}) {
  const u = usuarios.find((item) => item.id === id);
  return criarToken({ id, perfil: u.perfil === "administrador" ? "admin" : u.perfil,
    mustChangePassword: u.senha_temporaria, ...extras }, process.env.JWT_SECRET, u.senha_hash);
}
function request(method, path, { bearer, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path: `/api${path}`, method,
      headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers,
        ...(!bearer && (path === "/login" || path === "/login/otp") && !headers["X-Forwarded-For"]
          ? { "X-Forwarded-For": `192.0.2.${crypto.randomInt(1, 255)}` } : {}) } }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
before(async () => {
  global.fetch = async (raw, init = {}) => {
    if (indisponivel) throw new Error("Banco de teste indisponivel");
    const url = new URL(raw);
    assert.equal(url.hostname, "seguranca.invalid");
    const table = url.pathname.split("/").pop();
    consultas.push({ table, method: init.method, query: url.search });
    let rows = [];
    if (table === "consumir_desafio_login_otp") {
      const body = JSON.parse(init.body);
      const item = desafios.find((entry) => entry.id === body.p_id);
      if (item && Date.parse(item.expira_em) > Date.now() && item.tentativas < 5 && body.p_codigo_valido && item.credencial_hash === body.p_credencial_hash) {
        desafios = desafios.filter((entry) => entry.id !== item.id);
        rows = [{ usuario_id: item.usuario_id, modo: item.modo, totp_secret_ciphertext: item.totp_secret_ciphertext }];
      } else if (item && Date.parse(item.expira_em) <= Date.now()) desafios = desafios.filter((entry) => entry.id !== item.id);
      else if (item) item.tentativas++;
      return new Response(JSON.stringify(rows[0] || null));
    }
    if (table === "consumir_codigo_recuperacao") {
      const body = JSON.parse(init.body);
      const index = codigosRecuperacao.findIndex((entry) => entry.usuario_id === body.p_usuario_id && entry.codigo_hash === body.p_codigo_hash);
      if (index >= 0) codigosRecuperacao.splice(index, 1);
      return new Response(JSON.stringify(index >= 0));
    }
    if (table === "desafio_login_otp") {
      const query = url.searchParams;
      if (init.method === "POST") desafios.push(JSON.parse(init.body));
      else if (init.method === "DELETE") desafios = desafios.filter((entry) => query.get("usuario_id") !== `eq.${entry.usuario_id}`);
      else rows = desafios.filter((entry) => !query.has("id") || query.get("id") === `eq.${entry.id}`);
      return new Response(JSON.stringify(rows));
    }
    if (table === "usuario_codigo_recuperacao") {
      const query = url.searchParams;
      if (init.method === "POST") codigosRecuperacao.push(...JSON.parse(init.body));
      else if (init.method === "DELETE") codigosRecuperacao = codigosRecuperacao.filter((entry) => query.get("usuario_id") !== `eq.${entry.usuario_id}`);
      else rows = codigosRecuperacao.filter((entry) => (!query.has("usuario_id") || query.get("usuario_id") === `eq.${entry.usuario_id}`) && (!query.has("codigo_hash") || query.get("codigo_hash") === `eq.${entry.codigo_hash}`));
      return new Response(JSON.stringify(rows));
    }
    if (table === "usuario") {
      rows = usuarios.filter((u) => (!url.searchParams.has("organizacao_id") || `eq.${u.organizacao_id}` === url.searchParams.get("organizacao_id")) && (!url.searchParams.has("id") || `eq.${u.id}` === url.searchParams.get("id")) &&
        (!url.searchParams.has("matricula") || `eq.${u.matricula}` === url.searchParams.get("matricula")));
      if (init.method === "PATCH") for (const u of rows) Object.assign(u, JSON.parse(init.body));
    }
    return new Response(JSON.stringify(rows));
  };
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});
beforeEach(() => {
  app.set("trust proxy", ["127.0.0.1/32"]);
  consultas = [];
  indisponivel = false;
  usuarios = [
    { id: "admin", organizacao_id: "org", matricula: "A001", nome_completo: "Admin", perfil: "administrador", status: "ativo", senha_hash: hashOriginal, senha_temporaria: false, totp_secret: totp.criarSegredo() },
    { id: "tecnico", organizacao_id: "org", matricula: "T001", nome_completo: "Tecnico", perfil: "tecnico", status: "ativo", senha_hash: hashOriginal, senha_temporaria: false, totp_secret: totp.criarSegredo() },
  ];
  for (const user of usuarios) {
    user.totp_secret_ciphertext = totp.criptografarSegredo(user.totp_secret, process.env.TOTP_ENCRYPTION_KEY);
    user.totp_ultimo_passo = -1;
  }
  desafios = [];
  codigosRecuperacao = [];
});
afterEach(() => app.set("trust proxy", false));
after(async () => { global.fetch = originalFetch; await new Promise((resolve) => server.close(resolve)); });

test("conta ativa acessa GET; bloqueio, exclusao e mudanca de perfil revogam leituras e escritas", async () => {
  const sessao = token();
  assert.equal((await request("GET", "/alertas", { bearer: sessao })).status, 200);
  usuarios[0].status = "inativo";
  for (const [metodo, rota] of [["GET", "/funcionarios"], ["GET", "/relatorios"], ["POST", "/plantios"]]) {
    consultas = [];
    assert.equal((await request(metodo, rota, { bearer: sessao, body: metodo === "POST" ? {} : undefined })).status, 401);
    assert.ok(consultas.every((c) => c.table === "usuario" && c.method === "GET"));
  }
  usuarios[0].status = "ativo";
  usuarios[0].perfil = "tecnico";
  assert.equal((await request("GET", "/funcionarios", { bearer: sessao })).status, 401);
  usuarios.shift();
  assert.equal((await request("GET", "/alertas", { bearer: sessao })).status, 401);
});

test("primeiro acesso configura TOTP e devolve codigos de recuperacao de uso unico", async () => {
  usuarios[1].totp_secret_ciphertext = null;
  const inicio = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  assert.equal(inicio.status, 200);
  assert.equal(inicio.data.modo, "setup");
  assert.match(inicio.data.qrCode, /^data:image\/png;base64,/);
  assert.ok(inicio.data.segredoManual);
  assert.ok(!inicio.data.token);
  const codigo = totp.codigoNoPasso(inicio.data.segredoManual, Math.floor(Date.now() / 30000));
  const confirmado = await request("POST", "/login/otp", { body: { desafio: inicio.data.desafio, codigo } });
  assert.equal(confirmado.status, 200);
  assert.equal(confirmado.data.codigosRecuperacao.length, 10);
  assert.ok(usuarios[1].totp_secret_ciphertext);
  assert.notEqual(usuarios[1].totp_secret_ciphertext, inicio.data.segredoManual);
});

test("senha correta sem OTP nao cria sessao; OTP incorreto e expirado sao recusados", async () => {
  const semOtp = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  assert.equal(semOtp.status, 200);
  assert.equal(semOtp.data.otpRequerido, true);
  assert.ok(!semOtp.data.token);

  const codigoAtual = totp.codigoNoPasso(usuarios[1].totp_secret, Math.floor(Date.now() / 30000));
  const codigoErrado = `${(Number(codigoAtual[0]) + 1) % 10}${codigoAtual.slice(1)}`;
  const logs = [];
  const warn = console.warn;
  console.warn = (message) => logs.push(message);
  const errado = await request("POST", "/login/otp", { body: { desafio: semOtp.data.desafio, codigo: codigoErrado } });
  assert.equal(errado.status, 401);

  const expirado = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  const challenge = desafios.find((entry) => entry.id === expirado.data.desafio);
  challenge.expira_em = new Date(Date.now() - 1000).toISOString();
  const codigo = totp.codigoNoPasso(usuarios[1].totp_secret, Math.floor(Date.now() / 30000));
  const rejeitado = await request("POST", "/login/otp", { body: { desafio: expirado.data.desafio, codigo } });
  assert.equal(rejeitado.status, 401);
  assert.ok(!rejeitado.data.token);
  console.warn = warn;
  assert.ok(logs.every((entry) => JSON.parse(entry).missao === "SYNTHETIC-TEST"));
  assert.ok(logs.some((entry) => JSON.parse(entry).evento === "OTP_BLOQUEADO"));
});

test("OTP valido cria sessao e a mesma etapa nao pode ser reutilizada", async () => {
  const inicio = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  const passo = Math.floor(Date.now() / 30000);
  const codigo = totp.codigoNoPasso(usuarios[1].totp_secret, passo);
  const valido = await request("POST", "/login/otp", { body: { desafio: inicio.data.desafio, codigo } });
  assert.equal(valido.status, 200);
  assert.ok(valido.data.token);

  const novoDesafio = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  const reutilizado = await request("POST", "/login/otp", { body: { desafio: novoDesafio.data.desafio, codigo } });
  assert.equal(reutilizado.status, 401);
  assert.ok(!reutilizado.data.token);
});

test("codigo de recuperacao permite um acesso e falha quando reutilizado", async () => {
  const code = "ABCD-EFGH-IJKL";
  codigosRecuperacao.push({ usuario_id: "tecnico", codigo_hash: totp.hashCodigoRecuperacao("tecnico", code, process.env.TOTP_ENCRYPTION_KEY) });
  const primeiroDesafio = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  const primeiroAcesso = await request("POST", "/login/otp", { body: { desafio: primeiroDesafio.data.desafio, codigoRecuperacao: code } });
  assert.equal(primeiroAcesso.status, 200);
  assert.equal(codigosRecuperacao.length, 0);

  const segundoDesafio = await request("POST", "/login", { body: { matricula: "T001", senha: "Senha1234" } });
  const repeticao = await request("POST", "/login/otp", { body: { desafio: segundoDesafio.data.desafio, codigoRecuperacao: code } });
  assert.equal(repeticao.status, 401);
});

test("reset via administracao revoga token anterior; login provisório e troca emitem sessao valida", async () => {
  const antigo = token("tecnico");
  const reset = await request("PUT", "/funcionarios/tecnico", { bearer: token(), body: {
    nome: "Tecnico", cargo: "Tecnico", perfil: "tecnico", senha: "Nova12345"
  } });
  assert.equal(reset.status, 200);
  assert.equal((await request("GET", "/alertas", { bearer: antigo })).status, 401);
  assert.equal((await request("POST", "/plantios", { bearer: antigo, body: {} })).status, 401);
  const inicioLogin = await request("POST", "/login", { body: { matricula: "T001", senha: "Nova12345" } });
  assert.equal(inicioLogin.status, 200);
  assert.equal(inicioLogin.data.otpRequerido, true);
  assert.equal(inicioLogin.data.modo, "login");
  assert.ok(!inicioLogin.data.token);
  const passo = Math.floor(Date.now() / 30000);
  const login = await request("POST", "/login/otp", { body: { desafio: inicioLogin.data.desafio,
    codigo: totp.codigoNoPasso(usuarios[1].totp_secret, passo) } });
  assert.equal(login.status, 200);
  assert.equal(login.data.usuario.mustChangePassword, true);
  assert.equal((await request("GET", "/chatbot/contexto", { bearer: login.data.token })).status, 403);
  const troca = await request("POST", "/alterar-senha", { bearer: login.data.token,
    body: { senhaAtual: "Nova12345", novaSenha: "Final1234" } });
  assert.equal(troca.status, 200);
  assert.equal((await request("GET", "/alertas", { bearer: login.data.token })).status, 401);
  assert.equal((await request("GET", "/alertas", { bearer: troca.data.token })).status, 200);
  assert.equal((await request("GET", "/alertas", { bearer: antigo })).status, 401);
  assert.equal(troca.data.usuario.mustChangePassword, false);
  const claims = JSON.parse(Buffer.from(troca.data.token.split(".")[1], "base64url"));
  assert.ok(!JSON.stringify(claims).includes(usuarios[1].senha_hash));
  assert.ok(!JSON.stringify(troca.data).includes("senha_hash"));
});

test("troca direta do hash por script ou SQL tambem revoga sessoes sem depender de memoria local", async () => {
  const antigo = token();
  usuarios[0].senha_hash = hash("Outra1234");
  assert.equal((await request("GET", "/relatorios", { bearer: antigo })).status, 401);
  assert.equal((await request("GET", "/alertas", { bearer: antigo })).status, 401);
  assert.equal((await request("GET", "/alertas", { bearer: token() })).status, 200);
});

test("senha temporaria bloqueia todas as rotas operacionais inclusive chatbot", async () => {
  usuarios[0].senha_temporaria = true;
  const provisoria = token();
  for (const rota of ["/chatbot/contexto", "/predador/analise", "/talhoes", "/relatorios"]) {
    assert.equal((await request("GET", rota, { bearer: provisoria })).status, 403);
  }
  assert.equal((await request("POST", "/chatbot/perguntar", { bearer: provisoria, body: { pergunta: "Como cadastrar sensor?" } })).status, 403);
});

test("tokens legados sem versao e assinaturas adulteradas sao recusados", async () => {
  const valido = token();
  const [h, p] = valido.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url"));
  delete payload.sv;
  const legado = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const assinatura = crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${h}.${legado}`).digest("base64url");
  for (const invalido of [`${h}.${legado}.${assinatura}`, `${valido}.extra`, `${h}.${p}.assinatura-falsa`]) {
    assert.equal(autenticarRequisicao({ headers: { authorization: `Bearer ${invalido}` } }, process.env.JWT_SECRET), null);
    assert.equal((await request("GET", "/alertas", { bearer: invalido })).status, 401);
  }
});

test("falha do banco impede acesso em vez de confiar no token antigo", async () => {
  const sessao = token();
  indisponivel = true;
  const log = console.error;
  console.error = () => {};
  try {
    assert.equal((await request("GET", "/alertas", { bearer: sessao })).status, 500);
    assert.equal((await request("GET", "/relatorios", { bearer: sessao })).status, 503);
  } finally { console.error = log; }
});

test("cadastro aceita email individual e rejeita injecao; contatos ficam restritos a organizacao", async () => {
  const sessao = token();
  const dados = { nome: "Tecnico", cargo: "Campo", perfil: "tecnico", email: "tecnico@example.com" };
  assert.equal((await request("PUT", "/funcionarios/tecnico", { bearer: sessao, body: dados })).status, 200);
  assert.equal(usuarios[1].email, dados.email);
  for (const email of ["a@x.com\r\nBcc: outro@x.com", ["a@x.com"], "a@x.com,b@x.com"]) {
    assert.equal((await request("PUT", "/funcionarios/tecnico", { bearer: sessao, body: { ...dados, email } })).status, 400);
    assert.equal((await request("POST", "/funcionarios", { bearer: sessao, body: { ...dados, email, senha: "Teste1234" } })).status, 400);
  }
  usuarios.push({ ...usuarios[1], id: "outra-org", organizacao_id: "org-B", email: "privado@example.com" });
  const lista = await request("GET", "/funcionarios", { bearer: sessao });
  assert.equal(lista.status, 200);
  assert.ok(!JSON.stringify(lista.data).includes("privado@example.com"));
  assert.equal((await request("PUT", "/funcionarios/outra-org", { bearer: sessao, body: dados })).status, 404);
  assert.equal((await request("DELETE", "/funcionarios/outra-org", { bearer: sessao })).status, 404);
});

test("X-Forwarded-For forjado nao reinicia limite de login em acesso direto", async () => {
  app.set("trust proxy", false);
  assert.equal(app.get("trust proxy"), false);
  const body = { matricula: "inexistente", senha: "12345678" };
  for (let i = 0; i < 11; i++) await request("POST", "/login", { body, headers: { "X-Forwarded-For": `198.51.100.${i}` } });
  assert.equal((await request("POST", "/login", { body, headers: { "X-Forwarded-For": "203.0.113.99" } })).status, 429);
});

test("proxy confiavel: prefixo forjado nao altera IP real anexado pelo proxy", async () => {
  app.set("trust proxy", ["127.0.0.1/32"]);
  try {
    const body = { matricula: "inexistente", senha: "12345678" };
    for (let i = 0; i < 10; i++) {
      assert.equal((await request("POST", "/login", { body, headers: { "X-Forwarded-For": `192.0.2.${i}, 198.51.100.90` } })).status, 401);
    }
    assert.equal((await request("POST", "/login", { body, headers: { "X-Forwarded-For": "192.0.2.200, 198.51.100.90" } })).status, 429);
    assert.equal((await request("POST", "/login", { body, headers: { "X-Forwarded-For": "198.51.100.91" } })).status, 401);
  } finally { app.set("trust proxy", false); }
});
