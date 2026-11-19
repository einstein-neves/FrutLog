const crypto = require("crypto");
function createConversations({
  maximum = 1000,
  ttl = 15 * 60 * 1000,
  clock = Date.now,
} = {}) {
  const sessions = new Map();
  return {
    open(authorization, userId, conversationId) {
      const now = clock();
      for (const [key, session] of sessions)
        if (session.expires <= now && !session.busy) sessions.delete(key);
      const key = crypto
        .createHash("sha256")
        .update(`${authorization}\0${userId}\0${conversationId}`)
        .digest("hex");
      let session = sessions.get(key);
      if (session?.busy) {
        const error = new Error(
          "Aguarde a resposta anterior antes de enviar outra pergunta.",
        );
        error.status = 429;
        throw error;
      }
      if (!session) {
        if (sessions.size >= maximum) {
          const oldest = [...sessions].find(([, value]) => !value.busy);
          if (oldest) sessions.delete(oldest[0]);
          else {
            const error = new Error(
              "Assistente ocupado. Tente novamente em instantes.",
            );
            error.status = 503;
            throw error;
          }
        }
        session = { messages: [], plan: null };
        sessions.set(key, session);
      }
      session.busy = true;
      session.expires = now + ttl;
      return session;
    },
    close(session, question, answer, plan) {
      session.messages.push(
        { role: "user", content: question },
        { role: "assistant", content: answer.slice(0, 3000) },
      );
      session.messages = session.messages.slice(-6);
      if (plan) session.plan = plan;
      session.busy = false;
    },
    release(session) {
      session.busy = false;
    },
  };
}
module.exports = { createConversations };
