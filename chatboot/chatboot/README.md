# Chatbot FrutLog

O assistente web do painel Admin consulta `GET /api/chatbot/contexto` usando a sessão FrutLog já autenticada. A rota retorna as dez ocorrências mais recentes e o estado/leitura atual dos sensores da fazenda.

O script interativo `chatboot.py` pode incluir o mesmo contexto real nas respostas. Configure `FRUTLOG_API_URL` (por padrão `http://localhost:3000/api`) e `FRUTLOG_API_TOKEN` no ambiente local antes de iniciar o script. O token deve ser um JWT de sessão FrutLog válido, expira após oito horas e não deve ser salvo no repositório. A ausência do token é informada no contexto enviado ao modelo; falhas de consulta à API são exibidas explicitamente.

O script continua solicitando a chave Groq via entrada oculta. Não armazene chaves Groq, tokens FrutLog ou credenciais nos arquivos do projeto.
