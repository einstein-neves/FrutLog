document.addEventListener("DOMContentLoaded", () => {
  const sessao = FrutLog.obterSessao();
  if (sessao?.perfil !== "admin" || document.getElementById("painel-chatbot")) return;
  const sugestoes = {
    admin: [
      "Como cadastrar um funcionário?",
      "Como cadastrar um sensor?",
      "Como registrar uma colheita?",
      "Quais tutoriais estão disponíveis?",
    ],
    engenheiro: [
      "Como criar um talhão?",
      "Como cadastrar um plantio?",
      "Como dividir um talhão?",
      "Como consultar relatórios?",
    ],
    tecnico: [
      "Como registrar uma inspeção?",
      "Como registrar uma ocorrência?",
      "Como enviar o relatório diário?",
      "Como registrar problema no sensor?",
    ],
  };
  if (!sugestoes[sessao.perfil]) return;
  const simbolo = `<svg class="chatbot-simbolo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-5 3v-3a3 3 0 0 1-3-3V8a4 4 0 0 1 4-4Z"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.6"/></svg>`;
  const container = document.createElement("div");
  container.className = "assistente-frutlog";
  container.innerHTML = `
    <section id="painel-chatbot" class="painel-chatbot" aria-label="Assistente FrutLog" hidden>
      <header class="cabecalho-chatbot">
        <div class="chatbot-identidade">
          <span class="chatbot-avatar" aria-hidden="true">${simbolo}</span>
          <div><strong>Assistente FrutLog</strong><span>Aprenda a usar o seu painel</span></div>
        </div>
        <div class="acoes-cabecalho-chatbot">
          <button id="fechar-chatbot" type="button" aria-label="Fechar assistente"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </header>
      <nav class="navegacao-chatbot" aria-label="Conversas do assistente">
        <button id="abrir-historico-chatbot" type="button" aria-expanded="false" aria-controls="historico-chatbot"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>Conversas</span></button>
        <button id="nova-conversa-chatbot" type="button"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>Nova conversa</span></button>
      </nav>
      <div id="conversa-atual-chatbot" class="conversa-atual-chatbot">Nova conversa</div>
      <section id="historico-chatbot" class="historico-chatbot" aria-label="Histórico de conversas" hidden>
        <div class="titulo-historico-chatbot"><strong>Suas conversas</strong><button id="voltar-conversa-chatbot" type="button">Voltar ao chat</button></div>
        <p>Escolha uma conversa para continuar de onde parou.</p>
        <label class="sr-only" for="buscar-conversa-chatbot">Buscar conversas</label>
        <input id="buscar-conversa-chatbot" type="search" placeholder="Buscar conversa…" autocomplete="off">
        <div id="lista-historico-chatbot"></div>
        <details class="detalhes-historico-chatbot"><summary>Sobre o histórico</summary><p>Salvo apenas neste navegador: até 30 conversas e 100 mensagens por conversa. Após 15 minutos sem uso ou um novo login, informe novamente o assunto à IA.</p></details>
      </section>
      <p id="aviso-historico-chatbot" class="aviso-historico-chatbot" role="status" hidden></p>
      <div id="mensagens-chatbot" class="mensagens-chatbot" aria-live="polite">
        <article class="mensagem-chatbot resposta"><span class="autor-mensagem">FrutLog</span><div class="conteudo-mensagem">Olá! Pergunte como realizar uma tarefa no sistema. Vou mostrar os passos e indicar a seção do seu painel.</div></article>
        <div class="sugestoes-chatbot" aria-label="Perguntas sugeridas"></div>
      </div>
      <form id="form-chatbot" class="form-chatbot">
        <label class="sr-only" for="pergunta-chatbot">Sua pergunta</label>
        <textarea id="pergunta-chatbot" name="pergunta" maxlength="1000" rows="1" autocomplete="off" placeholder="Como faço para…" required></textarea>
        <button type="submit" aria-label="Enviar pergunta"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span>Enviar</span></button>
      </form>
      <p class="rodape-chatbot">Tutoriais das funções do FrutLog. Você realiza as ações na tela.</p>
    </section>
    <button id="chatbot" class="chatbot" type="button" aria-label="Abrir assistente" aria-expanded="false" aria-controls="painel-chatbot">${simbolo}</button>`;
  for (const texto of sugestoes[sessao.perfil]) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "sugestao-chatbot";
    botao.textContent = texto;
    container.querySelector(".sugestoes-chatbot").append(botao);
  }
  document.body.append(container);
});
