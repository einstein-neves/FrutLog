// Centraliza o acesso ao PostgREST e as consultas reutilizadas pela API.
async function db(config, resource, method = "GET", data, query = "") {
  const response = await fetch(`${config.url}/rest/v1/${resource}${query}`, {
    method,
    headers: {
      apikey: config.key,
      ...(config.key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${config.key}` }),
      "Content-Type": "application/json",
      Prefer: method === "POST" || method === "PATCH" ? "return=representation,resolution=merge-duplicates" : "",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detalhes = [body.message, body.details, body.hint].filter(Boolean).join(" | ");
    const message = detalhes || `HTTP ${response.status}`;
    console.error(`PostgREST Erro [${method} ${resource}${query}]:`, JSON.stringify(body, null, 2));
    throw new Error(`Falha no banco de dados: ${message}`);
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

async function farmsForOrganization(config) {
  const organization = (await db(config, "organizacao", "GET", undefined, "?select=id&order=criado_em&limit=1"))[0];
  if (!organization) return [];
  return db(
    config,
    "fazenda",
    "GET",
    undefined,
    `?organizacao_id=eq.${encodeURIComponent(organization.id)}&select=id&order=criado_em`
  );
}

module.exports = { db, listarTalhoesComTemperatura, farmsForOrganization };
