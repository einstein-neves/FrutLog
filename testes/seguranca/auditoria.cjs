// Reproducoes locais dos achados. Nao acessa banco, credenciais ou servicos reais.
// Mantem evidencias dos achados restantes e verifica as correcoes de sessao/IP.
const assert = require("node:assert/strict");
process.env.SUPABASE_URL = "https://auditoria.invalid";
process.env.SUPABASE_SECRET_KEY = "sb_secret_auditoria_ficticia";
process.env.JWT_SECRET = "segredo-ficticio-de-auditoria-com-mais-de-32-caracteres";
process.env.IOT_API_KEY = "iot-ficticio";
process.env.FRONTEND_ORIGIN = "https://auditoria.invalid";
process.env.NODE_ENV = "production";
const { criarToken } = require("../../api/session");
const handler = require("../../api/[...route]");
const senhaHash = "hash-ficticio-auditoria";
const ator = { id: "usuario-org-A", organizacao_id: "org-A", perfil: "administrador", status: "ativo", senha_hash: senhaHash, senha_temporaria: false };
let banco;
const consultas = [];
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  consultas.push({ recurso: u.pathname.split("/").pop(), query: u.search, metodo: init.method });
  return banco(u, init);
};
const json = (dados, status = 200) => new Response(JSON.stringify(dados), { status });
function request(method, path, { perfil = "admin", temporaria = false, body, ip = "auditoria" } = {}) {
  const token = criarToken({ id: "usuario-org-A", perfil, mustChangePassword: temporaria }, process.env.JWT_SECRET, senhaHash);
  return new Promise((resolve, reject) => {
    const req = {
      method, url: `/api${path}`, headers: { authorization: `Bearer ${token}`, "x-forwarded-for": ip },
      socket: { remoteAddress: "127.0.0.1" },
      on(event, fn) {
        if (event === "data" && body) fn(Buffer.from(JSON.stringify(body)));
        if (event === "end") fn();
        return this;
      },
    };
    const res = { setHeader() {}, end(raw) { resolve({ status: this.statusCode, data: JSON.parse(raw) }); } };
    handler(req, res).catch(reject);
  });
}
(async () => {
  banco = (u) => json(u.searchParams.get("id") === "eq.usuario-org-A" ? [ator] : u.searchParams.has("organizacao_id") ? [] : [{ id: "usuario-org-B", nome_completo: "Registro de outra organizacao", perfil: "administrador", status: "ativo" }]);
  let r = await request("GET", "/funcionarios");
  assert.equal(r.status, 200);
  assert.equal(r.data.usuarios.length, 0);
  assert.ok(consultas.at(-1).query.includes("organizacao_id"));
  console.log("CORRIGIDO: GET funcionarios filtra a organizacao da sessao.");

  consultas.length = 0;
  // Banco simula usuario atual inativo, caso seja consultado pelo ID.
  banco = (u) => json(u.searchParams.has("id") ? [{ ...ator, status: "inativo" }] : [{ id: "outro", perfil: "tecnico" }]);
  r = await request("GET", "/funcionarios");
  assert.equal(r.status, 401);
  assert.ok(consultas.some((c) => c.query.includes("id=eq.usuario-org-A")));
  console.log("CORRIGIDO: conta bloqueada perde acesso nas rotas GET.");

  consultas.length = 0;
  banco = (u, init) => {
    if (init.method === "DELETE") return json([]);
    if (u.searchParams.get("id") === "eq.usuario-org-A") return json([{ ...ator, organizacao_id: "org-A" }]);
    if (u.searchParams.has("organizacao_id")) return json([]);
    return json([{ id: "usuario-org-B", perfil: "tecnico", status: "ativo", organizacao_id: "org-B" }]);
  };
  r = await request("DELETE", "/funcionarios/usuario-org-B");
  assert.equal(r.status, 404);
  assert.ok(!consultas.some((c) => c.metodo === "DELETE"));
  console.log("CORRIGIDO: administrador nao exclui funcionario de outra organizacao.");

  banco = () => json([{ ...ator, senha_temporaria: true }]);
  r = await request("GET", "/chatbot/contexto", { temporaria: true });
  assert.equal(r.status, 403);
  const protegida = await request("GET", "/talhoes", { temporaria: true });
  assert.equal(protegida.status, 403);
  console.log("CORRIGIDO: contexto do chatbot respeita bloqueio de senha temporaria.");

  banco = () => json([{ ...ator, senha_hash: "hash-alterado-pelo-reset", senha_temporaria: true }]);
  r = await request("POST", "/plantios", { body: {} });
  assert.equal(r.status, 401);
  console.log("CORRIGIDO: token anterior ao reset e revogado nas rotas de escrita.");

  banco = () => json([]);
  const login = { matricula: "ficticio", senha: "12345678" };
  for (let i = 0; i < 10; i++) await request("POST", "/login", { body: login, ip: "fixo" });
  assert.equal((await request("POST", "/login", { body: login, ip: "fixo" })).status, 429);
  assert.equal((await request("POST", "/login", { body: login, ip: "forjado" })).status, 429);
  console.log("CORRIGIDO: alterar X-Forwarded-For nao contorna limite do handler direto.");

  banco = (u) => u.pathname.endsWith("/usuario") ? json([ator]) : json({ message: "erro-interno-simulado", details: "estrutura-interna-simulada" }, 500);
  const originalError = console.error;
  console.error = () => {};
  try { r = await request("GET", "/alertas"); } finally { console.error = originalError; }
  assert.equal(r.status, 500);
  assert.match(r.data.mensagem, /estrutura-interna-simulada/);
  console.log("CONFIRMADO: detalhes do banco sao devolvidos mesmo em producao.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
