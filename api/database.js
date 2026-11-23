// Centraliza o acesso ao PostgREST e as consultas reutilizadas pela API.
class DatabaseError extends Error {
  constructor(message, { resource, method, status, code, cause } = {}) {
    super(`Falha no banco de dados: ${message}`, { cause });
    this.name = "DatabaseError";
    // Nao armazenar filtros: podem conter hashes de senha ou outros segredos.
    this.resource = String(resource || "").split("?")[0];
    this.method = method;
    this.status = status;
    this.code = code;
  }
}

async function db(config, resource, method = "GET", data, query = "") {
  let response;
  try {
    response = await fetch(`${config.url}/rest/v1/${resource}${query}`, {
      signal: AbortSignal.timeout(10000),
      method,
      headers: {
        apikey: config.key,
        ...(config.key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${config.key}` }),
        "Content-Type": "application/json",
        Prefer: method === "POST" || method === "PATCH" ? "return=representation,resolution=merge-duplicates" : "",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (cause) {
    throw new DatabaseError("Servico indisponivel.", { resource, method, cause });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detalhes = [body.message, body.details, body.hint].filter(Boolean).join(" | ");
    const message = detalhes || `HTTP ${response.status}`;
    throw new DatabaseError(message, { resource, method, status: response.status, code: body.code });
  }
  return response.status === 204 ? [] : response.json();
}

async function listarTalhoesComTemperatura(config, query) {
  try {
    return await db(config, "talhao", "GET", undefined, query);
  } catch (error) {
    if (!String(error.message).includes("temperatura_maxima")) throw error;
    return db(config, "talhao", "GET", undefined, query.replace(",temperatura_maxima", ""));
  }
}

async function farmsForOrganization(config, organizationId) {
  if (typeof organizationId !== "string" || !organizationId) return [];
  return db(
    config,
    "fazenda",
    "GET",
    undefined,
    `?organizacao_id=eq.${encodeURIComponent(organizationId)}&select=id&order=criado_em`
  );
}

module.exports = { db, DatabaseError, listarTalhoesComTemperatura, farmsForOrganization };
