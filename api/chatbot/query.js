function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function today(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function shift(day, amount) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function validDay(day) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
  );
}
function periodFor(question, now = new Date()) {
  const q = normalize(question);
  const day = today(now);
  const dates = [
    ...q.matchAll(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/g),
  ].map(([date]) =>
    date.includes("/") ? date.split("/").reverse().join("-") : date,
  );
  let start,
    end,
    explicit = true;
  if (dates.length) {
    if (dates.length > 2 || dates.some((d) => !validDay(d)))
      return {
        error:
          "Informe uma data válida ou um intervalo com duas datas, por exemplo 01/10/2026 a 07/10/2026.",
      };
    [start, end] = [dates[0], dates[1] || dates[0]];
  } else if (/\bontem\b/.test(q) && /\bhoje\b/.test(q)) {
    start = /compar/.test(q) ? day : shift(day, -1);
    end = day;
  } else if (/\bontem\b/.test(q)) start = end = shift(day, -1);
  else if (/\bhoje\b/.test(q)) start = end = day;
  else if (/(nesta|essa|esta) semana/.test(q)) {
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    start = shift(day, -weekday);
    end = day;
  } else if (/semana passada/.test(q)) {
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    start = shift(day, -weekday - 7);
    end = shift(start, 6);
  } else if (/mes passado/.test(q)) {
    end = shift(`${day.slice(0, 7)}-01`, -1);
    start = `${end.slice(0, 7)}-01`;
  } else if (/(neste|esse|este) mes/.test(q)) {
    start = `${day.slice(0, 7)}-01`;
    end = day;
  } else {
    const days = q.match(/ultim[oa]s?\s+(\d+)\s+dias?/);
    const count = days
      ? Number(days[1])
      : /ultima semana/.test(q)
        ? 7
        : /ultimo mes/.test(q)
          ? 30
          : 7;
    if (count < 1 || count > 90)
      return {
        error:
          "Consigo analisar de 1 a 90 dias por consulta. Qual intervalo você deseja?",
      };
    explicit = Boolean(days || /ultima semana|ultimo mes/.test(q));
    start = shift(day, 1 - count);
    end = day;
  }
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days < 1 || days > 90)
    return {
      error: "Informe um intervalo em ordem cronológica de até 90 dias.",
    };
  const period = {
    inicio: start,
    fim: end,
    dias: days,
    explicito: explicit,
    timezone: "America/Fortaleza",
    desde: `${start}T00:00:00-03:00`,
    ate: `${shift(end, 1)}T00:00:00-03:00`,
  };
  if (
    /compar/.test(q) ||
    (/(nesta|essa|esta) semana/.test(q) && /semana passada/.test(q))
  ) {
    const previousStart = shift(start, -days);
    const previousEnd = shift(start, -1);
    period.comparar_com = {
      inicio: previousStart,
      fim: previousEnd,
      desde: `${previousStart}T00:00:00-03:00`,
      ate: period.desde,
    };
    if (/(nesta|essa|esta) semana/.test(q) && /semana passada/.test(q)) {
      period.comparar_com.inicio = shift(start, -7);
      period.comparar_com.desde = `${shift(start, -7)}T00:00:00-03:00`;
    }
  }
  return period;
}

function mentions(question, value) {
  const escaped = normalize(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    Boolean(escaped) &&
    new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(
      normalize(question),
    )
  );
}

function planQuestion(question, catalog, previous, now = new Date()) {
  const q = normalize(question);
  const followup =
    /^(e\b|eles\b|elas\b)|\b(dele|dela|deles|delas|nesse|nessa|mesmo talhao|mesmo sensor)\b/.test(
      q,
    );
  const plots = catalog.plots.filter(
    (p) => mentions(q, p.codigo) || mentions(q, p.nome),
  );
  const sensors = catalog.sensors.filter((s) => mentions(q, s.id_externo));
  const unknownPlot = q
    .match(/\b(?:talhao\s+)?t[-_]?\d+\b/g)
    ?.find((code) => !catalog.plots.some((p) => mentions(code, p.codigo)));
  if (unknownPlot)
    return {
      clarification: `Não encontrei o talhão ${unknownPlot.toUpperCase()} nos dados autorizados. Confirme o código.`,
    };
  const explicitPeriod = periodFor(question, now);
  if (explicitPeriod.error) return { clarification: explicitPeriod.error };
  if (
    !explicitPeriod.explicito &&
    /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b|ultim[oa]s?\s+\d+\s+(meses|semanas|anos)/.test(
      q,
    )
  ) {
    return {
      clarification:
        "Informe as datas de início e fim (até 90 dias), para eu consultar o período correto.",
    };
  }
  if (
    /\b(ano passado|este ano|neste ano|\d{4})\b/.test(q) &&
    !/colheit|safra/.test(q) &&
    !explicitPeriod.explicito
  ) {
    return {
      clarification:
        "Para consultar o histórico, informe um intervalo de até 90 dias, com as datas de início e fim.",
    };
  }
  if (
    /\bsensor\s+\S+/.test(q) &&
    !sensors.length &&
    !/\bsensor\s+(esta|do|da|de|sem|offline|online|inativo|com|que|e|no|na)\b/.test(
      q,
    )
  ) {
    const code = q.match(/\bsensor\s+([\w-]+)/)?.[1];
    if (code && /\d/.test(code))
      return {
        clarification: `Não encontrei o sensor ${code} nos dados autorizados. Confirme o identificador.`,
      };
  }
  const hasScope = plots.length || sensors.length;
  const plotIds = plots.map((p) => p.id);
  const sensorIds = sensors.map((s) => s.id);
  const metrics = [];
  if (/temperatura/.test(q)) metrics.push("temperatura");
  if (/umidade.{0,8}solo/.test(q)) metrics.push("umidadeSolo");
  if (/umidade.{0,8}ar/.test(q)) metrics.push("umidadeAr");
  if (/chuva|precipitacao/.test(q)) metrics.push("chuva");
  if (/umidade/.test(q) && !metrics.some((m) => m.startsWith("umidade"))) {
    const possible = [
      ...new Set(
        sensors
          .map((s) => s.codigo_metrica)
          .filter((m) => m.startsWith("umidade")),
      ),
    ];
    if (possible.length === 1) metrics.push(possible[0]);
    else
      return {
        clarification:
          "Você quer consultar a umidade do solo ou a umidade do ar? Informe também o talhão ou sensor, se desejar.",
      };
  }
  const metric = metrics.length === 1 ? metrics[0] : null;
  const history =
    /aument|diminu|tendencia|historico|media|maxim|minim|compar|evolu|variacao/.test(
      q,
    ) || explicitPeriod.explicito;
  const topics = [];
  for (const [topic, regex] of Object.entries({
    sensores: /sensor|leitura|temperatura|umidade|chuva|offline|online|sinal/,
    ocorrencias: /ocorrencia/,
    inspecoes: /inspec/,
    problemas: /problema/,
    alertas: /alerta/,
    plantios: /planti|cultura|cultiv/,
    colheitas: /colheit|safra/,
    usuarios: /usuario|funcionario|equipe|perfil/,
  }))
    if (regex.test(q)) topics.push(topic);
  const knowledgeOnly =
    /como\s+(funciona|cadastr|registr|acess|usar|alter|criar)|onde\s+(fica|posso|cadastr|registr|acess)|menu|tela|botao|permiss/.test(
      q,
    ) &&
    !/quant|status|resumo|offline|online|aument|dimin|media|alertas abertos/.test(
      q,
    );
  if (!topics.length && followup && previous) topics.push(...previous.topics);
  const scopePlots = hasScope
    ? plotIds
    : followup
      ? previous?.plotIds || []
      : [];
  const scopeSensors = hasScope
    ? sensorIds
    : followup
      ? previous?.sensorIds || []
      : [];
  return {
    topics,
    plotIds: scopePlots,
    sensorIds: scopeSensors,
    metric: metric || (followup ? previous?.metric : null),
    metrics: metrics.length ? metrics : followup ? previous?.metrics || [] : [],
    period:
      !explicitPeriod.explicito && followup && previous?.period
        ? previous.period
        : explicitPeriod,
    history: history || Boolean(followup && previous?.history),
    knowledgeOnly,
    years: /colheit|safra/.test(q)
      ? [
          ...new Set(
            [...q.matchAll(/\b(20\d{2})\b/g)]
              .map((m) => Number(m[1]))
              .concat(
                /ano passado/.test(q)
                  ? [Number(today(now).slice(0, 4)) - 1]
                  : [],
              )
              .concat(
                /(este|neste|deste) ano/.test(q)
                  ? [Number(today(now).slice(0, 4))]
                  : [],
              ),
          ),
        ]
      : [],
    status: /offline|sem sinal|desconectad/.test(q)
      ? "Offline"
      : /\bonline\b/.test(q)
        ? "Online"
        : /inativ/.test(q)
          ? "Inativo"
          : null,
  };
}
module.exports = { normalize, mentions, periodFor, planQuestion, shift };
