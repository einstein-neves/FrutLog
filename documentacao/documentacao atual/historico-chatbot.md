# Histórico de conversas

O botão Histórico no cabeçalho do assistente lista conversas com título e data da última mensagem. É possível reabrir uma conversa, iniciar outra ou excluir uma conversa com confirmação. Disponível nos painéis de administrador, engenheiro e técnico.

As conversas são salvas em localStorage neste navegador, separadas pelo ID do usuário e perfil. Não são sincronizadas entre dispositivos. Limpar os dados do site remove o histórico. São mantidas até 30 conversas e as últimas 100 mensagens de cada conversa. Falhas de armazenamento são informadas na interface sem impedir o envio de perguntas.

Reabrir recupera as mensagens e o identificador da conversa. A memória contextual do servidor permanece temporária: expira após 15 minutos sem uso, é isolada por token e pode ser perdida quando o servidor reinicia. Mensagens salvas no navegador não são enviadas como instruções ou contexto à IA. Após a expiração ou um novo login, informe novamente o assunto na pergunta.

Validação: `npm run test:chatbot` inclui persistência, isolamento por usuário, exclusão, limites e falhas de armazenamento, além dos testes de inteligência e permissões existentes.
