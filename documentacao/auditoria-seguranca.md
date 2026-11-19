# Auditoria de segurança — 16/11/2026

Atualização em 17/11/2026: os achados 3 (leituras após bloqueio), 4 (tokens após reset), 5 (IP forjado no limitador) e 7 (senha provisória) foram corrigidos no código local. A rota modular /api/relatorios também recebeu validação de sessão. Ao adicionar contatos individuais para notificações, a listagem, criação e alteração/exclusão de funcionários foram limitadas à organização do administrador, corrigindo essa parte do achado 2; outras rotas operacionais ainda precisam da revisão de isolamento. O texto abaixo preserva as evidências da revisão original. Ver [implementação, implantação e testes](seguranca-sessoes.md). Os demais achados permanecem pendentes. O script de auditoria foi atualizado para confirmar as correções e continuar reproduzindo os achados restantes.

Revisão do código local, arquivos versionados, SQL de instalação e dependências. Não foi um teste de invasão contra produção. Nenhum segredo foi impresso ou enviado a serviços; a validade das credenciais e as permissões do banco real não foram verificadas. As reproduções usam dados fictícios e substituem integralmente o acesso à rede.

## Prioridade imediata

### 1. Alta: credenciais de IoT versionadas

`hardware/IOT ESP32/sketch_sep14a/arduino_secrets.h:1` contém SSID e valores de credenciais MQTT, incluindo senha. Há outras cópias em `tmp/incoming-frutlog/IOT ESP32/sketch_sep14a/arduino_secrets.h`. Ambos são rastreados pelo Git. Não foram reproduzidos os valores neste relatório e não foi testado se ainda funcionam.

Impacto: se válidas, as credenciais podem permitir acesso ao broker e publicação/alteração de telemetria conforme seus privilégios. Acesso ao Wi-Fi depende de alcance à rede e de a senha ainda ser válida.

Correção: revogar/substituir credenciais expostas no serviço de origem, criar credenciais individuais com privilégio mínimo, manter apenas um arquivo de exemplo com placeholders e ignorar os arquivos reais, inclusive as cópias em tmp. Remover do commit atual não remove a exposição no histórico do Git. Avaliar limpeza do histórico depois da rotação, coordenando com os colaboradores.

### 2. Alta: ausência de isolamento por organização em leituras e alterações

`api/database.js:33` escolhe a primeira organização do banco, sem receber a identidade do usuário. Várias rotas também consultam tabelas globalmente: `api/[...route].js:1301` (inspeções), `:1364` (alertas), `:2012` (funcionários). A edição/exclusão de funcionário em `:1954` localiza o alvo apenas pelo ID.

O backend usa chave privilegiada do Supabase. Essa chave ignora RLS; portanto, ativar RLS nas tabelas não compensa a falta de autorização nas consultas da API.

Reprodução local: admin da organização A recebeu um funcionário da B em GET /funcionarios e conseguiu executar DELETE /funcionarios/usuario-org-B. As consultas não continham condição de organização. O impacto entre organizações depende de existir mais de uma, mas a ausência da barreira está confirmada.

Correção: obter organizacao_id do cadastro autenticado; exigir esse escopo em todas as leituras e mutações, inclusive por relações fazenda/talhão/dispositivo. Autorizar tanto o ator quanto o registro alvo antes da operação. Testar dois usuários de organizações diferentes. Não aceitar organização enviada pelo navegador como prova de autorização.

### 3. Alta: bloqueio ou mudança de perfil não revoga acesso de leitura

`api/[...route].js:372` revalida status e perfil no banco apenas quando o método não é GET. Um token assinado continua liberando leituras depois que a conta é bloqueada, excluída ou perde privilégios. O token dura oito horas (`api/session.js:17`).

Reprodução local: GET /funcionarios retornou 200 sem consultar o cadastro do ator, mesmo com banco simulado configurado para retornar a conta como inativa. Um antigo administrador pode manter acesso à listagem de funcionários.

Correção: centralizar a revalidação de conta em todos os métodos protegidos. Tratar exclusão, inativação e alteração de perfil como revogação imediata.

### 4. Alta: redefinição de senha não invalida tokens anteriores

`api/session.js` não usa versão de sessão nem identificador revogável. `api/[...route].js:1995` redefine senha e ativa senha_temporaria, mas a consulta da sessão em `:378` não lê esse campo. O bloqueio em `:605` depende do valor antigo incluído no token.

Reprodução local: token emitido com mustChangePassword=false chegou à validação de POST /plantios (400 por dados incompletos), embora o cadastro simulado estivesse com senha_temporaria=true. Isso confirma que uma sessão anterior ao reset não é bloqueada pelo estado atual da senha. A troca de senha e o logout também não possuem revogação do token no servidor; o logout apenas remove dados do navegador.

Correção: versionar sessões por usuário ou manter sessões revogáveis. Incrementar a versão em reset/troca de senha, inativação e revogação; verificar a versão em todas as rotas. Consultar senha_temporaria atual no servidor.

### 5. Alta em acesso direto ao Node: limitador confia em IP enviado pelo cliente

`api/[...route].js:108` utiliza o primeiro valor de X-Forwarded-For sem validar a cadeia de proxies. `src/server.js` não implementa uma fronteira de confiança para essa leitura manual.

Reprodução local: depois de 10 tentativas de login, a próxima retornou 429; trocar somente X-Forwarded-For fez a tentativa chegar novamente ao login (401). A falsificação também pode alterar a chave do limite do chatbot.

Correção: no acesso direto, usar o IP do socket. Atrás de proxy, configurar explicitamente os proxies confiáveis e impedir acesso direto ao backend; usar a identidade de IP validada. Complementar com limites por conta/usuário, concorrência e armazenamento compartilhado entre instâncias. Em hospedagem que substitua o cabeçalho por valor confiável, a exploração depende dessa configuração; ela não foi verificada.

### 6. Alta em rede interceptável: MQTT sem TLS

`hardware/IOT ESP32/sketch_sep14a/sketch_sep14a.ino:21` configura porta 1883 e `:30` usa WiFiClient. Não há transporte TLS no cliente MQTT mostrado.

Impacto: alguém com capacidade de observar o tráfego no caminho pode capturar credenciais e telemetria. Com capacidade de interferência no tráfego, pode afetar a integridade da comunicação. Isso agrava o problema das credenciais versionadas.

Correção: usar WiFiClientSecure com validação de certificado e o endpoint TLS suportado pelo broker. Não usar setInsecure como substituto da validação. Rotacionar as credenciais antigas.

## Outros achados confirmados

### 7. Média: rotas anteriores ao bloqueio de senha provisória

O bloqueio `api/[...route].js:605` acontece depois de /chatbot/perguntar, /chatbot/contexto e /predador/analise. O contexto operacional do chatbot é entregue mesmo com token de senha provisória. Reprodução local: /chatbot/contexto retornou 200, enquanto /talhoes retornou 403 para o mesmo token. Não foi necessário consultar dados reais.

Correção: aplicar o bloqueio logo após a autenticação e consulta do cadastro; permitir explicitamente apenas alteração de senha e ações estritamente necessárias ao primeiro acesso.

### 8. Média: detalhes internos de banco expostos em produção

`api/database.js:18` inclui message/details/hint do PostgREST no erro. `api/[...route].js:2187` devolve essa mensagem mesmo em produção. A condição NODE_ENV protege apenas o campo detalhes, não o campo mensagem.

Reprodução local: erro fictício com estrutura-interna-simulada apareceu na resposta com NODE_ENV=production.

Correção: devolver mensagem pública genérica com identificador de incidente; guardar detalhes em logs internos com redação de dados pessoais e segredos.

## Riscos que exigem verificar a implantação

### 9. Potencialmente alta: funções privilegiadas de particionamento sem revogação explícita

`supabase/schema_oficial_atualizado.sql:543` e `:581`, assim como a migração 006, criam garantir_particao_leitura e gerar_particoes_telemetria como SECURITY DEFINER. Não há REVOKE EXECUTE dessas funções no código revisado. O argumento meses_futuros não tem teto.

No PostgreSQL, funções novas recebem EXECUTE para PUBLIC por padrão, salvo alteração dos privilégios padrão. Assim, a instalação pode permitir que chamadores não autorizados criem muitas partições com privilégios do proprietário. Isso depende de ACLs, privilégios padrão e exposição do schema realmente instalados; não foi confirmado contra Supabase real.

Correção: verificar ACLs com o SQL complementar, revogar explicitamente de PUBLIC/anon/authenticated conforme a política da aplicação, conceder somente ao executor necessário e limitar o intervalo/quantidade de partições. Revisar também as views criadas em :643 e :654: não usam security_invoker e suas concessões reais devem ser inspecionadas antes de concluir se dados estão expostos diretamente.

## Melhorias adicionais

- O limite máximo de senha é de 10 caracteres em login, criação e troca. Ampliar para permitir senhas longas; alinhar frontend, backend e scripts.
- O servidor não define CSP nem proteção contra enquadramento. Isso amplia impacto de eventual injeção e permite enquadramento se a hospedagem não adicionar proteção. Revisar cabeçalhos na implantação e reduzir dependências de scripts CDN sem integridade fixada.
- O histórico do chatbot fica em localStorage após logout. A separação por ID/perfil evita misturar a lista na interface, mas não protege contra scripts da mesma origem ou alguém com acesso ao perfil do navegador. Oferecer limpeza e política de retenção adequada para dispositivos compartilhados.
- /api/relatorios é montada antes do handler de autenticação em src/server.js:13. Hoje devolve apenas mensagem fixa, sem dados; não é vazamento confirmado, mas qualquer consulta futura adicionada ali precisa de autenticação e autorização.

## Validação e pontos positivos

- `node testes/seguranca/auditoria.cjs`: sete comportamentos inseguros reproduzidos com dados fictícios. O script confirma a presença dos problemas; sua saída bem-sucedida não significa que o sistema é seguro.
- `npm audit --omit=dev --json`: zero vulnerabilidades conhecidas reportadas para a árvore instalada nesta execução. Isso não cobre falhas de lógica, firmware ou todos os scripts CDN.
- O .env não está versionado no snapshot atual e consta no .gitignore. Não foi comprovada a ausência de segredos em todo o histórico Git.
- Tokens usam assinatura HMAC com comparação em tempo constante; senhas usam PBKDF2 com salt; o chatbot verifica conta e organização nas consultas novas e renderiza respostas como texto. Não foi confirmado XSS explorável nesta revisão.

Fontes de referência: [Supabase — RLS e service_role](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL — privilégios padrão de funções](https://www.postgresql.org/docs/current/sql-createfunction.html).

Nenhuma correção funcional foi aplicada nesta auditoria. Ordem sugerida: rotacionar segredos; corrigir autorização e revogação de sessões; validar/restringir SQL; corrigir limite de requisições e transporte IoT; completar endurecimento de respostas e interface.
