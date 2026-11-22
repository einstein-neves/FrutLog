const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

Object.assign(process.env, {
  SUPABASE_URL: "https://relatorios.invalid", SUPABASE_SECRET_KEY: "sb_secret_teste",
  JWT_SECRET: "segredo-sintetico-relatorios-com-mais-de-32-caracteres",
  IOT_API_KEY: "iot-teste", FRONTEND_ORIGIN: "https://frontend.invalid", TRUSTED_PROXIES: "127.0.0.1/32"
});
const { criarToken } = require("../../api/session");
const app = require("../../src/server");
const originalFetch = global.fetch;
const users = [
  { id: "tec-a", organizacao_id: "org-a", perfil: "tecnico", matricula: "T001" },
  { id: "tec-b", organizacao_id: "org-a", perfil: "tecnico", matricula: "T002" },
  { id: "gestor", organizacao_id: "org-a", perfil: "engenheiro", matricula: "E001" },
  { id: "admin", organizacao_id: "org-a", perfil: "administrador", matricula: "A001" },
  { id: "externo", organizacao_id: "org-b", perfil: "tecnico", matricula: "T003" }
].map((user) => ({ ...user, status: "ativo", senha_hash: "hash-sintetico", senha_temporaria: false }));
const reports = ["tec-a", "tec-b", "externo"].map((id) => ({ id: `rel-${id}`, usuario_id: id, conteudo: `Relatorio ${id}` }));
let server, consultas, falha, ip;
let sequence = 0;
const rotas = ["/relatorios", "/relatorios-diarios"];
function token(id = "tec-a", extra = {}) {
  const user = users.find((u) => u.id === id);
  return criarToken({ id, perfil: user.perfil === "administrador" ? "admin" : user.perfil, ...extra }, process.env.JWT_SECRET, user.senha_hash);
}
function matches(value, filter) {
  if (!filter) return true;
  if (filter.startsWith("eq.")) return value === filter.slice(3);
  if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(value);
  throw Error("Filtro de teste inesperado");
}
function request(path, { bearer, method = "GET", origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path: `/api${path}`, method,
      headers: { "X-Forwarded-For": ip, "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(origin ? { Origin: origin } : {}) } }, (res) => {
      let raw = "";
      res.on("data", (chunk) => raw += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data: raw ? JSON.parse(raw) : null }));
    });
    req.on("error", reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
before(async () => {
  global.fetch = async (raw) => {
    const url = new URL(raw);
    assert.equal(url.hostname, "relatorios.invalid");
    const table = url.pathname.split("/").pop();
    consultas.push(table);
    if (falha === "rede") throw Error("segredo-na-excecao-de-rede");
    if (falha === "banco" && table === "relatorio_campo_diario") return new Response(JSON.stringify({
      code: "42P01", message: "segredo-na-mensagem", details: "segredo-nos-detalhes", hint: "segredo-na-dica"
    }), { status: 500 });
    const q = url.searchParams;
    let rows;
    if (table === "usuario") rows = users.filter((u) => matches(u.id, q.get("id")) && matches(u.organizacao_id, q.get("organizacao_id")));
    else if (table === "relatorio_campo_diario") rows = reports.filter((r) => matches(r.usuario_id, q.get("usuario_id")));
    else throw Error(`Consulta inesperada: ${table}`);
    return new Response(JSON.stringify(rows));
  };
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});
beforeEach(() => {
  ip = `192.0.2.${++sequence}`; consultas = []; falha = null;
  for (const user of users) { user.status = "ativo"; user.senha_temporaria = false; }
});
after(async () => { global.fetch = originalFetch; await new Promise((resolve) => server.close(resolve)); });

test("aliases devolvem relatorios reais: tecnico ve os proprios, gestores apenas a organizacao", async () => {
  for (const path of rotas) {
    for (const id of ["tec-a", "gestor", "admin"]) {
      const result = await request(path, { bearer: token(id) });
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.relatorios.map((r) => r.id), id === "tec-a" ? ["rel-tec-a"] : ["rel-tec-a", "rel-tec-b"]);
      assert.equal(result.data.relatorios[0].tecnico_matricula, "T001");
    }
  }
  assert.ok(consultas.includes("relatorio_campo_diario"));
});

test("relatorios compartilham bloqueios de sessao e senha temporaria", async () => {
  for (const path of rotas) {
    assert.equal((await request(path)).status, 401);
    users[0].status = "inativo";
    assert.equal((await request(path, { bearer: token() })).status, 401);
    users[0].status = "ativo";
    users[0].senha_temporaria = true;
    assert.equal((await request(path, { bearer: token("tec-a", { mustChangePassword: true }) })).status, 403);
    users[0].senha_temporaria = false;
  }
  assert.ok(!consultas.includes("relatorio_campo_diario"));
});

test("relatorios compartilham CORS, preflight, cache e permissoes de escrita", async () => {
  for (const path of rotas) {
    assert.equal((await request(path, { bearer: token(), origin: "https://estranho.invalid" })).status, 403);
    const preflight = await request(path, { method: "OPTIONS", origin: "https://frontend.invalid" });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://frontend.invalid");
    const result = await request(path, { bearer: token(), origin: "https://frontend.invalid" });
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.equal((await request(path, { method: "POST", bearer: token("admin"), body: {} })).status, 403);
    assert.equal((await request(path, { method: "POST", bearer: token(), body: {} })).status, 400);
  }
});

test("ambos os aliases respeitam o limite geral de requisicoes", async () => {
  for (let i = 0; i < 120; i++) assert.equal((await request(rotas[i % 2])).status, 401);
  assert.equal((await request(rotas[0])).status, 429);
  assert.equal((await request(rotas[1])).status, 429);
});

test("falhas do banco e rede retornam 503 sem detalhes e com identificador no log", async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (value) => logs.push(value);
  try {
    for (const mode of ["banco", "rede"]) {
      falha = mode;
      for (const path of rotas) {
        const result = await request(path, { bearer: token() });
        assert.equal(result.status, 503);
        assert.match(result.data.erroId, /^[a-f0-9-]{36}$/);
        assert.ok(logs.some((entry) => JSON.parse(entry).erroId === result.data.erroId));
        assert.ok(!JSON.stringify(result.data).includes("segredo"));
        assert.equal(result.data.detalhes, undefined);
      }
    }
    assert.ok(!logs.join(" ").includes("segredo"));
  } finally { console.error = originalError; }
});
