const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");

Object.assign(process.env, {
  SUPABASE_URL: "https://idor.invalid",
  SUPABASE_SECRET_KEY: "sb_secret_synthetic",
  JWT_SECRET: "jwt-secret-synthetic-with-more-than-thirty-two-characters",
  TOTP_ENCRYPTION_KEY: "totp-encryption-synthetic-key-with-more-than-thirty-two-characters",
  IOT_API_KEY: "iot-synthetic",
  FRONTEND_ORIGIN: "https://frutlog.invalid",
  TRUSTED_PROXIES: "",
  SECURITY_MISSION_CODE: "SYNTHETIC-TEST",
});

const { criarToken } = require("../../api/session");
const app = require("../../src/server");
const originalFetch = global.fetch;
let server;
const org = "org-test";
const farm = "farm-test";
const plot = { id: "plot-test", codigo: "T-01", fazenda_id: farm, arquivado_em: null };
const users = [
  { id: "user-a", organizacao_id: org, matricula: "A001", nome_completo: "Pessoa A", perfil: "tecnico", status: "ativo", senha_hash: "hash-a", senha_temporaria: false },
  { id: "user-b", organizacao_id: org, matricula: "B001", nome_completo: "Pessoa B", perfil: "tecnico", status: "ativo", senha_hash: "hash-b", senha_temporaria: false },
];
const devices = [
  { id: "00000000-0000-4000-8000-00000000000a", organizacao_id: org, talhao_id: plot.id, id_externo: "DEVICE-A", status: "online", responsavel_usuario_id: "user-a" },
  { id: "00000000-0000-4000-8000-00000000000b", organizacao_id: org, talhao_id: plot.id, id_externo: "DEVICE-B", status: "online", responsavel_usuario_id: "user-b" },
];
const sensors = [
  { id: "10000000-0000-4000-8000-00000000000a", id_externo: "SENSOR-A", dispositivo_id: devices[0].id, codigo_metrica: "temperatura", unidade: "C", status: "ativo" },
  { id: "10000000-0000-4000-8000-00000000000b", id_externo: "SENSOR-B", dispositivo_id: devices[1].id, codigo_metrica: "temperatura", unidade: "C", status: "ativo" },
];
let inserts;

function hash(s) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `pbkdf2$210000$${salt}$${crypto.pbkdf2Sync(s, salt, 210000, 32, "sha256").toString("hex")}`;
}
const passwordHashes = new Map(users.map((u) => [u.id, hash(u.id)]));
function token(id) {
  const user = users.find((item) => item.id === id);
  return criarToken({ id, matricula: user.matricula, nome: user.nome_completo, perfil: user.perfil, mustChangePassword: false }, process.env.JWT_SECRET, passwordHashes.get(id));
}
function responseRows(rows, init) {
  return new Response(JSON.stringify(rows), { status: init.method === "POST" || init.method === "PATCH" ? 201 : 200 });
}
function parseIn(value) { return String(value || "").replace(/^in\.\(/, "").replace(/\)$/, "").split(",").filter(Boolean); }

before(async () => {
  global.fetch = async (raw, init = {}) => {
    const url = new URL(raw);
    const table = url.pathname.split("/").pop();
    const q = url.searchParams;
    let rows = [];
    if (table === "usuario") {
      rows = users.filter((user) => (!q.has("id") || q.get("id") === `eq.${user.id}`) && (!q.has("organizacao_id") || q.get("organizacao_id") === `eq.${user.organizacao_id}`));
      rows = rows.map((user) => ({ ...user, senha_hash: passwordHashes.get(user.id) }));
    } else if (table === "fazenda") {
      rows = q.get("organizacao_id") === `eq.${org}` ? [{ id: farm }] : [];
    } else if (table === "talhao") {
      const allowed = parseIn(q.get("fazenda_id"));
      rows = allowed.includes(farm) || q.get("codigo") === `eq.${plot.codigo}` ? [plot] : [];
    } else if (table === "dispositivo") {
      rows = devices.filter((device) => {
        const plotIds = parseIn(q.get("talhao_id"));
        const owner = q.get("responsavel_usuario_id");
        const id = q.get("id");
        return (!plotIds.length || plotIds.includes(device.talhao_id) || q.get("talhao_id") === `eq.${device.talhao_id}`) && (!owner || owner === `eq.${device.responsavel_usuario_id}`) && (!id || id === `eq.${device.id}`) && (!q.has("organizacao_id") || q.get("organizacao_id") === `eq.${device.organizacao_id}`);
      });
      if (init.method === "PATCH") for (const device of rows) Object.assign(device, JSON.parse(init.body));
    } else if (table === "sensor") {
      rows = sensors.filter((sensor) => {
        const deviceIds = parseIn(q.get("dispositivo_id"));
        const id = q.get("id");
        const external = q.get("id_externo");
        return (!deviceIds.length || deviceIds.includes(sensor.dispositivo_id)) && (!id || id === `eq.${sensor.id}`) && (!external || external === `eq.${sensor.id_externo}`);
      });
      if (init.method === "PATCH") for (const sensor of rows) Object.assign(sensor, JSON.parse(init.body));
    } else if (table === "v_ultima_leitura_sensor") {
      const ids = parseIn(q.get("sensor_id"));
      rows = sensors.filter((sensor) => ids.includes(sensor.id)).map((sensor) => ({ sensor_id: sensor.id, valor: 25, unidade: "C", coletado_em: "2026-11-20T12:00:00Z" }));
    } else if (table === "leitura_sensor") {
      const ids = parseIn(q.get("sensor_id"));
      rows = sensors.filter((sensor) => ids.includes(sensor.id)).map((sensor) => ({ sensor_id: sensor.id, valor: sensor.id === sensors[0].id ? 25 : 99, unidade: "C", qualidade: "valida", coletado_em: "2026-11-20T12:00:00Z" }));
    } else if (table === "v_telemetria_diaria_talhao") {
      const ids = parseIn(q.get("dispositivo_id"));
      rows = devices.filter((device) => ids.includes(device.id)).map((device) => ({ dispositivo_id: device.id, talhao_id: plot.id, codigo_metrica: "temperatura", dia: new Date().toISOString().slice(0, 10), valor_medio: device.id === devices[0].id ? 25 : 99, valor_minimo: device.id === devices[0].id ? 24 : 98, valor_maximo: device.id === devices[0].id ? 26 : 100, leituras_contabilizadas: 2 }));
    } else if (table === "inspecao" && init.method === "POST") {
      inserts.push(JSON.parse(init.body));
      rows = [inserts.at(-1)];
    }
    return responseRows(rows, init);
  };
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

beforeEach(() => { inserts = []; });
after(async () => { global.fetch = originalFetch; await new Promise((resolve) => server.close(resolve)); });

function request(method, path, bearer, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path: `/api${path}`, method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` } }, (res) => {
      let raw = "";
      res.on("data", (chunk) => raw += chunk);
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test("usuarios A e B na mesma organizacao veem apenas os dispositivos atribuidos a cada um", async () => {
  const a = await request("GET", "/sensores", token("user-a"));
  const b = await request("GET", "/sensores", token("user-b"));
  assert.equal(a.status, 200);
  assert.deepEqual(a.data.sensores.map((sensor) => sensor.sensor), ["SENSOR-A"]);
  assert.deepEqual(b.data.sensores.map((sensor) => sensor.sensor), ["SENSOR-B"]);
  assert.ok(!JSON.stringify(a.data).includes("SENSOR-B"));
  assert.ok(!JSON.stringify(b.data).includes("SENSOR-A"));
});

test("leituras brutas e agregadas tambem ficam limitadas aos dispositivos do usuario", async () => {
  const a = token("user-a");
  const b = token("user-b");
  const brutoA = await request("GET", "/telemetria/talhao/T-01", a);
  const brutoB = await request("GET", "/telemetria/talhao/T-01", b);
  assert.equal(brutoA.status, 200, JSON.stringify(brutoA.data));
  assert.equal(brutoB.status, 200, JSON.stringify(brutoB.data));
  assert.deepEqual(brutoA.data.metricas.temperatura.pontos.map((ponto) => ponto.valor), [25]);
  assert.deepEqual(brutoB.data.metricas.temperatura.pontos.map((ponto) => ponto.valor), [99]);
  const diarioA = await request("GET", "/telemetria/diaria", a);
  const diarioB = await request("GET", "/telemetria/diaria", b);
  assert.equal(diarioA.data.leituras[0].valor_medio, 25);
  assert.equal(diarioB.data.leituras[0].valor_medio, 99);
});

test("IDs de sensores de outra pessoa nao permitem vincular inspecao nem problema", async () => {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const log = console.warn;
  console.warn = () => {};
  try {
    const inspecao = await request("POST", "/inspecoes", token("user-a"), {
      talhao: plot.codigo, data: hoje, situacao: "Normal", sensor_id: sensors[1].id,
    });
    assert.equal(inspecao.status, 404);
    const problema = await request("POST", "/sensores/problemas", token("user-a"), {
      talhao: plot.codigo, data: hoje, problema: "Falha simulada", sensor: sensors[1].id_externo,
    });
    assert.equal(problema.status, 404);
    assert.equal(inserts.length, 0);
  } finally { console.warn = log; }
});

test("usuario altera o status do proprio sensor, mas nao acessa o sensor alheio", async () => {
  const log = console.warn;
  console.warn = () => {};
  try {
    const proprio = await request("PATCH", `/sensores/${sensors[0].id}`, token("user-a"), { status: "inativo" });
    assert.equal(proprio.status, 200);
    assert.equal(sensors[0].status, "inativo");

    const alheio = await request("PATCH", `/sensores/${sensors[1].id}`, token("user-a"), { status: "inativo" });
    assert.equal(alheio.status, 404);
    assert.equal(sensors[1].status, "ativo");
  } finally { console.warn = log; }
});
