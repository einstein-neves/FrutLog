const guides = require("../../documentacao/tutoriais-frutlog.json");
const { normalize } = require("./query");
const { isUserCountQuestion } = require("./counts");
const roleNames = {
  admin: "Administrador",
  engenheiro: "Engenheiro",
  tecnico: "Técnico",
};

function analyze(question) {
  const text = normalize(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const subjects = [];
  const patterns = {
    funcionario: /\b(funcionari|colaborador|usuarios?|pessoas?|equipe)/,
    sensor: /\b(sensor|sensores|dispositivo)/,
    talhao: /\b(talhao|talhoes|lote|terreno|parcela)/,
    mapa: /\bmapa/,
    area: /\b(area|hectare)/,
    plantio: /\b(plantio|plantar|safra)/,
    produto: /\bproduto/,
    cultura: /\b(cultura|cultivar|variedade)/,
    colheita: /\b(colheita|colher|producao|safra)/,
    relatorio: /\brelatorio/,
    inspecao: /\b(inspecao|inspecoes|vistoria)/,
    ocorrencia: /\bocorrencia/,
    praga: /\bpraga/,
    doenca: /\bdoenca/,
    problema: /\b(problema|falha)/,
    defeito: /\bdefeito/,
    telemetria: /\b(telemetria|leitura)/,
    temperatura: /\btemperatura/,
    umidade: /\bumidade/,
    chuva: /\bchuva/,
    grafico: /\bgrafico/,
    historico: /\bhistorico/,
    alerta: /\balerta/,
    tarefa: /\btarefa/,
    senha: /\bsenha/,
    login: /\blogin/,
    acesso: /\bacesso/,
    conta: /\bconta/,
    sair: /\b(sair|logout|deslogar)/,
  };
  for (const [subject, pattern] of Object.entries(patterns))
    if (pattern.test(text)) subjects.push(subject);
  const actions = [];
  const actionPatterns = {
    cadastrar:
      /\b(cadastr|cadastar|criar|adicionar|incluir|inserir|registr|lancar|salvar|anotar)/,
    consultar:
      /\b(ver|vejo|visualiz|consult|encontr|localiz|filtr|buscar|acompanhar|acessar|abrir|monitorar)/,
    editar: /\b(edit|corrig|ajust|atualiz|mover|arrast|redesenh)/,
    excluir: /\b(exclu|apag|delet|remov)/,
    ativar:
      /\b(ativar|ative|reativar|reative|habilitar|habilite)\b|\bcomo (eu )?ativo\b/,
    desativar:
      /\b(desativar|desative|inativar|desabilitar|bloquear)\b|\bcomo (eu )?desativo\b/,
    dividir: /\b(divid|separar|fatiar|desmembrar)/,
    associar: /\b(associ|vincul)/,
    enviar: /\benvi/,
    recuperar: /\b(esqueci|esquec|perdi|perdid|recuper|redefin|reset)/,
    entrar: /\b(entrar|entro|logar|login|primeiro acesso)/,
    sair: /\b(sair|saio|logout|deslogar|encerrar sessao)/,
    trocar: /\b(troc|mudar|alterar)/,
  };
  for (const [action, pattern] of Object.entries(actionPatterns))
    if (pattern.test(text)) actions.push(action);
  if (!actions.length && /\b(fazer|faco|montar|preencher)\b/.test(text))
    actions.push("cadastrar");
  if (actions.includes("trocar") && !subjects.includes("senha"))
    actions.push("editar");
  return { text, subjects, actions };
}

function isTutorialQuestion(question, previousId) {
  if (isUserCountQuestion(question)) return false;
  const { text, actions } = analyze(question);
  if (/^(quantos?|quantas?|qual o total|numero de|status|resumo)\b/.test(text))
    return false;
  if (
    /^como (esta|estao|anda|andam|evoluiu|variou|ficou|se comportou)\b/.test(
      text,
    )
  )
    return false;
  if (/^como\b/.test(text) || /\b(esqueci|perdi)\b.*\bsenha\b/.test(text))
    return true;
  if (
    /\b(tutorial|passo a passo|me ensina|me ensine|me ajuda|me ajude|preciso de ajuda|o que (posso|consigo) fazer|quais (tutoriais|funcoes|funcionalidades))\b/.test(
      text,
    )
  )
    return true;
  if (/^(ajuda|tutoriais|tutorial)$/.test(text)) return true;
  if (
    actions.length &&
    /\b(como|onde|quero|preciso|gostaria|posso|consigo|poderia|qual|pra|para)\b/.test(
      text,
    )
  )
    return true;
  if (
    /^(cadastrar|cadastre|criar|adicionar|registrar|registre|excluir|exclua|apagar|deletar|remover|editar|ativar|desativar|dividir|enviar|trocar)\b/.test(
      text,
    )
  )
    return true;
  return Boolean(
    previousId &&
    /^(e |e$|isso|esse|essa|o mesmo|a mesma)/.test(text) &&
    actions.length,
  );
}

function findTutorials(question, role, previousId) {
  const input = analyze(question);
  const previous = guides.find((g) => g.id === previousId);
  let subjects = input.subjects;
  if (
    !subjects.length &&
    previous &&
    /^(e |e$|isso|esse|essa|o mesmo|a mesma)/.test(input.text)
  )
    subjects = previous.subjects;
  // Nomes de perfis citados não alteram a identidade autenticada.
  const ranked = guides
    .map((guide) => {
      const subjectHits = guide.subjects.filter((s) =>
        subjects.includes(s),
      ).length;
      const actionHits = guide.actions.filter((a) =>
        input.actions.includes(a),
      ).length;
      if (!subjectHits || (input.actions.length && !actionHits)) return null;
      if (
        guide.subjects.includes("problema") &&
        !subjects.includes("problema") &&
        !subjects.includes("defeito")
      )
        return null;
      // Senha e problema de sensor são operações específicas, não cadastros genéricos.
      if (subjects.includes("senha") && !guide.subjects.includes("senha"))
        return null;
      if (
        (subjects.includes("problema") || subjects.includes("defeito")) &&
        subjects.includes("sensor") &&
        !guide.subjects.includes("problema")
      )
        return null;
      return {
        guide,
        score:
          subjectHits * 10 +
          actionHits * 4 +
          (guide.roles.includes(role) ? 2 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.guide.id.localeCompare(b.guide.id));
  return ranked;
}

function tutorialResponse(question, role, previousId) {
  const ranked = findTutorials(question, role, previousId);
  if (!ranked.length) {
    const input = analyze(question);
    const related = guides.filter(
      (g) =>
        g.roles.includes(role) &&
        (!input.subjects.length ||
          g.subjects.some((s) => input.subjects.includes(s))),
    );
    const list = (
      related.length ? related : guides.filter((g) => g.roles.includes(role))
    ).slice(0, 8);
    return {
      tipo: "tutorial",
      tutorialId: null,
      links: [],
      resposta: `Posso explicar os passos das funções existentes no FrutLog. ${input.subjects.length ? "Não encontrei um tutorial para essa operação exata; não vou inventar um botão ou procedimento. " : ""}Escolha uma tarefa ou diga o que deseja fazer:\n${list.map((g) => `• ${g.title}`).join("\n")}`,
    };
  }
  const first = ranked[0];
  const tied = ranked.filter(
    (r) => r.score === first.score && r.guide.roles.includes(role),
  );
  if (tied.length > 1) {
    return {
      tipo: "tutorial",
      tutorialId: null,
      links: [],
      resposta: `Qual destas tarefas você quer aprender?\n${tied
        .slice(0, 6)
        .map(({ guide }) => `• ${guide.title}`)
        .join("\n")}`,
    };
  }
  const guide = first.guide;
  if (!guide.roles.includes(role))
    return {
      tipo: "tutorial",
      tutorialId: guide.id,
      links: [],
      resposta: `**${guide.title}**\nEssa função é realizada pelo perfil ${guide.roles.map((r) => roleNames[r]).join(" ou ")}. Sua sessão atual é de ${roleNames[role]}. Solicite a operação ao responsável com esse perfil; esse recurso não aparece no seu painel.`,
    };
  const destination = guide.destinations?.[role];
  return {
    tipo: "tutorial",
    tutorialId: guide.id,
    resposta: `**${guide.title}**\nPerfil: ${roleNames[role]}.\n\n${guide.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n\n${guide.notes.map((note) => `• ${note}`).join("\n")}`,
    links: destination
      ? [{ label: "Abrir a seção do tutorial", href: destination }]
      : [],
    fontes: [`Tutorial do FrutLog: ${guide.title}`],
  };
}
module.exports = {
  guides,
  analyze,
  isTutorialQuestion,
  findTutorials,
  tutorialResponse,
};
