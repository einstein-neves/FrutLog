const { createRepository } = require("./repository");
const { loadCatalog, buildContext, authorizeAccount } = require("./context");
const { isTutorialQuestion, tutorialResponse } = require("./tutorials");
const { planQuestion } = require("./query");
const { createConversations } = require("./conversations");
const { generateAnswer } = require("./provider");
const { isUserCountQuestion, answerUserCount } = require("./counts");

function createChatbot({
  repository = createRepository,
  conversations = createConversations(),
  generate = generateAnswer,
  clock = () => new Date(),
} = {}) {
  return async function ask({
    config,
    user,
    authorization,
    conversationId = "principal",
    question,
  }) {
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000
    ) {
      const error = new Error("Digite uma pergunta de até 1.000 caracteres.");
      error.status = 400;
      throw error;
    }
    if (
      typeof conversationId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(conversationId)
    ) {
      const error = new Error("Identificador de conversa inválido.");
      error.status = 400;
      throw error;
    }
    const session = conversations.open(authorization, user.sub, conversationId);
    try {
      const now = clock(),
        repo = repository(config);
      if (isUserCountQuestion(question)) {
        const actor = await authorizeAccount(repo, user.sub);
        if (user.perfil !== "admin" || actor.perfil !== "admin") {
          const error = new Error(
            "A contagem de funcionários é restrita ao Administrador. Neste perfil, posso orientar sobre o uso do sistema.",
          );
          error.status = 403;
          throw error;
        }
        const result = await answerUserCount(repo, actor, question, now);
        session.tutorialId = null;
        session.plan = null;
        conversations.close(session, question, result.resposta, null);
        return {
          ...result,
          tipo: "contagem",
          conversationId,
          consultado_em: now.toISOString(),
        };
      }
      if (isTutorialQuestion(question, session.tutorialId)) {
        const actor = await authorizeAccount(repo, user.sub);
        const result = tutorialResponse(
          question,
          actor.perfil,
          session.tutorialId,
        );
        session.tutorialId = result.tutorialId;
        session.plan = null;
        conversations.close(session, question, result.resposta, null);
        return {
          ...result,
          conversationId,
          consultado_em: now.toISOString(),
          avisos: [],
        };
      }
      if (user.perfil !== "admin") {
        const error = new Error(
          "Neste perfil, o assistente orienta sobre o uso do sistema. Pergunte, por exemplo, como registrar uma inspeção ou consultar a telemetria. As consultas operacionais completas são restritas ao Administrador.",
        );
        error.status = 403;
        throw error;
      }
      if (!config.deepseekApiKey) {
        const error = new Error(
          "As respostas por IA ainda não estão configuradas. Os tutoriais de uso continuam disponíveis: pergunte como realizar uma tarefa.",
        );
        error.status = 503;
        throw error;
      }
      session.tutorialId = null;
      const catalog = await loadCatalog(repo, user.sub);
      const plan = planQuestion(question, catalog, session.plan, now);
      let answer, context;
      if (plan.clarification) answer = plan.clarification;
      else {
        const namedSensors = catalog.sensors.filter((s) =>
          plan.sensorIds.includes(s.id),
        );
        const deviceById = new Map(catalog.devices.map((d) => [d.id, d]));
        const matchingSensors = namedSensors.filter(
          (s) =>
            !plan.plotIds.length ||
            plan.plotIds.includes(deviceById.get(s.dispositivo_id)?.talhao_id),
        );
        if (namedSensors.length && !matchingSensors.length)
          answer =
            "Esse sensor não pertence ao talhão informado. Confirme o sensor ou o talhão.";
        else if (
          matchingSensors.length > 1 &&
          new Set(matchingSensors.map((s) => s.id_externo)).size <
            matchingSensors.length
        )
          answer =
            "Há mais de um sensor com esse identificador. Informe também o talhão para identificar o sensor correto.";
        else {
          context = await buildContext(repo, catalog, plan, {
            now,
            staleMinutes: config.chatbotStaleMinutes || 15,
          });
          answer = await generate(config, question, context, session.messages);
          const localDate = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Fortaleza",
            dateStyle: "short",
            timeStyle: "short",
          }).format(now);
          if (context.fontes.length)
            answer += `\n\nConsulta: ${localDate} (Fortaleza). Fontes: ${context.fontes.join("; ")}.`;
          if (context.avisos.length)
            answer += `\n\nLimitações: ${context.avisos.join(" ")}`;
        }
      }
      conversations.close(
        session,
        question,
        answer,
        plan.clarification ? null : plan,
      );
      return {
        resposta: answer,
        conversationId,
        consultado_em: context?.consultado_em || now.toISOString(),
        fontes: context?.fontes || [],
        avisos: context?.avisos || [],
      };
    } finally {
      conversations.release(session);
    }
  };
}
module.exports = { createChatbot };
