# Correções de sessão e limite de login — 17/11/2026

## Comportamento

- Toda requisição autenticada, inclusive GET e a rota modular /api/relatorios, consulta o cadastro do usuário. Conta excluída/inativa ou perfil diferente do token recebe 401 antes de acessar dados operacionais.
- Cada token contém `sv`, um HMAC com segredo do servidor vinculado ao ID e ao hash atual da senha. O hash da senha não é incluído no token nem nas respostas. Qualquer troca de hash, pelo painel, alteração de senha, script administrativo ou SQL, invalida os tokens anteriores na próxima requisição. Não depende de memória de um processo ou de uma migração no banco.
- A senha provisória é conferida no cadastro atual. Enquanto estiver ativa, somente POST /api/alterar-senha é autorizado entre as rotas de sessão. O bloqueio também cobre chatbot e análise operacional.
- A alteração de senha devolve um token novo, vinculado ao novo hash, mantendo o fluxo do frontend. Tokens emitidos antes desta atualização não possuem `sv` e são recusados: os usuários precisarão entrar novamente uma vez após a implantação.
- Se o banco não estiver acessível, a API nega o acesso em vez de confiar apenas no token.

## IP e proxies

Por padrão, o servidor Express ignora X-Forwarded-For e o limite de requisições usa o IP da conexão. O handler HTTP direto também usa o socket e não lê cabeçalhos de IP manualmente. Endereços IPv4 mapeados em IPv6 são normalizados para a mesma chave.

Quando existir um proxy reverso conhecido, configurar `TRUSTED_PROXIES` com uma lista de IPs/CIDRs reais desse proxy, separados por vírgula. Exemplo apenas para um proxy local: `TRUSTED_PROXIES=127.0.0.1/32,::1/128`. Não copiar esse exemplo sem corresponder à infraestrutura. Valores booleanos, número de saltos, nomes genéricos e redes /0 são recusados.

O Express valida a cadeia a partir do socket e considera apenas os proxies explicitamente confiáveis, conforme a [documentação oficial](https://expressjs.com/en/guide/behind-proxies/). O proxy deve anexar/substituir corretamente o IP real, e a lista de confiança deve ser limitada à infraestrutura administrada. O .env existente não foi alterado.

Em implantação atrás de proxy sem configuração, o limite será compartilhado pelo IP do proxy, podendo bloquear usuários diferentes. A configuração acima é para src/server.js; adaptar plataformas que chamem diretamente o handler exige integração específica com o IP validado da plataforma. Não habilitar confiança genérica para corrigir isso.

O limite continua local ao processo, com janela de um minuto, limpeza periódica e teto de memória. A correção fecha o contorno por cabeçalho forjado; múltiplas instâncias/reinícios e ataques distribuídos precisam de limite compartilhado ou proteção na borda. Logout continua removendo a sessão no navegador; esta mudança não implementa lista de revogação individual por logout.

## Validação

`npm run test:seguranca`: oito testes de integração HTTP com banco simulado, incluindo bloqueio/exclusão/perfil, reset pelo painel e troca de senha, alteração direta do hash, senha temporária, token legado/adulterado, falha do banco, IP forjado e proxy confiável. Nenhum serviço real é chamado.

`npm run teste` e `npm run test:chatbot` verificam os fluxos operacionais existentes e os 27 testes do chatbot/histórico com as novas sessões.

Os demais problemas apontados na auditoria, como isolamento por organização, credenciais versionadas, MQTT sem TLS e detalhes internos em erros, permanecem fora desta correção.
