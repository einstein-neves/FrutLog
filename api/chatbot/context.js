const { inFilter, ChatbotDataError } = require("./repository");
const { shift } = require("./query");

async function complete(repo, table, query) {
  const result = await repo.list(table, query);
  if (result.parcial)
    throw new ChatbotDataError(
      "O catálogo excedeu o limite de consulta do assistente. Não foi possível identificar os registros com segurança.",
    );
  return result.rows;
}
async function related(repo, table, field, ids, select) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    rows.push(
      ...(await complete(
        repo,
        table,
        `${field}=${inFilter(ids.slice(i, i + 100))}&select=${select}&order=id`,
      )),
    );
  }
  return rows;
}
async function authorizeAccount(repo, userId) {
  const actors = await repo.list(
    "usuario",
    `id=eq.${encodeURIComponent(userId)}&select=organizacao_id,status,perfil`,
    1,
  );
  const actor = actors.rows[0];
  if (
    !actor ||
    actor.status !== "ativo" ||
    !["admin", "administrador", "engenheiro", "tecnico"].includes(actor.perfil)
  ) {
    const error = new Error(
      "Seu acesso ao assistente não está autorizado. Entre novamente ou consulte o administrador.",
    );
    error.status = 403;
    throw error;
  }
  return {
    ...actor,
    perfil: actor.perfil === "administrador" ? "admin" : actor.perfil,
  };
}
async function loadCatalog(repo, userId) {
  const actor = await authorizeAccount(repo, userId);
  if (actor.perfil !== "admin") {
    const error = new Error(
      "As consultas operacionais completas são restritas ao Administrador.",
    );
    error.status = 403;
    throw error;
  }
  const organizations = await repo.list(
    "organizacao",
    `id=eq.${encodeURIComponent(actor.organizacao_id)}&select=id&order=id`,
    1,
  );
  const organization = organizations.rows[0];
  if (!organization)
    return {
      organization: null,
      farms: [],
      plots: [],
      devices: [],
      sensors: [],
    };
  const farms = await complete(
    repo,
    "fazenda",
    `organizacao_id=eq.${encodeURIComponent(organization.id)}&select=id&order=id`,
  );
  const plots = await related(
    repo,
    "talhao",
    "fazenda_id",
    farms.map((f) => f.id),
    "id,codigo,nome,area_hectares",
  );
  const devices = await complete(
    repo,
    "dispositivo",
    `organizacao_id=eq.${encodeURIComponent(organization.id)}&select=id,id_externo,talhao_id,status,ultimo_sinal_em&order=id`,
  );
  const sensors = await related(
    repo,
    "sensor",
    "dispositivo_id",
    devices.map((d) => d.id),
    "id,id_externo,dispositivo_id,codigo_metrica,unidade,status",
  );
  return { organization, farms, plots, devices, sensors };
}

function sensorState(sensor, device, reading, now, staleMinutes = 15) {
  const signalAt = device?.ultimo_sinal_em;
  const signalAge = signalAt
    ? (now.getTime() - Date.parse(signalAt)) / 60000
    : null;
  const readingAge = reading?.coletado_em
    ? (now.getTime() - Date.parse(reading.coletado_em)) / 60000
    : null;
  const signalRecent =
    Number.isFinite(signalAge) && signalAge >= -1 && signalAge <= staleMinutes;
  const status =
    sensor.status !== "ativo"
      ? "Inativo"
      : device?.status === "manutencao"
        ? "Manutencao"
        : device?.status === "desativado"
          ? "Desativado"
          : device?.status === "online" && signalRecent
            ? "Online"
            : "Offline";
  const freshness = !reading
    ? "Sem leitura"
    : Number.isFinite(readingAge) &&
        readingAge >= -1 &&
        readingAge <= staleMinutes
      ? "Recente"
      : "Antiga ou data inválida";
  return {
    status,
    atualidade_leitura: freshness,
    ultimo_sinal_em: signalAt || null,
    coletado_em: reading?.coletado_em || null,
  };
}

function calculateStats(rows, sensors, period) {
  const summaries = [];
  const metadata = new Map(sensors.map((s) => [s.id, s]));
  const groups = new Map();
  for (const row of rows) {
    if (
      row.valor === null ||
      row.valor === "" ||
      !Number.isFinite(Number(row.valor)) ||
      !metadata.has(row.sensor_id)
    )
      continue;
    const unit = row.unidade || metadata.get(row.sensor_id).unidade;
    const key = `${row.sensor_id}:${unit}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...row, valor: Number(row.valor), unidade: unit });
  }
  const midpoint = (Date.parse(period.desde) + Date.parse(period.ate)) / 2;
  const average = (items) =>
    items.length
      ? items.reduce((sum, row) => sum + row.valor, 0) / items.length
      : null;
  for (const items of groups.values()) {
    items.sort((a, b) => Date.parse(a.coletado_em) - Date.parse(b.coletado_em));
    const first = items[0],
      last = items[items.length - 1];
    const sensor = metadata.get(first.sensor_id);
    const initial = items.filter((r) => Date.parse(r.coletado_em) < midpoint);
    const final = items.filter((r) => Date.parse(r.coletado_em) >= midpoint);
    summaries.push({
      sensor: sensor.id_externo,
      metrica: sensor.codigo_metrica,
      unidade: first.unidade,
      quantidade: items.length,
      media: average(items),
      minimo: Math.min(...items.map((r) => r.valor)),
      maximo: Math.max(...items.map((r) => r.valor)),
      primeira_leitura: { valor: first.valor, coletado_em: first.coletado_em },
      ultima_leitura: { valor: last.valor, coletado_em: last.coletado_em },
      variacao_primeira_ultima:
        items.length >= 2 ? last.valor - first.valor : null,
      comparacao_metades_do_periodo: {
        media_primeira_metade: average(initial),
        media_segunda_metade: average(final),
        diferenca:
          initial.length && final.length
            ? average(final) - average(initial)
            : null,
      },
    });
  }
  return summaries;
}

async function buildContext(
  repo,
  catalog,
  plan,
  { now = new Date(), staleMinutes = 15 } = {},
) {
  const context = {
    consultado_em: now.toISOString(),
    timezone: "America/Fortaleza",
    avisos: [],
    fontes: [],
    filtros: {
      periodo:
        plan.period.explicito ||
        (plan.history &&
          (plan.topics.includes("sensores") || !plan.topics.length))
          ? plan.period
          : null,
      metrica: plan.metric,
      status: plan.status,
    },
    totais: {},
    listas: {},
  };
  if (!catalog.organization) {
    context.avisos.push(
      "Nenhuma organização cadastrada; não há dados operacionais disponíveis.",
    );
    return context;
  }
  const devices = new Map(catalog.devices.map((d) => [d.id, d]));
  const sensors = catalog.sensors.filter(
    (s) =>
      (!plan.sensorIds.length || plan.sensorIds.includes(s.id)) &&
      (!plan.plotIds.length ||
        plan.plotIds.includes(devices.get(s.dispositivo_id)?.talhao_id)) &&
      (plan.metrics?.length
        ? plan.metrics.includes(s.codigo_metrica)
        : !plan.metric || plan.metric === s.codigo_metrica),
  );
  let plots = catalog.plots.filter(
    (p) => !plan.plotIds.length || plan.plotIds.includes(p.id),
  );
  if (plan.sensorIds.length) {
    const selectedPlots = new Set(
      sensors.map((s) => devices.get(s.dispositivo_id)?.talhao_id),
    );
    plots = plots.filter((p) => selectedPlots.has(p.id));
  }
  const plotIds = plots.map((p) => p.id);
  const plotById = new Map(plots.map((p) => [p.id, p.codigo]));
  context.filtros.talhoes = plots.map((p) => p.codigo);
  context.filtros.sensores = sensors.map((s) => s.id_externo);
  context.filtros.metricas = plan.metrics || [];
  context.filtros.anos_colheita = plan.years || [];
  context.semantica =
    "Status de usuários, sensores, plantios ativos e alertas abertos são atuais; datas filtram registros ou leituras, não reconstroem estados passados.";
  if (plan.period.explicito && plan.status)
    context.avisos.push(
      "O status de comunicação é atual; o histórico de leituras não comprova se o sensor estava Online ou Offline no período passado.",
    );
  context.totais.talhoes = plots.length;
  context.listas.talhoes = {
    itens: plots.slice(0, 50).map(({ codigo, nome, area_hectares }) => ({
      codigo,
      nome,
      area_hectares,
    })),
    total: plots.length,
    parcial: plots.length > 50,
  };
  const topics = plan.topics.length
    ? plan.topics
    : [
        "sensores",
        "ocorrencias",
        "inspecoes",
        "problemas",
        "alertas",
        "plantios",
        "colheitas",
        "usuarios",
      ];
  if (plan.knowledgeOnly) return context;
  const plotFilter = `talhao_id=${inFilter(plotIds)}`;
  async function capture(name, operation) {
    try {
      await operation();
    } catch {
      context.avisos.push(
        `Falha ao consultar ${name}; dados indisponíveis, não equivalem a zero registros.`,
      );
      context.totais[name] = null;
    }
  }
  const periodFilter = (field, dateOnly = false) =>
    plan.period.explicito
      ? `&${field}=gte.${encodeURIComponent(dateOnly ? plan.period.inicio : plan.period.desde)}&${field}=lt.${encodeURIComponent(dateOnly ? shift(plan.period.fim, 1) : plan.period.ate)}`
      : "";
  const tasks = [];
  if (topics.includes("usuarios"))
    tasks.push(
      capture("usuarios", async () => {
        const base = `organizacao_id=eq.${encodeURIComponent(catalog.organization.id)}&select=id`;
        const [total, active, admin, engineer, technician] = await Promise.all([
          repo.count("usuario", base),
          repo.count("usuario", `${base}&status=eq.ativo`),
          repo.count(
            "usuario",
            `${base}&status=eq.ativo&perfil=in.(admin,administrador)`,
          ),
          repo.count("usuario", `${base}&status=eq.ativo&perfil=eq.engenheiro`),
          repo.count("usuario", `${base}&status=eq.ativo&perfil=eq.tecnico`),
        ]);
        context.totais.usuarios = {
          total,
          ativos: active,
          inativos: total - active,
          ativos_por_perfil: {
            administradores: admin,
            engenheiros: engineer,
            tecnicos: technician,
          },
        };
        context.fontes.push("Contagem de usuários da organização");
      }),
    );
  if (topics.includes("sensores"))
    tasks.push(
      capture("sensores", async () => {
        const readings = [];
        for (let i = 0; i < sensors.length; i += 100) {
          const result = await repo.list(
            "v_ultima_leitura_sensor",
            `sensor_id=${inFilter(sensors.slice(i, i + 100).map((s) => s.id))}&select=sensor_id,valor,unidade,coletado_em&order=sensor_id`,
          );
          if (result.parcial) throw new ChatbotDataError();
          readings.push(...result.rows);
        }
        const bySensor = new Map(readings.map((r) => [r.sensor_id, r]));
        const rows = sensors.map((sensor) => {
          const device = devices.get(sensor.dispositivo_id),
            reading = bySensor.get(sensor.id);
          return {
            sensor: sensor.id_externo,
            talhao: plotById.get(device?.talhao_id),
            metrica: sensor.codigo_metrica,
            unidade: reading?.unidade || sensor.unidade,
            valor: reading?.valor ?? null,
            ...sensorState(sensor, device, reading, now, staleMinutes),
          };
        });
        const selected = rows.filter(
          (r) => !plan.status || r.status === plan.status,
        );
        context.totais.sensores = {
          total: rows.length,
          encontrados: selected.length,
          por_status: Object.fromEntries(
            ["Online", "Offline", "Inativo", "Manutencao", "Desativado"].map(
              (s) => [s, rows.filter((r) => r.status === s).length],
            ),
          ),
        };
        context.listas.sensores = {
          itens: selected.slice(0, 50),
          total: selected.length,
          parcial: selected.length > 50,
        };
        context.fontes.push(
          `Sensores e últimas leituras (comunicação recente: até ${staleMinutes} min)`,
        );
      }),
    );
  const definitions = {
    ocorrencias: [
      "ocorrencia",
      "talhao_id,tipo,observacao,registrado_em",
      "registrado_em",
      "",
    ],
    inspecoes: [
      "inspecao",
      "talhao_id,status,descricao_problema,observacoes,inspecionado_em",
      "inspecionado_em",
      "",
    ],
    problemas: [
      "problema_sensor",
      "talhao_id,problema,observacao,data",
      "data",
      "",
    ],
    alertas: ["alerta", "*", "aberto_em", "&status=eq.aberto"],
    plantios: [
      "ciclo_cultura",
      "talhao_id,cultivar_id,area_plantada_hectares,plantado_em,previsao_colheita,solo",
      "plantado_em",
      "&status=eq.ativo",
    ],
  };
  for (const [name, [table, select, date, filter]] of Object.entries(
    definitions,
  ))
    if (topics.includes(name))
      tasks.push(
        capture(name, async () => {
          if (!plotIds.length) {
            context.totais[name] = 0;
            context.listas[name] = { itens: [], total: 0, parcial: false };
            return;
          }
          const result = await repo.list(
            table,
            `${plotFilter}&select=${select}${filter}${periodFilter(date, date === "data" || date === "plantado_em")}&order=${date}.desc,id`,
            30,
          );
          if (result.total === null) throw new ChatbotDataError();
          context.totais[name] = result.total;
          context.listas[name] = {
            itens: result.rows.map((row) => {
              const { id, talhao_id, ...item } = row;
              // Campos livres são dados não confiáveis. Nunca enviar colunas extras de select=*.
              return name === "alertas"
                ? {
                    talhao: plotById.get(talhao_id),
                    titulo: row.titulo,
                    mensagem: row.mensagem || row.texto || row.descricao,
                    severidade: row.severidade,
                    aberto_em: row.aberto_em,
                  }
                : { talhao: plotById.get(talhao_id), ...item };
            }),
            total: result.total,
            parcial: result.parcial,
          };
          context.fontes.push(
            {
              ocorrencias: "Ocorrências",
              inspecoes: "Inspeções de campo",
              problemas: "Problemas de sensores",
              alertas: "Alertas abertos",
              plantios: "Plantios ativos",
            }[name],
          );
          if (name === "plantios") {
            const ids = [
              ...new Set(result.rows.map((r) => r.cultivar_id).filter(Boolean)),
            ];
            const cultivars = await related(
              repo,
              "cultivar",
              "id",
              ids,
              "id,nome,cultura_id",
            );
            const cultures = await related(
              repo,
              "cultura",
              "id",
              [...new Set(cultivars.map((r) => r.cultura_id))],
              "id,nome_comum",
            );
            const byCultivar = new Map(cultivars.map((r) => [r.id, r]));
            const byCulture = new Map(
              cultures.map((r) => [r.id, r.nome_comum]),
            );
            context.listas[name].itens = context.listas[name].itens.map(
              ({ cultivar_id, ...r }) => ({
                ...r,
                variedade: byCultivar.get(cultivar_id)?.nome,
                produto: byCulture.get(byCultivar.get(cultivar_id)?.cultura_id),
              }),
            );
          }
        }),
      );
  if (topics.includes("colheitas"))
    tasks.push(
      capture("colheitas", async () => {
        if (!plotIds.length) {
          context.totais.colheitas = 0;
          return;
        }
        const result = await repo.list(
          "colheita",
          `${plotFilter}&select=ano,quantidade,unidade,colhido_em${plan.years?.length ? `&ano=${inFilter(plan.years)}` : ""}${periodFilter("colhido_em", true)}&order=colhido_em,id`,
          20000,
        );
        context.totais.colheitas = result.total;
        if (result.parcial) {
          context.avisos.push(
            "Colheitas: volume excedeu o limite; totais de produção não calculados. Restrinja o período ou talhão.",
          );
          return;
        }
        const groups = new Map();
        for (const r of result.rows) {
          const key = `${r.ano}:${r.unidade}`;
          const item = groups.get(key) || {
            ano: r.ano,
            unidade: r.unidade,
            quantidade: 0,
          };
          item.quantidade += Number(r.quantidade) || 0;
          groups.set(key, item);
        }
        context.colheitas_por_ano = [...groups.values()];
        context.fontes.push("Colheitas registradas por ano e unidade");
      }),
    );
  if (plan.history && (topics.includes("sensores") || !plan.topics.length))
    tasks.push(
      capture("historico", async () => {
        const all = [];
        let total = 0;
        for (let i = 0; i < sensors.length; i += 50) {
          const result = await repo.list(
            "leitura_sensor",
            `sensor_id=${inFilter(sensors.slice(i, i + 50).map((s) => s.id))}&select=id,sensor_id,valor,unidade,coletado_em&qualidade=eq.boa&coletado_em=gte.${encodeURIComponent(plan.period.comparar_com?.desde || plan.period.desde)}&coletado_em=lt.${encodeURIComponent(plan.period.ate)}&order=coletado_em,id`,
            20000 - all.length,
          );
          if (result.parcial) {
            context.avisos.push(
              "Histórico excedeu 20.000 leituras; estatísticas não calculadas. Escolha um sensor ou um período menor.",
            );
            return;
          }
          all.push(...result.rows);
          total += result.rows.length;
          if (all.length >= 20000 && i + 50 < sensors.length) {
            context.avisos.push(
              "Histórico excedeu o limite de leitura; estatísticas não calculadas. Restrinja a consulta.",
            );
            return;
          }
        }
        context.totais.historico = total;
        context.estatisticas = calculateStats(
          all.filter(
            (r) => Date.parse(r.coletado_em) >= Date.parse(plan.period.desde),
          ),
          sensors,
          plan.period,
        );
        if (plan.period.comparar_com) {
          const baseline = calculateStats(
            all.filter(
              (r) => Date.parse(r.coletado_em) < Date.parse(plan.period.desde),
            ),
            sensors,
            plan.period.comparar_com,
          );
          context.comparacao_periodo_anterior = {
            periodo: plan.period.comparar_com,
            estatisticas: baseline,
          };
          for (const stat of context.estatisticas) {
            const before = baseline.find(
              (s) =>
                s.sensor === stat.sensor &&
                s.metrica === stat.metrica &&
                s.unidade === stat.unidade,
            );
            stat.diferenca_media_periodo_anterior = before
              ? stat.media - before.media
              : null;
          }
        }
        context.fontes.push(
          "Histórico de leituras válidas e estatísticas por sensor",
        );
      }),
    );
  await Promise.all(tasks);
  return context;
}
module.exports = {
  loadCatalog,
  buildContext,
  sensorState,
  calculateStats,
  authorizeAccount,
};
