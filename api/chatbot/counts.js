const { normalize, periodFor } = require("./query");

function isUserCountQuestion(question) {
  const text = normalize(question);
  return (
    /\b(quantos?|quantas?|quantidade|total|numero|contagem)\b/.test(text) &&
    /\b(funcion\w*|colaborador\w*|usuari\w*|equipe|tecnic\w*|engenheir\w*|administrador\w*)\b/.test(
      text,
    ) &&
    !/\b(sensor|talhao|talhoes|relatorio|ocorrencia|inspecao|colheita)s?\b/.test(
      text,
    )
  );
}

async function answerUserCount(repo, actor, question, now) {
  const text = normalize(question);
  const period = periodFor(question, now);
  const sources = ["Cadastro de funcionários da organização"];
  if (period.error) return { resposta: period.error, fontes: [], avisos: [] };
  if (!period.explicito && /\b(ano|anos|meses|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|20\d{2})\b/.test(text)) {
    return { resposta: "Para contar cadastros em um período, informe as datas de início e fim, com um intervalo de até 90 dias.", fontes: [], avisos: [] };
  }
  if (
    (period.explicito ||
      /\b(antes|passado|passada|estavam|eram)\b/.test(text)) &&
    !/cadastr|criad|adicion|registrad/.test(text)
  ) {
    return {
      resposta:
        "Posso contar as contas no estado atual ou as cadastradas em um período. Não há histórico de mudanças de status para afirmar quantas estavam ativas no passado. Você quer o total atual ou as contas cadastradas entre quais datas?",
      fontes: [],
      avisos: [],
    };
  }
  let query = `organizacao_id=eq.${encodeURIComponent(actor.organizacao_id)}&select=id`;
  if (period.explicito)
    query += `&criado_em=gte.${encodeURIComponent(period.desde)}&criado_em=lt.${encodeURIComponent(period.ate)}`;
  const profiles = [];
  if (/\btecnic/.test(text)) profiles.push("tecnico");
  if (/\bengenheir/.test(text)) profiles.push("engenheiro");
  if (/\badministrador/.test(text)) profiles.push("admin", "administrador");
  if (profiles.length) query += `&perfil=in.(${profiles.join(",")})`;
  const inactive = /\b(inativ\w*|desativ\w*)\b/.test(text);
  const active = !inactive && /\bativ\w*\b/.test(text);
  if (inactive || active)
    query += `&status=eq.${inactive ? "inativo" : "ativo"}`;
  try {
    const total = await repo.count("usuario", query);
    const profileLabel = profiles.length
      ? profiles.includes("tecnico") && profiles.length === 1
        ? "técnicos"
        : profiles.includes("engenheiro") && profiles.length === 1
          ? "engenheiros"
          : profiles.every((p) => ["admin", "administrador"].includes(p))
            ? "administradores"
            : "usuários dos perfis informados"
      : "contas de funcionários";
    const status = inactive ? " inativos" : active ? " ativos" : "";
    const date = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Fortaleza",
      dateStyle: "short",
      timeStyle: "short",
    }).format(now);
    return {
      resposta: `Total de ${profileLabel}${status}: **${total}** nesta organização.${period.explicito ? `\nCadastro no período de ${period.inicio} a ${period.fim}.` : ""}${!profiles.length ? "\nA contagem inclui as contas de administradores, engenheiros e técnicos que correspondem ao filtro." : ""}\n\nConsulta: ${date} (Fortaleza). Fonte: cadastro de funcionários.`,
      fontes: sources,
      avisos: [],
      total,
    };
  } catch {
    return {
      resposta:
        "Não consegui consultar a quantidade de funcionários no banco agora. Isso não significa que o total seja zero. Tente novamente em instantes.",
      fontes: [],
      avisos: ["Contagem de funcionários temporariamente indisponível."],
      total: null,
    };
  }
}
module.exports = { isUserCountQuestion, answerUserCount };
