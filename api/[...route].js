const crypto = require("crypto");

const ROLES = ["engenheiro", "tecnico", "admin", "administrador"];
const TYPES = ["temperatura", "umidadeSolo", "umidadeAr", "chuva"];
const required = ["SUPABASE_URL", "JWT_SECRET", "IOT_API_KEY", "FRONTEND_ORIGIN"];

function config() {
  const missing = required.filter((key) => !process.env[key]);
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) missing.push("SUPABASE_SECRET_KEY");
  if (missing.length) throw new Error(`Configuracao ausente: ${missing.join(", ")}`);
  if (process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET inseguro.");
  const origins = process.env.FRONTEND_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean);
  origins.push(`http://localhost:${process.env.PORT || 3000}`, `http://127.0.0.1:${process.env.PORT || 3000}`);
  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    key,
    jwt: process.env.JWT_SECRET,
    iot: process.env.IOT_API_KEY,
    thingSpeak: {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || "",
      readApiKey: process.env.THINGSPEAK_READ_API_KEY || "",
      fields: {
        temperatura: Number(process.env.THINGSPEAK_FIELD_TEMPERATURE) || 1,
        umidadeAr: Number(process.env.THINGSPEAK_FIELD_HUMIDITY) || 2,
        umidadeSolo: Number(process.env.THINGSPEAK_FIELD_SOIL_HUMIDITY) || 3,
        chuva: Number(process.env.THINGSPEAK_FIELD_RAINFALL) || 4
      }
    },
    origins: [...new Set(origins)]
  };
}

function originFor(req, c) {
  const origin = req.headers.origin;
  return origin && c.origins.includes(origin) ? origin : undefined;
}

function reply(res, status, data, origin) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.end(JSON.stringify(data));
}

function parseBody(req, maximum = 16384) {
  return new Promise((resolve, reject) => {
    let raw = "", size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximum) {
        reject(new Error("Corpo muito grande."));
        req.destroy();
      } else raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");

function createToken(user, secret) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({
    sub: user.id,
    matricula: user.matricula,
    nome: user.nome,
    perfil: user.perfil,
    mustChangePassword: Boolean(user.mustChangePassword),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 28800
  });
  return `${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}

function authenticated(req, secret) {
  try {
    const [h, p, s] = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").split(".");
    if (!h || !p || !s) return null;
    const expected = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest();
    const supplied = Buffer.from(s, "base64url");
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    const user = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    const normalPerfil = user.perfil === "administrador" ? "admin" : user.perfil;
    return user.exp > Date.now() / 1000 && ["engenheiro", "tecnico", "admin"].includes(normalPerfil)
      ? { ...user, perfil: normalPerfil, mustChangePassword: Boolean(user.mustChangePassword) }
      : null;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const rounds = 210000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, rounds, 32, "sha256").toString("hex");
  return `pbkdf2$${rounds}$${salt}$${hash}`;
}

function passwordOk(password, stored) {
  const [kind, rounds, salt, hash] = String(stored || "").split("$");
  if (kind !== "pbkdf2" || !/^\d+$/.test(rounds) || !salt || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const actual = crypto.pbkdf2Sync(password, salt, Number(rounds), 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(hash));
}

async function db(c, table, method = "GET", data, query = "") {
  const response = await fetch(`${c.url}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: c.key,
      ...(c.key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${c.key}` }),
      "Content-Type": "application/json",
      Prefer: method === "POST" || method === "PATCH" ? "return=representation,resolution=merge-duplicates" : ""
    },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody.message || errBody.details || errBody.hint || `HTTP ${response.status}`;
    console.error(`PostgREST [${method} ${table}${query}]:`, msg);
    throw new Error(`Falha no banco de dados: ${msg}`);
  }
  return response.status === 204 ? [] : response.json();
}

async function farmsForOrganization(c) {
  const organization = (await db(c, "organizacao", "GET", undefined, "?select=id&order=criado_em&limit=1"))[0];
  if (!organization) return [];
  return db(
    c,
    "fazenda",
    "GET",
    undefined,
    `?organizacao_id=eq.${encodeURIComponent(organization.id)}&select=id&order=criado_em`
  );
}

const hits = new Map();
function rateLimit(req, maximum, scope) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const state = hits.get(key) || { at: now, count: 0 };
  if (now - state.at > 60000) {
    state.at = now;
    state.count = 0;
  }
  state.count++;
  hits.set(key, state);
  return state.count <= maximum;
}

function text(v, max = 160) {
  return typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;
}

function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return null;
  const parsed = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v ? null : v;
}

function telemetryValid(d) {
  return (
    text(d.sensorId, 80) &&
    text(d.talhao, 40) &&
    TYPES.includes(d.tipo) &&
    Number.isFinite(Number(d.valor)) &&
    Math.abs(Number(d.valor)) <= 1000000 &&
    (!d.timestamp || !Number.isNaN(Date.parse(d.timestamp)))
  );
}

module.exports = async (req, res) => {
  let c;
  try {
    c = config();
  } catch (error) {
    console.error(error.message);
    return reply(res, 503, { mensagem: "API ainda nao configurada." });
  }

  const origin = originFor(req, c);
  if (req.headers.origin && !origin) return reply(res, 403, { mensagem: "Origem nao permitida." });
  if (req.method === "OPTIONS") {
    if (!origin) return reply(res, 403, { mensagem: "Origem nao permitida." });
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-IoT-Key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Max-Age": "600",
      Vary: "Origin"
    });
    return res.end();
  }

  const route = new URL(req.url, "http://localhost").pathname.replace(/^\/api/, "") || "/";
  const isLoginRequest = req.method === "POST" && route === "/login";
  if (!rateLimit(req, isLoginRequest ? 10 : 120, isLoginRequest ? "login" : "api")) {
    return reply(res, 429, { mensagem: "Muitas requisicoes." }, origin);
  }

  try {
    // 1. Health check
    if (req.method === "GET" && route === "/health") {
      try {
        await db(c, "organizacao", "GET", undefined, "?select=id&limit=1");
      } catch (error) {
        console.error("Health check: organizacao unavailable:", error.message);
        return reply(
          res,
          503,
          {
            sucesso: false,
            banco: false,
            esquema: false,
            mensagem: "Nao foi possivel consultar public.organizacao. Verifique SUPABASE_URL, a chave de servico e schema.sql."
          },
          origin
        );
      }

      try {
        await db(c, "usuario", "GET", undefined, "?select=id&limit=1");
        return reply(res, 200, { sucesso: true, banco: true, esquema: true }, origin);
      } catch (error) {
        console.error("Health check: usuario unavailable:", error.message);
        return reply(
          res,
          503,
          {
            sucesso: false,
            banco: true,
            esquema: false,
            mensagem: "Banco conectado, mas public.usuario nao esta disponivel na API do Supabase. Confira supabase/schema_oficial_atualizado.sql e recarregue o cache PostgREST."
          },
          origin
        );
      }
    }

    // 2. Autenticação e Login
    if (req.method === "POST" && route === "/login") {
      const d = await parseBody(req);
      const matricula = text(d.matricula, 40);
      const senha = typeof d.senha === "string" ? d.senha : "";
      if (!matricula || senha.length < 8 || senha.length > 10) {
        return reply(res, 401, { mensagem: "Matricula ou senha invalida." }, origin);
      }

      const users = await db(
        c,
        "usuario",
        "GET",
        undefined,
        `?matricula=eq.${encodeURIComponent(matricula)}&select=id,matricula,nome_completo,perfil,senha_hash,status,senha_temporaria&limit=1`
      );
      const user = users[0];
      if (!user || user.status !== "ativo" || !passwordOk(senha, user.senha_hash)) {
        return reply(res, 401, { mensagem: "Matricula ou senha invalida." }, origin);
      }

      const safe = {
        id: user.id,
        matricula: user.matricula,
        nome: user.nome_completo,
        perfil: user.perfil === "administrador" ? "admin" : user.perfil,
        mustChangePassword: Boolean(user.senha_temporaria)
      };
      return reply(res, 200, {
        sucesso: true,
        usuario: safe,
        token: createToken(safe, c.jwt)
      }, origin);
    }

    // 3. Ingestão de Telemetria IoT
    if (req.method === "POST" && route === "/iot/telemetria") {
      const supplied = Buffer.from(String(req.headers["x-iot-key"] || ""));
      const expected = Buffer.from(c.iot);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        return reply(res, 401, { mensagem: "Credencial IoT invalida." }, origin);
      }

      const d = await parseBody(req);
      if (!telemetryValid(d)) return reply(res, 400, { mensagem: "Telemetria invalida." }, origin);

      const device = (
        await db(c, "dispositivo", "GET", undefined, `?id_externo=eq.${encodeURIComponent(d.sensorId)}&status=neq.desativado&select=id,talhao_id&limit=1`)
      )[0];
      if (!device) return reply(res, 403, { mensagem: "Dispositivo nao autorizado." }, origin);

      const plot = (await db(c, "talhao", "GET", undefined, `?id=eq.${device.talhao_id}&select=codigo&limit=1`))[0];
      if (!plot || plot.codigo !== d.talhao) return reply(res, 403, { mensagem: "Dispositivo nao pertence ao talhao." }, origin);

      const sensor = (
        await db(
          c,
          "sensor",
          "GET",
          undefined,
          `?dispositivo_id=eq.${device.id}&codigo_metrica=eq.${encodeURIComponent(d.tipo)}&status=eq.ativo&select=id,unidade&limit=1`
        )
      )[0];
      if (!sensor) return reply(res, 403, { mensagem: "Sensor ou metrica nao autorizada." }, origin);

      const when = d.timestamp || new Date().toISOString();
      await db(c, "leitura_sensor", "POST", {
        sensor_id: sensor.id,
        dispositivo_id: device.id,
        coletado_em: when,
        valor: Number(d.valor),
        unidade: text(d.unidade, 20) || sensor.unidade,
        carga_bruta: d
      });
      await db(c, `dispositivo?id=eq.${device.id}`, "PATCH", { ultimo_sinal_em: when, status: "online" });
      return reply(res, 201, { sucesso: true }, origin);
    }

    // Validação de Sessão para Rotas Protegidas
    const user = authenticated(req, c.jwt);
    if (!user) return reply(res, 401, { mensagem: "Nao autorizado." }, origin);

    if (req.method === "GET" && route === "/chatbot/contexto") {
      const farms = await farmsForOrganization(c);
      if (!farms.length) {
        return reply(res, 200, { consultado_em: new Date().toISOString(), ocorrencias: [], sensores: [] }, origin);
      }
      const plots = await db(
        c,
        "talhao",
        "GET",
        undefined,
        `?fazenda_id=in.(${farms.map((farm) => farm.id).join(",")})&select=id,codigo`
      );
      if (!plots.length) {
        return reply(res, 200, { consultado_em: new Date().toISOString(), ocorrencias: [], sensores: [] }, origin);
      }
      const plotIds = plots.map((plot) => plot.id);
      const [occurrences, devices] = await Promise.all([
        db(
          c,
          "ocorrencia",
          "GET",
          undefined,
          `?talhao_id=in.(${plotIds.join(",")})&select=talhao_id,tipo,observacao,registrado_em&order=registrado_em.desc&limit=10`
        ),
        db(
          c,
          "dispositivo",
          "GET",
          undefined,
          `?talhao_id=in.(${plotIds.join(",")})&select=id,id_externo,talhao_id,status,ultimo_sinal_em`
        ),
      ]);
      const deviceIds = devices.map((device) => device.id);
      const sensors = deviceIds.length
        ? await db(
          c,
          "sensor",
          "GET",
          undefined,
          `?dispositivo_id=in.(${deviceIds.join(",")})&select=id,id_externo,dispositivo_id,codigo_metrica,unidade,status`
        )
        : [];
      const sensorIds = sensors.map((sensor) => sensor.id);
      const readings = sensorIds.length
        ? await db(
          c,
          "v_ultima_leitura_sensor",
          "GET",
          undefined,
          `?sensor_id=in.(${sensorIds.join(",")})&select=sensor_id,valor,unidade,coletado_em`
        )
        : [];
      const plotById = new Map(plots.map((plot) => [plot.id, plot.codigo]));
      const deviceById = new Map(devices.map((device) => [device.id, device]));
      const readingBySensor = new Map(readings.map((reading) => [reading.sensor_id, reading]));
      const recentOccurrences = occurrences.map((occurrence) => ({
        talhao: plotById.get(occurrence.talhao_id) || null,
        tipo: occurrence.tipo,
        observacao: occurrence.observacao,
        data: occurrence.registrado_em,
      }));
      const sensorStatuses = sensors.map((sensor) => {
        const device = deviceById.get(sensor.dispositivo_id);
        const reading = readingBySensor.get(sensor.id);
        const status = sensor.status !== "ativo"
          ? "Inativo"
          : device?.status === "online"
            ? "Online"
            : device?.status === "manutencao"
              ? "Manutencao"
              : device?.status === "desativado"
                ? "Desativado"
                : "Offline";
        return {
          sensor: sensor.id_externo,
          talhao: device ? plotById.get(device.talhao_id) || null : null,
          metrica: sensor.codigo_metrica,
          unidade: sensor.unidade,
          status,
          leitura: reading ? `${reading.valor} ${reading.unidade || sensor.unidade}` : "Sem leitura",
          coletado_em: reading?.coletado_em || device?.ultimo_sinal_em || null,
        };
      });

      return reply(res, 200, {
        consultado_em: new Date().toISOString(),
        ocorrencias: recentOccurrences,
        sensores: sensorStatuses,
      }, origin);
    }

    if (route === "/alterar-senha" && req.method === "POST") {
      const d = await parseBody(req);
      if (
        typeof d.senhaAtual !== "string" ||
        d.senhaAtual.length < 8 ||
        d.senhaAtual.length > 10 ||
        typeof d.novaSenha !== "string" ||
        d.novaSenha.length < 8 ||
        d.novaSenha.length > 10 ||
        d.novaSenha === d.senhaAtual
      ) {
        return reply(res, 400, { mensagem: "Informe a senha atual e uma senha nova diferente, ambas entre 8 e 10 caracteres." }, origin);
      }

      const current = (await db(
        c,
        "usuario",
        "GET",
        undefined,
        `?id=eq.${encodeURIComponent(user.sub)}&select=id,matricula,nome_completo,perfil,senha_hash,status&limit=1`
      ))[0];
      if (!current || current.status !== "ativo" || !passwordOk(d.senhaAtual, current.senha_hash)) {
        return reply(res, 401, { mensagem: "Senha atual invalida." }, origin);
      }

      await db(c, `usuario?id=eq.${encodeURIComponent(user.sub)}`, "PATCH", {
        senha_hash: hashPassword(d.novaSenha),
        senha_temporaria: false
      });

      const updatedUser = {
        id: current.id,
        matricula: current.matricula,
        nome: current.nome_completo,
        perfil: current.perfil === "administrador" ? "admin" : current.perfil,
        mustChangePassword: false
      };
      return reply(res, 200, {
        sucesso: true,
        usuario: updatedUser,
        token: createToken(updatedUser, c.jwt)
      }, origin);
    }

    if (user.mustChangePassword) {
      return reply(res, 403, {
        mensagem: "Altere sua senha provisoria antes de continuar.",
        codigo: "SENHA_PROVISORIA"
      }, origin);
    }

    if (req.method === "GET" && route === "/telemetria/thingspeak") {
      if (!c.thingSpeak.channelId) {
        return reply(res, 503, {
          mensagem: "ThingSpeak nao configurado. Defina THINGSPEAK_CHANNEL_ID no servidor.",
          codigo: "THINGSPEAK_NAO_CONFIGURADO"
        }, origin);
      }

      const feedUrl = new URL(
        `https://api.thingspeak.com/channels/${encodeURIComponent(c.thingSpeak.channelId)}/feeds.json`
      );
      feedUrl.searchParams.set("results", "60");
      if (c.thingSpeak.readApiKey) feedUrl.searchParams.set("api_key", c.thingSpeak.readApiKey);

      let feedResponse;
      try {
        feedResponse = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
      } catch (error) {
        console.error("Falha ao consultar ThingSpeak:", error.message);
        return reply(res, 502, { mensagem: "ThingSpeak indisponivel no momento." }, origin);
      }
      if (!feedResponse.ok) {
        console.error(`ThingSpeak respondeu HTTP ${feedResponse.status}.`);
        return reply(res, 502, { mensagem: "ThingSpeak recusou a consulta do canal configurado." }, origin);
      }
      const feed = await feedResponse.json();
      if (!Array.isArray(feed.feeds)) {
        return reply(res, 502, { mensagem: "Resposta invalida do canal ThingSpeak." }, origin);
      }
      return reply(res, 200, {
        channel: {
          id: feed.channel?.id,
          name: feed.channel?.name || "Canal ThingSpeak"
        },
        fields: c.thingSpeak.fields,
        feeds: feed.feeds.map((item) => ({
          created_at: item.created_at,
          values: Object.fromEntries(
            Object.entries(c.thingSpeak.fields).map(([metric, field]) => [
              metric,
              item[`field${field}`] === null || item[`field${field}`] === undefined
                ? null
                : Number(item[`field${field}`])
            ])
          )
        }))
      }, origin);
    }

    if (req.method === "GET" && route === "/colheitas/anual") {
      if (!["engenheiro", "admin"].includes(user.perfil)) {
        return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      }
      const harvests = await db(
        c,
        "colheita",
        "GET",
        undefined,
        "?select=ano,quantidade,unidade&order=ano&limit=10000"
      );
      const annual = new Map();
      harvests.forEach((row) => {
        const key = `${row.ano}:${row.unidade}`;
        const item = annual.get(key) || { ano: row.ano, unidade: row.unidade, quantidade: 0 };
        item.quantidade += Number(row.quantidade);
        annual.set(key, item);
      });
      return reply(
        res,
        200,
        { colheitas: [...annual.values()].sort((a, b) => a.ano - b.ano || a.unidade.localeCompare(b.unidade)) },
        origin
      );
    }

    if (req.method === "GET" && route === "/telemetria/diaria") {
      const agora = new Date();
      const desde = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const inicioHistorico = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 11, 1))
        .toISOString()
        .slice(0, 10);
      const [plots, readings] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(
          c,
          "v_telemetria_diaria_talhao",
          "GET",
          undefined,
          `?dia=gte.${inicioHistorico}&select=talhao_id,codigo_metrica,dia,valor_medio,valor_minimo,valor_maximo,leituras_contabilizadas&order=dia.desc&limit=10000`
        )
      ]);
      const plotCodes = new Map(plots.map((plot) => [plot.id, plot.codigo]));
      const monthly = new Map();
      readings.forEach((reading) => {
        const mes = reading.dia.slice(0, 7);
        const key = `${reading.talhao_id}:${reading.codigo_metrica}:${mes}`;
        const quantidade = Number(reading.leituras_contabilizadas);
        const item = monthly.get(key) || {
          talhao_id: reading.talhao_id,
          talhao: plotCodes.get(reading.talhao_id) || null,
          codigo_metrica: reading.codigo_metrica,
          mes,
          somaPonderada: 0,
          leituras_contabilizadas: 0,
          valor_minimo: Number(reading.valor_minimo),
          valor_maximo: Number(reading.valor_maximo)
        };
        item.somaPonderada += Number(reading.valor_medio) * quantidade;
        item.leituras_contabilizadas += quantidade;
        item.valor_minimo = Math.min(item.valor_minimo, Number(reading.valor_minimo));
        item.valor_maximo = Math.max(item.valor_maximo, Number(reading.valor_maximo));
        monthly.set(key, item);
      });
      const leiaDiaria = readings
        .filter((reading) => reading.dia >= desde)
        .map((reading) => ({
          ...reading,
          talhao: plotCodes.get(reading.talhao_id) || null
        }));
      const leiaMensal = [...monthly.values()]
        .map((item) => ({
          ...item,
          valor_medio: Number((item.somaPonderada / item.leituras_contabilizadas).toFixed(2))
        }))
        .sort((a, b) => b.mes.localeCompare(a.mes) || (a.talhao || "").localeCompare(b.talhao || "") || a.codigo_metrica.localeCompare(b.codigo_metrica));
      return reply(res, 200, { desde, leituras: leiaDiaria, mensal: leiaMensal }, origin);
    }

    if (req.method === "POST" && route === "/colheitas") {
      if (!["engenheiro", "admin"].includes(user.perfil)) {
        return reply(res, 403, { mensagem: "Somente Engenharia e Administracao podem registrar colheitas." }, origin);
      }
      const d = await parseBody(req);
      const colhidoEm = date(d.colhidoEm);
      const quantidade = Number(d.quantidade);
      if (
        !text(d.talhao, 40) ||
        !colhidoEm ||
        !Number.isFinite(quantidade) ||
        quantidade <= 0 ||
        !["kg", "t", "sc", "cx"].includes(d.unidade)
      ) {
        return reply(res, 400, { mensagem: "Informe talhao, data, quantidade positiva e unidade valida." }, origin);
      }
      const plot = (await db(
        c,
        "talhao",
        "GET",
        undefined,
        `?codigo=eq.${encodeURIComponent(d.talhao)}&select=id&limit=1`
      ))[0];
      if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);

      const created = await db(c, "colheita", "POST", {
        ciclo_cultura_id: (await db(
          c,
          "ciclo_cultura",
          "GET",
          undefined,
          `?talhao_id=eq.${encodeURIComponent(plot.id)}&status=eq.ativo&select=id&order=plantado_em.desc&limit=1`
        ))[0]?.id || null,
        talhao_id: plot.id,
        colhido_em: colhidoEm,
        quantidade,
        unidade: d.unidade,
        ano: Number(colhidoEm.slice(0, 4)),
        registrado_por: user.sub
      });
      const harvest = Array.isArray(created) ? created[0] : created;
      if (!harvest?.id) {
        throw new Error("O banco nao confirmou a gravacao da colheita. Atualize o esquema e tente novamente.");
      }
      return reply(res, 201, { sucesso: true, colheita: harvest }, origin);
    }

    const reportMatch = route.match(/^\/relatorios-diarios(?:\/([^/]+))?$/);
    if (reportMatch) {
      const reportId = reportMatch[1] ? decodeURIComponent(reportMatch[1]) : null;

      if (req.method === "GET" && !reportId) {
        if (!["engenheiro", "admin"].includes(user.perfil)) {
          return reply(res, 403, { mensagem: "Apenas Engenharia e Administracao podem consultar relatorios recebidos." }, origin);
        }
        const reports = await db(
          c,
          "relatorio_campo_diario",
          "GET",
          undefined,
          "?select=id,tecnico_nome,data_relatorio,conteudo,status,criado_em,atualizado_em&order=data_relatorio.desc,criado_em.desc&limit=500"
        );
        return reply(res, 200, { relatorios: reports }, origin);
      }

      if (req.method === "POST" && !reportId) {
        if (user.perfil !== "tecnico") return reply(res, 403, { mensagem: "Somente o Tecnico pode enviar relatorios diarios." }, origin);
        const d = await parseBody(req);
        const dataRelatorio = date(d.data);
        const conteudo = text(d.conteudo, 6000);
        if (!dataRelatorio || !conteudo) {
          return reply(res, 400, { mensagem: "Informe uma data valida e um relatorio de campo (ate 6000 caracteres)." }, origin);
        }

        const existente = (await db(
          c,
          "relatorio_campo_diario",
          "GET",
          undefined,
          `?usuario_id=eq.${encodeURIComponent(user.sub)}&data_relatorio=eq.${dataRelatorio}&select=id&limit=1`
        ))[0];
        if (existente) return reply(res, 409, { mensagem: "Ja existe um relatorio enviado para esta data." }, origin);

        const created = await db(c, "relatorio_campo_diario", "POST", {
          usuario_id: user.sub,
          tecnico_nome: text(user.nome, 255) || user.matricula,
          data_relatorio: dataRelatorio,
          conteudo,
          status: "enviado"
        });
        const report = Array.isArray(created) ? created[0] : created;
        return reply(res, 201, { sucesso: true, relatorio: report }, origin);
      }

      if (req.method === "PATCH" && reportId) {
        if (!["engenheiro", "admin"].includes(user.perfil)) {
          return reply(res, 403, { mensagem: "Apenas Engenharia e Administracao podem acompanhar relatorios." }, origin);
        }
        const d = await parseBody(req);
        if (!["em_analise", "concluido"].includes(d.status)) {
          return reply(res, 400, { mensagem: "Status de acompanhamento invalido." }, origin);
        }
        const report = (await db(
          c,
          "relatorio_campo_diario",
          "GET",
          undefined,
          `?id=eq.${encodeURIComponent(reportId)}&select=id&limit=1`
        ))[0];
        if (!report) return reply(res, 404, { mensagem: "Relatorio nao encontrado." }, origin);
        await db(c, `relatorio_campo_diario?id=eq.${encodeURIComponent(reportId)}`, "PATCH", { status: d.status });
        return reply(res, 200, { sucesso: true }, origin);
      }

      return reply(res, 405, { mensagem: "Metodo nao permitido para esta rota." }, origin);
    }

    // 4. Rotas Granulares: Talhões
    if (req.method === "GET" && route === "/talhoes") {
      const farms = await farmsForOrganization(c);
      if (!farms.length) return reply(res, 503, { mensagem: "Fazenda nao configurada." }, origin);
      const plots = await db(
        c,
        "talhao",
        "GET",
        undefined,
        `?fazenda_id=in.(${farms.map((farm) => farm.id).join(",")})&select=id,codigo,nome,area_hectares,coordenadas&order=codigo`
      );
      return reply(res, 200, { talhoes: plots }, origin);
    }

    if (req.method === "PUT" && route === "/talhoes/geometrias") {
      if (user.perfil !== "engenheiro") return reply(res, 403, { mensagem: "Somente o Engenheiro pode alterar geometrias e areas dos talhoes." }, origin);
      const d = await parseBody(req, 1048576);
      if (!Array.isArray(d.talhoes) || d.talhoes.length > 500 || !Array.isArray(d.removidos)) {
        return reply(res, 400, { mensagem: "Colecao de talhoes invalida." }, origin);
      }

      const codigos = new Set();
      for (const feature of d.talhoes) {
        const codigo = text(feature?.properties?.codigo, 40);
        const areaTexto = feature?.properties?.area_hectares ?? feature?.properties?.area;
        const area = Number(String(areaTexto ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
        const pontos = feature?.geometry?.type === "Polygon" ? feature.geometry.coordinates?.[0] : null;
        if (
          !codigo ||
          codigos.has(codigo) ||
          !Number.isFinite(area) ||
          area <= 0 ||
          area > 1000000 ||
          !Array.isArray(pontos) ||
          pontos.length < 4 ||
          pontos.length > 1001
        ) {
          return reply(res, 400, { mensagem: `Geometria ou area invalida para o talhao ${codigo || "(sem codigo)"}.` }, origin);
        }
        codigos.add(codigo);
        for (const ponto of pontos) {
          if (
            !Array.isArray(ponto) ||
            ponto.length !== 2 ||
            !ponto.every(Number.isFinite) ||
            ponto[0] < 0 || ponto[0] > 500 ||
            ponto[1] < 0 || ponto[1] > 400
          ) {
            return reply(res, 400, { mensagem: `Coordenadas invalidas para o talhao ${codigo}.` }, origin);
          }
        }
        if (pontos[0][0] !== pontos[pontos.length - 1][0] || pontos[0][1] !== pontos[pontos.length - 1][1]) {
          return reply(res, 400, { mensagem: `O contorno do talhao ${codigo} deve ser fechado.` }, origin);
        }
        feature.properties.codigo = codigo;
        feature.properties.area_hectares = area;
      }

      const removidos = d.removidos.map((codigo) => text(codigo, 40));
      if (removidos.some((codigo) => !codigo || codigos.has(codigo)) || new Set(removidos).size !== removidos.length) {
        return reply(res, 400, { mensagem: "Lista de talhoes removidos invalida." }, origin);
      }

      const farms = await farmsForOrganization(c);
      if (!farms.length) return reply(res, 503, { mensagem: "Fazenda nao configurada." }, origin);

      const candidateCodes = [...new Set([
        ...d.talhoes.map((feature) => feature.properties.codigo),
        ...removidos
      ])];
      const existingPlots = candidateCodes.length
        ? await db(
          c,
          "talhao",
          "GET",
          undefined,
          `?fazenda_id=in.(${farms.map((farm) => farm.id).join(",")})&codigo=in.(${candidateCodes.map(encodeURIComponent).join(",")})&select=id,codigo,fazenda_id`
        )
        : [];
      const farmIds = new Set(existingPlots.map((plot) => plot.fazenda_id));
      if (farmIds.size > 1) {
        return reply(
          res,
          409,
          { mensagem: "Os talhoes enviados pertencem a mais de uma fazenda. Edite e salve uma fazenda por vez." },
          origin
        );
      }
      const farmId = farmIds.values().next().value || farms[0].id;
      const farm = farms.find((item) => item.id === farmId);

      const result = await db(c, "rpc/salvar_geometrias_talhoes", "POST", {
        p_fazenda_id: farm.id,
        p_features: d.talhoes,
        p_removidos: removidos
      });
      if (result?.erro) return reply(res, 409, { mensagem: result.erro }, origin);
      const persistedPlots = await db(
        c,
        "talhao",
        "GET",
        undefined,
        `?fazenda_id=eq.${encodeURIComponent(farm.id)}&select=id,codigo,nome,area_hectares,coordenadas&order=codigo`
      );
      const persistedByCode = new Map(persistedPlots.map((plot) => [plot.codigo, plot]));
      const geometryConfirmed = d.talhoes.every((feature) => {
        const saved = persistedByCode.get(feature.properties.codigo);
        return saved && JSON.stringify(saved.coordenadas) === JSON.stringify(feature.geometry.coordinates[0]);
      });
      const removalsConfirmed = removidos.every((codigo) => !persistedByCode.has(codigo));
      if (!geometryConfirmed || !removalsConfirmed) {
        return reply(
          res,
          502,
          { mensagem: "O banco nao confirmou todas as geometrias. As alteracoes nao foram consideradas salvas; atualize os dados e tente novamente." },
          origin
        );
      }
      return reply(res, 200, { sucesso: true, talhoes: persistedPlots }, origin);
    }

    // 5. Rotas Granulares: Sensores e Última Leitura
    if (req.method === "GET" && route === "/sensores") {
      const [plots, devices, sensors, readings] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(c, "dispositivo", "GET", undefined, "?select=id,id_externo,talhao_id,status,ultimo_sinal_em"),
        db(c, "sensor", "GET", undefined, "?select=id,id_externo,dispositivo_id,codigo_metrica,unidade,status"),
        db(c, "v_ultima_leitura_sensor", "GET", undefined, "?select=*&limit=500")
      ]);
      const plotMap = new Map(plots.map((p) => [p.id, p.codigo]));
      const deviceById = new Map(devices.map((d) => [d.id, d]));
      const readingBySensor = new Map(readings.map((r) => [r.sensor_id, r]));

      const sensorRows = sensors.map((s) => {
        const d = deviceById.get(s.dispositivo_id);
        const r = readingBySensor.get(s.id);
        return {
          id: s.id,
          sensor: s.id_externo,
          talhao: d ? plotMap.get(d.talhao_id) : null,
          tipo: s.codigo_metrica,
          unidade: s.unidade,
          status: s.status !== "ativo"
            ? "Inativo"
            : d?.status === "offline"
              ? "Offline"
              : d?.status === "manutencao"
                ? "Manutencao"
                : d?.status === "desativado" || !d
                  ? "Desativado"
                  : "Online",
          ativo: s.status === "ativo",
          leitura: r ? `${r.valor} ${r.unidade}` : "Sem leitura",
          valor: r?.valor,
          comunicacao: r?.coletado_em || d?.ultimo_sinal_em
        };
      });
      return reply(res, 200, { sensores: sensorRows }, origin);
    }

    // 6. Rotas Granulares: Inspeções
    if (req.method === "GET" && route === "/inspecoes") {
      const [plots, inspections] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(c, "inspecao", "GET", undefined, "?select=*&order=inspecionado_em.desc&limit=100")
      ]);
      const plotMap = new Map(plots.map((p) => [p.id, p.codigo]));
      const rows = inspections.map((i) => ({
        id: i.id,
        talhao_id: i.talhao_id,
        talhao: plotMap.get(i.talhao_id) || null,
        data: i.inspecionado_em ? i.inspecionado_em.slice(0, 10) : null,
        situacao: i.status ? i.status[0].toUpperCase() + i.status.slice(1) : "Normal",
        problemas: i.descricao_problema,
        observacoes: i.observacoes,
        sensor_id: i.sensor_id || null,
        criado_em: i.criado_em
      }));
      return reply(res, 200, { inspecoes: rows }, origin);
    }

    // 7. Rotas Granulares: Ocorrências
    if (req.method === "GET" && route === "/ocorrencias") {
      const [plots, occurrences] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(c, "ocorrencia", "GET", undefined, "?select=*&order=registrado_em.desc&limit=100")
      ]);
      const plotMap = new Map(plots.map((p) => [p.id, p.codigo]));
      const rows = occurrences.map((o) => ({
        id: o.id,
        talhao_id: o.talhao_id,
        talhao: plotMap.get(o.talhao_id) || null,
        tipo: o.tipo,
        observacao: o.observacao,
        data: o.registrado_em ? o.registrado_em.slice(0, 10) : null,
        criado_em: o.criado_em
      }));
      return reply(res, 200, { ocorrencias: rows }, origin);
    }

    // 8. Rotas Granulares: Problemas de Sensor
    if (req.method === "GET" && route === "/sensores/problemas") {
      const [plots, sensors, problems] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(c, "sensor", "GET", undefined, "?select=id,id_externo"),
        db(c, "problema_sensor", "GET", undefined, "?select=*&order=data.desc&limit=100")
      ]);
      const plotMap = new Map(plots.map((p) => [p.id, p.codigo]));
      const sensorMap = new Map(sensors.map((s) => [s.id, s.id_externo]));
      const rows = problems.map((pr) => ({
        id: pr.id,
        talhao_id: pr.talhao_id,
        talhao: plotMap.get(pr.talhao_id) || null,
        sensor_id: pr.sensor_id,
        sensor: sensorMap.get(pr.sensor_id) || null,
        data: pr.data,
        problema: pr.problema,
        observacao: pr.observacao,
        criado_em: pr.criado_em
      }));
      return reply(res, 200, { problemas: rows }, origin);
    }

    // 9. Rotas Granulares: Alertas
    if (req.method === "GET" && route === "/alertas") {
      const alerts = await db(c, "alerta", "GET", undefined, "?select=*&order=aberto_em.desc&limit=50");
      return reply(res, 200, { alertas: alerts }, origin);
    }

    // 10. Rotas Granulares: Plantios e Ciclos de Cultura
    if (req.method === "GET" && route === "/plantios") {
      const [plots, cultivars, cultures, cycles] = await Promise.all([
        db(c, "talhao", "GET", undefined, "?select=id,codigo"),
        db(c, "cultivar", "GET", undefined, "?select=id,nome,cultura_id"),
        db(c, "cultura", "GET", undefined, "?select=id,nome_comum"),
        db(c, "ciclo_cultura", "GET", undefined, "?select=*&order=plantado_em.desc&limit=100")
      ]);
      const plotMap = new Map(plots.map((p) => [p.id, p.codigo]));
      const cultivarMap = new Map(cultivars.map((cv) => [cv.id, cv]));
      const cultureMap = new Map(cultures.map((cu) => [cu.id, cu.nome_comum]));

      const rows = cycles.map((cy) => {
        const cv = cultivarMap.get(cy.cultivar_id);
        const produto = cv ? cultureMap.get(cv.cultura_id) : "";
        return {
          id: cy.id,
          talhao_id: cy.talhao_id,
          talhao: plotMap.get(cy.talhao_id) || null,
          produto: produto || "",
          variedade: cv ? cv.nome : "",
          area: cy.area_plantada_hectares,
          solo: cy.solo,
          dataPlantio: cy.plantado_em,
          dataColheita: cy.previsao_colheita,
          status: cy.status
        };
      });
      return reply(res, 200, { plantios: rows }, origin);
    }

    // 11. Painéis Compostos (BFF - Backend for Frontend)
    if (req.method === "GET" && ["/painel-tecnico", "/painel-engenheiro"].includes(route)) {
      if (
        (route === "/painel-tecnico" && !["tecnico", "admin"].includes(user.perfil)) ||
        (route === "/painel-engenheiro" && !["engenheiro", "admin"].includes(user.perfil))
      ) {
        return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      }

      const farms = await farmsForOrganization(c);
      if (!farms.length) return reply(res, 503, { mensagem: "Fazenda nao configurada." }, origin);
      const [plots, devices, sensors, readings, inspections, cycles, occurrences, sensorProblems, alerts, cultivars, cultures] = await Promise.all([
        db(c, "talhao", "GET", undefined, `?fazenda_id=in.(${farms.map((farm) => farm.id).join(",")})&select=id,codigo,nome,area_hectares,coordenadas&order=codigo`),
        db(c, "dispositivo", "GET", undefined, "?select=id,id_externo,talhao_id,status,ultimo_sinal_em"),
        db(c, "sensor", "GET", undefined, "?select=id,id_externo,dispositivo_id,codigo_metrica,unidade,status"),
        db(c, "v_ultima_leitura_sensor", "GET", undefined, "?select=*&limit=500"),
        db(c, "inspecao", "GET", undefined, "?select=*&order=inspecionado_em.desc&limit=30"),
        db(c, "ciclo_cultura", "GET", undefined, "?status=eq.ativo&select=id,talhao_id,cultivar_id,area_plantada_hectares,plantado_em,previsao_colheita,solo"),
        db(c, "ocorrencia", "GET", undefined, "?select=*&order=registrado_em.desc&limit=100"),
        db(c, "problema_sensor", "GET", undefined, "?select=*&order=data.desc&limit=100"),
        db(c, "alerta", "GET", undefined, "?select=*&status=eq.aberto&order=aberto_em.desc&limit=100"),
        db(c, "cultivar", "GET", undefined, "?select=id,nome,cultura_id"),
        db(c, "cultura", "GET", undefined, "?select=id,nome_comum")
      ]);

      const readingBySensor = new Map(readings.map((r) => [r.sensor_id, r]));
      const deviceById = new Map(devices.map((d) => [d.id, d]));
      const cultivarById = new Map(cultivars.map((cultivar) => [cultivar.id, cultivar]));
      const cultureById = new Map(cultures.map((culture) => [culture.id, culture.nome_comum]));
      const sensorRows = sensors.map((s) => {
        const d = deviceById.get(s.dispositivo_id);
        const r = readingBySensor.get(s.id);
        return {
          sensor: s.id_externo,
          talhao: d && plots.find((p) => p.id === d.talhao_id)?.codigo,
          status: s.status !== "ativo"
            ? "Inativo"
            : d?.status === "offline"
              ? "Offline"
              : d?.status === "manutencao"
                ? "Manutencao"
                : d?.status === "desativado" || !d
                  ? "Desativado"
                  : "Online",
          leitura: r ? `${r.valor} ${r.unidade}` : "Sem leitura",
          comunicacao: r?.coletado_em || d?.ultimo_sinal_em,
          id: s.id,
          tipo: s.codigo_metrica,
          ativo: s.status === "ativo",
          valor: r?.valor,
          unidade: s.unidade
        };
      });

      const ciclosOrdenados = [...cycles].sort((a, b) =>
        String(b.plantado_em || "").localeCompare(String(a.plantado_em || ""))
      );
      const cicloAtivoPorTalhao = new Map();
      for (const cycle of ciclosOrdenados) {
        if (!cicloAtivoPorTalhao.has(cycle.talhao_id)) cicloAtivoPorTalhao.set(cycle.talhao_id, cycle);
      }
      const talhoes = plots.map((p) => {
        const sensoresDoTalhao = sensorRows.filter((item) => item.talhao === p.codigo);
        const sensoresAtivos = sensoresDoTalhao.filter((item) => item.ativo);
        const s = sensoresAtivos.find((item) => item.tipo === "umidadeSolo" && item.valor !== null && item.valor !== undefined)
          || sensoresAtivos.find((item) => item.valor !== null && item.valor !== undefined)
          || sensoresAtivos[0]
          || sensoresDoTalhao[0];
        const sensorDoSolo = sensoresAtivos.find((item) => item.tipo === "umidadeSolo");
        const valorSolo = Number(sensorDoSolo?.valor);
        const leituraSoloValida = sensorDoSolo?.valor !== null
          && sensorDoSolo?.valor !== undefined
          && Number.isFinite(valorSolo);
        const semSensor = sensoresDoTalhao.length === 0;
        const semSensorAtivo = !semSensor && sensoresAtivos.length === 0;
        const semComunicacao = sensoresAtivos.some((item) =>
          ["Offline", "Manutencao", "Desativado"].includes(item.status)
        );
        const semLeitura = sensoresAtivos.length === 0
          || sensoresAtivos.every((item) => item.valor === null || item.valor === undefined);
        const critical = leituraSoloValida && valorSolo < 30;
        const attention = leituraSoloValida && valorSolo >= 30 && valorSolo < 40;
        const cycle = cicloAtivoPorTalhao.get(p.id);
        const cultivar = cycle && cultivarById.get(cycle.cultivar_id);
        const produto = cultivar ? cultureById.get(cultivar.cultura_id) : null;
        const culturaLabel = [produto, cultivar?.nome].filter(Boolean).join(" / ");
        return {
          id: p.codigo,
          cultura: culturaLabel || "Sem plantio ativo",
          area: `${p.area_hectares} hectares`,
          sensor: s?.sensor,
          leitura: s?.leitura || "Sem leitura",
          situacao: semSensor ? "Sem sensor"
            : semSensorAtivo ? "Sensor inativo"
              : semComunicacao ? "Sem comunicacao"
                : critical ? "Critico"
                  : semLeitura ? "Sem leitura"
                    : attention ? "Atencao"
                      : "Normal",
          prioridade: semSensor ? "Cadastre um sensor para habilitar o monitoramento"
            : semSensorAtivo ? "Ative um sensor para habilitar o monitoramento"
              : semComunicacao ? "Verifique a comunicacao do sensor"
                : critical ? "Umidade do solo abaixo de 30%"
                  : semLeitura ? "Aguardando leitura de sensor"
                    : attention ? "Verifique a umidade do solo"
                      : "Rotina de acompanhamento"
        };
      });

      return reply(
        res,
        200,
        {
          talhoes,
          sensores: sensorRows,
          inspecoes: inspections.map((i) => ({
            id: i.id,
            data: i.inspecionado_em?.slice(0, 10),
            talhao: plots.find((p) => p.id === i.talhao_id)?.codigo,
            situacao: i.status ? i.status[0].toUpperCase() + i.status.slice(1) : "Normal",
            problemas: i.descricao_problema,
            observacoes: i.observacoes,
            sensor_id: i.sensor_id || null,
            sensor: sensors.find((s) => s.id === i.sensor_id)?.id_externo || null
          })),
          plantios: cycles.map((cycle) => {
            const cultivar = cultivarById.get(cycle.cultivar_id);
            return {
              ...cycle,
              talhao: plots.find((plot) => plot.id === cycle.talhao_id)?.codigo,
              produto: cultivar ? cultureById.get(cultivar.cultura_id) : "",
              variedade: cultivar?.nome || ""
            };
          }),
          ocorrencias: occurrences.map((o) => ({
            id: o.id,
            data: o.registrado_em?.slice(0, 10),
            talhao: plots.find((p) => p.id === o.talhao_id)?.codigo,
            tipo: o.tipo,
            observacao: o.observacao
          })),
          problemasSensores: sensorProblems.map((problem) => ({
            id: problem.id,
            data: problem.data,
            talhao: plots.find((p) => p.id === problem.talhao_id)?.codigo,
            sensor: sensors.find((s) => s.id === problem.sensor_id)?.id_externo,
            problema: problem.problema,
            observacao: problem.observacao
          })),
          tarefas: talhoes
            .filter((p) => p.situacao !== "Normal")
            .map((p) => ({
              talhao: p.id,
              prioridade: p.situacao === "Critico" ? "Critica" : "Atencao",
              atividade: p.prioridade
            })),
          alertas: alerts
        },
        origin
      );
    }

    // 12. Cadastro de Plantio (Engenheiro / Admin)
    if (req.method === "POST" && route === "/plantios") {
      if (!["engenheiro", "admin"].includes(user.perfil)) return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      const d = await parseBody(req);
      if (
        !["produto", "variedade", "talhao", "solo"].every((k) => text(d[k])) ||
        !date(d.dataPlantio) ||
        !date(d.dataColheita)
      ) {
        return reply(res, 400, { mensagem: "Dados de plantio invalidos." }, origin);
      }

      const plot = (await db(c, "talhao", "GET", undefined, `?codigo=eq.${encodeURIComponent(d.talhao)}&select=id,area_hectares&limit=1`))[0];
      if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);
      const areaPlantada = Number(plot.area_hectares);
      if (!Number.isFinite(areaPlantada) || areaPlantada <= 0) {
        return reply(res, 409, { mensagem: "Defina uma area valida para o talhao antes de cadastrar o produto." }, origin);
      }

      let cultura = (await db(c, "cultura", "GET", undefined, `?nome_comum=eq.${encodeURIComponent(d.produto)}&select=id&limit=1`))[0];
      if (!cultura) {
        const created = await db(c, "cultura", "POST", { nome_comum: text(d.produto) });
        cultura = Array.isArray(created) ? created[0] : created;
      }

      let cultivar = (
        await db(c, "cultivar", "GET", undefined, `?cultura_id=eq.${cultura.id}&nome=eq.${encodeURIComponent(d.variedade)}&select=id&limit=1`)
      )[0];
      if (!cultivar) {
        const created = await db(c, "cultivar", "POST", { cultura_id: cultura.id, nome: text(d.variedade) });
        cultivar = Array.isArray(created) ? created[0] : created;
      }

      await db(c, "ciclo_cultura", "POST", {
        talhao_id: plot.id,
        cultivar_id: cultivar.id,
        area_plantada_hectares: areaPlantada,
        solo: text(d.solo),
        plantado_em: d.dataPlantio,
        previsao_colheita: d.dataColheita,
        usuario_id: user.sub,
        status: "ativo"
      });
      return reply(res, 201, { sucesso: true }, origin);
    }

    // 13. Registros de Campo do Técnico (Inspeções, Ocorrências, Problemas em Sensores)
    if (req.method === "POST" && ["/inspecoes", "/ocorrencias", "/sensores/problemas"].includes(route)) {
      if (!["tecnico", "admin"].includes(user.perfil)) return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      const d = await parseBody(req);

      if (route === "/inspecoes") {
        if (!text(d.talhao) || !date(d.data) || !["Normal", "Atencao", "Critico"].includes(d.situacao)) {
          return reply(res, 400, { mensagem: "Dados de inspecao invalidos." }, origin);
        }
        const plot = (await db(c, "talhao", "GET", undefined, `?codigo=eq.${encodeURIComponent(d.talhao)}&select=id&limit=1`))[0];
        if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);

        const sensorId = text(d.sensor_id, 80);
        let linkedSensorId = null;
        if (sensorId) {
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sensorId)) {
            return reply(res, 400, { mensagem: "Identificador do sensor invalido." }, origin);
          }
          const sensor = (await db(
            c,
            "sensor",
            "GET",
            undefined,
            `?id=eq.${encodeURIComponent(sensorId)}&status=eq.ativo&select=id,dispositivo_id&limit=1`
          ))[0];
          if (!sensor) return reply(res, 404, { mensagem: "O sensor selecionado nao esta ativo ou nao existe." }, origin);
          const device = (await db(
            c,
            "dispositivo",
            "GET",
            undefined,
            `?id=eq.${encodeURIComponent(sensor.dispositivo_id)}&select=talhao_id&limit=1`
          ))[0];
          if (!device || device.talhao_id !== plot.id) {
            return reply(res, 400, { mensagem: "O sensor selecionado nao pertence ao talhao informado." }, origin);
          }
          linkedSensorId = sensor.id;
        }

        await db(c, "inspecao", "POST", {
          talhao_id: plot.id,
          usuario_id: user.sub,
          sensor_id: linkedSensorId,
          inspecionado_em: d.data,
          status: d.situacao.toLowerCase(),
          descricao_problema: text(d.problemas) || null,
          observacoes: text(d.observacoes) || null
        });
        return reply(res, 201, { sucesso: true }, origin);
      }

      if (route === "/ocorrencias") {
        if (!text(d.talhao) || !text(d.tipo)) {
          return reply(res, 400, { mensagem: "Dados de ocorrencia invalidos." }, origin);
        }
        const plot = (await db(c, "talhao", "GET", undefined, `?codigo=eq.${encodeURIComponent(d.talhao)}&select=id&limit=1`))[0];
        if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);

        await db(c, "rpc/registrar_ocorrencia_com_alerta", "POST", {
          p_talhao_id: plot.id,
          p_usuario_id: user.sub,
          p_talhao_codigo: text(d.talhao),
          p_tipo: text(d.tipo),
          p_observacao: text(d.observacao) || null
        });
        return reply(res, 201, { sucesso: true }, origin);
      }

      if (route === "/sensores/problemas") {
        if (!text(d.talhao) || !date(d.data) || !text(d.problema)) {
          return reply(res, 400, { mensagem: "Dados de problema de sensor invalidos." }, origin);
        }
        const plot = (await db(c, "talhao", "GET", undefined, `?codigo=eq.${encodeURIComponent(d.talhao)}&select=id&limit=1`))[0];
        if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);

        const sensorCodigo = text(d.sensor, 80);
        let sensor = null;
        if (sensorCodigo) {
          sensor = (await db(c, "sensor", "GET", undefined, `?id_externo=eq.${encodeURIComponent(sensorCodigo)}&status=eq.ativo&select=id,dispositivo_id&limit=1`))[0];
          if (!sensor) return reply(res, 404, { mensagem: "Sensor nao encontrado." }, origin);
          const device = (await db(c, "dispositivo", "GET", undefined, `?id=eq.${encodeURIComponent(sensor.dispositivo_id)}&select=talhao_id&limit=1`))[0];
          if (!device || device.talhao_id !== plot.id) {
            return reply(res, 400, { mensagem: "O sensor selecionado nao pertence ao talhao informado." }, origin);
          }
        }
        await db(c, "rpc/registrar_problema_sensor_com_alerta", "POST", {
          p_sensor_id: sensor?.id || null,
          p_talhao_id: plot.id,
          p_usuario_id: user.sub,
          p_talhao_codigo: text(d.talhao),
          p_sensor_codigo: sensorCodigo || "nao cadastrado",
          p_data: d.data,
          p_problema: text(d.problema),
          p_observacao: text(d.observacao) || null
        });
        return reply(res, 201, { sucesso: true }, origin);
      }
    }

    // 14. Gestão Administrativa de Funcionários (Admin)
    const employeeMatch = route.match(/^\/funcionarios\/([^/]+)$/);
    if (employeeMatch && ["PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      const employeeId = decodeURIComponent(employeeMatch[1]);
      if (employeeId === String(user.sub)) {
        return reply(res, 400, { mensagem: "Nao e permitido alterar ou excluir o proprio usuario." }, origin);
      }
      const employee = (await db(
        c,
        "usuario",
        "GET",
        undefined,
        `?id=eq.${encodeURIComponent(employeeId)}&select=id&limit=1`
      ))[0];
      if (!employee) return reply(res, 404, { mensagem: "Funcionario nao encontrado." }, origin);
      if (req.method === "PUT") {
        const d = await parseBody(req);
        if (
          !text(d.nome) ||
          !text(d.cargo) ||
          !text(d.profissao, 160) ||
          !ROLES.includes(d.perfil) ||
          !["ativo", "inativo"].includes(d.status) ||
          (d.senha !== undefined && d.senha !== "" && (typeof d.senha !== "string" || d.senha.length < 8 || d.senha.length > 10))
        ) {
          return reply(res, 400, { mensagem: "Dados invalidos para atualizar funcionario." }, origin);
        }
        const updates = {
          nome_completo: text(d.nome),
          cargo: text(d.cargo),
          profissao: text(d.profissao, 160),
          perfil: d.perfil === "admin" ? "administrador" : d.perfil,
          status: d.status
        };
        if (d.senha) {
          updates.senha_hash = hashPassword(d.senha);
          updates.senha_temporaria = true;
        }
        await db(c, `usuario?id=eq.${encodeURIComponent(employeeId)}`, "PATCH", updates);
        return reply(res, 200, { sucesso: true }, origin);
      }
      if (req.method === "PATCH") {
        const d = await parseBody(req);
        if (!["ativo", "inativo"].includes(d.status)) {
          return reply(res, 400, { mensagem: "Status de funcionario invalido." }, origin);
        }
        await db(c, `usuario?id=eq.${encodeURIComponent(employeeId)}`, "PATCH", { status: d.status });
        return reply(res, 200, { sucesso: true, status: d.status }, origin);
      }
      await db(c, `usuario?id=eq.${encodeURIComponent(employeeId)}`, "DELETE");
      return reply(res, 200, { sucesso: true }, origin);
    }

    if (["/funcionarios", "/admin/usuarios"].includes(route)) {
      if (req.method === "GET") {
        if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Sem permissao." }, origin);
        const rows = await db(
          c,
          "usuario",
          "GET",
          undefined,
          "?select=id,matricula,nome_completo,perfil,cargo,profissao,status,criado_em&order=matricula"
        );
        return reply(
          res,
          200,
          {
            usuarios: rows.map((r) => ({
              id: r.id,
              matricula: r.matricula,
              nome: r.nome_completo,
              perfil: r.perfil === "administrador" ? "admin" : r.perfil,
              cargo: r.cargo,
              profissao: r.profissao || "",
              status: r.status,
              ativo: r.status === "ativo",
              created_at: r.criado_em
            }))
          },
          origin
        );
      }

      if (req.method === "POST") {
        if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Sem permissao." }, origin);
        const d = await parseBody(req);
        const perfil = d.perfil === undefined ? "tecnico" : d.perfil;
        if (
          !text(d.nome) ||
          !text(d.cargo) ||
          !text(d.profissao, 160) ||
          !ROLES.includes(perfil) ||
          !["ativo", "inativo"].includes(d.status) ||
          typeof d.senha !== "string" ||
          d.senha.length < 8 ||
          d.senha.length > 10
        ) {
          return reply(res, 400, { mensagem: "Dados invalidos: senha temporaria deve possuir entre 8 e 10 caracteres." }, origin);
        }

        const org = (await db(c, "organizacao", "GET", undefined, "?select=id&order=criado_em&limit=1"))[0];
        if (!org) return reply(res, 503, { mensagem: "Organizacao nao configurada." }, origin);

        const matriculaResponse = await db(c, "rpc/proxima_matricula_funcionario", "POST", {});
        const matricula = typeof matriculaResponse === "string" ? matriculaResponse : matriculaResponse?.matricula;
        if (!text(matricula, 40)) {
          throw new Error("Falha ao gerar matricula para o funcionario.");
        }

        const created = await db(c, "usuario", "POST", {
          organizacao_id: org.id,
          matricula,
          nome_completo: text(d.nome),
          cargo: text(d.cargo),
          profissao: text(d.profissao, 160),
          perfil: perfil === "admin" ? "administrador" : perfil,
          status: d.status,
          senha_hash: hashPassword(d.senha),
          senha_temporaria: true
        });
        const employee = Array.isArray(created) ? created[0] : created;
        if (!employee?.id) {
          throw new Error("O banco nao confirmou a gravacao do funcionario. Atualize o esquema e tente novamente.");
        }
        return reply(res, 201, { sucesso: true, matricula, id: employee?.id }, origin);
      }
    }

    const sensorMatch = route.match(/^\/sensores\/([^/]+)$/);
    if (sensorMatch && ["PATCH", "DELETE"].includes(req.method)) {
      if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      const sensorId = decodeURIComponent(sensorMatch[1]);
      const sensor = (await db(
        c,
        "sensor",
        "GET",
        undefined,
        `?id=eq.${encodeURIComponent(sensorId)}&select=id&limit=1`
      ))[0];
      if (!sensor) return reply(res, 404, { mensagem: "Sensor nao encontrado." }, origin);
      if (req.method === "PATCH") {
        const d = await parseBody(req);
        if (!["ativo", "inativo"].includes(d.status)) {
          return reply(res, 400, { mensagem: "Status de sensor invalido." }, origin);
        }
        await db(c, `sensor?id=eq.${encodeURIComponent(sensorId)}`, "PATCH", { status: d.status });
        return reply(res, 200, { sucesso: true }, origin);
      }
      await db(c, `sensor?id=eq.${encodeURIComponent(sensorId)}`, "DELETE");
      return reply(res, 200, { sucesso: true }, origin);
    }

    if (req.method === "POST" && route === "/sensores") {
      if (user.perfil !== "admin") return reply(res, 403, { mensagem: "Sem permissao." }, origin);
      const d = await parseBody(req);
      const idExterno = text(d.sensor, 80);
      const codigoMetrica = d.tipo;
      const unidade = text(d.unidade, 20);
      const codigoTalhao = text(d.talhao, 40);
      if (!idExterno || !unidade || !codigoTalhao || !TYPES.includes(codigoMetrica)) {
        return reply(res, 400, { mensagem: "Dados invalidos para cadastro do sensor." }, origin);
      }

      const plot = (await db(
        c,
        "talhao",
        "GET",
        undefined,
        `?codigo=eq.${encodeURIComponent(codigoTalhao)}&select=id&limit=1`
      ))[0];
      if (!plot) return reply(res, 404, { mensagem: "Talhao nao encontrado." }, origin);

      const org = (await db(c, "organizacao", "GET", undefined, "?select=id&order=criado_em&limit=1"))[0];
      if (!org) return reply(res, 503, { mensagem: "Organizacao nao configurada." }, origin);

      let device = (await db(
        c,
        "dispositivo",
        "GET",
        undefined,
        `?organizacao_id=eq.${encodeURIComponent(org.id)}&id_externo=eq.${encodeURIComponent(idExterno)}&select=id,talhao_id&limit=1`
      ))[0];
      if (device && device.talhao_id !== plot.id) {
        return reply(res, 409, { mensagem: "O identificador do dispositivo ja esta associado a outro talhao." }, origin);
      }
      if (!device) {
        const created = await db(c, "dispositivo", "POST", {
          organizacao_id: org.id,
          talhao_id: plot.id,
          id_externo: idExterno,
          status: "offline"
        });
        device = Array.isArray(created) ? created[0] : created;
      }

      const duplicate = (await db(
        c,
        "sensor",
        "GET",
        undefined,
        `?dispositivo_id=eq.${encodeURIComponent(device.id)}&id_externo=eq.${encodeURIComponent(idExterno)}&select=id&limit=1`
      ))[0];
      if (duplicate) return reply(res, 409, { mensagem: "Ja existe um sensor com esse identificador." }, origin);

      const createdSensor = await db(c, "sensor", "POST", {
        dispositivo_id: device.id,
        id_externo: idExterno,
        codigo_metrica: codigoMetrica,
        unidade,
        status: "ativo"
      });
      const savedSensor = Array.isArray(createdSensor) ? createdSensor[0] : createdSensor;
      return reply(res, 201, { sucesso: true, sensor: savedSensor }, origin);
    }

    return reply(res, 404, { mensagem: "Rota nao encontrada." }, origin);
  } catch (error) {
    console.error(`Erro ${req.method} ${route}:`, error.message);
    const isDbError = error.message.startsWith("Falha no banco de dados:");
    return reply(
      res,
      500,
      {
        mensagem: isDbError ? error.message : "Erro interno no servidor.",
        detalhes: process.env.NODE_ENV !== "production" ? error.message : undefined
      },
      origin
    );
  }
};
