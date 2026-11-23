- Como limpar esse conflito e ficar com a versão atualizada do GitHub
git reset --hard origin/main
git stash clear

• Auditoria geral de segurança:bash
node testes/seguranca/auditoria.cjs
Use o código com cuidado.

• Testes de sessões, relatórios HTTP e recuperação de conta (Segurança):bash
node testes/seguranca/sessoes.test.cjs
node testes/seguranca/relatorios-http.test.cjs
node testes/seguranca/recuperacao-banco.test.cjs
node testes/seguranca/recuperacao-interface.test.cjs
Use o código com cuidado.

• Testes de E-mail e Inteligência do Chatbot:bash
node testes/email/conta-criada.test.cjs
node testes/chatbot/intelligence.test.cjs