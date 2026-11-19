// Consultas somente de leitura. O modelo nunca recebe credenciais nem escreve SQL.
class ChatbotDataError extends Error {
  constructor(
    message = "Não foi possível consultar os dados agora. Tente novamente.",
  ) {
    super(message);
    this.status = 503;
  }
}

function createRepository(config, fetcher = (...args) => fetch(...args)) {
  async function request(table, query, offset = 0, size = 500, head = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(
        `${config.url}/rest/v1/${table}?${query}`,
        {
          method: head ? "HEAD" : "GET",
          signal: controller.signal,
          headers: {
            apikey: config.key,
            ...(config.key.startsWith("sb_secret_")
              ? {}
              : { Authorization: `Bearer ${config.key}` }),
            Prefer: "count=exact",
            "Range-Unit": "items",
            Range: `${offset}-${offset + size - 1}`,
          },
        },
      );
      if (!response.ok) throw new ChatbotDataError();
      const rawCount = response.headers.get("content-range")?.split("/")[1];
      const total =
        rawCount && /^\d+$/.test(rawCount) ? Number(rawCount) : null;
      if (head) {
        if (total === null)
          throw new ChatbotDataError(
            "A contagem completa não está disponível agora.",
          );
        return { total };
      }
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new ChatbotDataError();
      return { rows, total };
    } catch (error) {
      if (error instanceof ChatbotDataError) throw error;
      throw new ChatbotDataError();
    } finally {
      clearTimeout(timer);
    }
  }

  async function list(table, query, maximum = 10000) {
    const rows = [];
    let total = null;
    while (rows.length < maximum) {
      const result = await request(
        table,
        query,
        rows.length,
        Math.min(500, maximum - rows.length),
      );
      total = result.total;
      rows.push(...result.rows);
      if (!result.rows.length || (total !== null && rows.length >= total))
        break;
    }
    return { rows, total, parcial: total === null || rows.length < total };
  }
  return {
    list,
    count: async (table, query) =>
      (await request(table, query, 0, 1, true)).total,
  };
}

const inFilter = (ids) =>
  `in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`;
module.exports = { createRepository, ChatbotDataError, inFilter };
