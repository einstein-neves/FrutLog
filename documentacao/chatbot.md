# Assistente do FrutLog

Os três painéis enviam `pergunta` (até 1.000 caracteres) e `conversationId` para `POST /api/chatbot/perguntar`. A API exige JWT válido e verifica no banco que a conta continua ativa. Perguntas de tutorial são respondidas conforme o perfil atual da conta; consultas operacionais completas continuam exclusivas de administradores e restritas à organização dessa conta. O limite permanece em dez perguntas por minuto por IP.

## Tutoriais de uso

O catálogo em `documentacao/tutoriais-frutlog.json` contém 28 tutoriais adaptados às telas e scripts deste projeto. Cobre acesso e senha provisória, funcionários, sensores, criação/edição/exclusão de talhões e orientação sobre a indisponibilidade da divisão, plantios, colheitas, inspeções, ocorrências, problemas de sensores, relatórios, telemetria e alertas.

Perguntas como “Como cadastrar um funcionário?”, “Como dividir um talhão?” e “Como enviar um relatório diário?” são reconhecidas antes da busca operacional. O backend seleciona um tutorial por tarefa e perfil e devolve passos numerados, observações e, quando disponível, o link para a seção do próprio painel. Não há chamada à DeepSeek nessa etapa, e a chave de IA não é necessária para obter tutoriais. A autenticação e a verificação da conta no banco continuam obrigatórias.

O assistente reconhece variações como colaborador/funcionário, vistoria/inspeção e lançar/registrar. Continua perguntas como “E para excluir?” a partir do tutorial anterior. Quando há mais de uma tarefa possível, pede que o usuário escolha. Funções de outro perfil são identificadas como restritas e não recebem links para esse painel. Operações não documentadas não geram passos inventados.

O widget compartilhado fica em `publico/js/assistente.js`, os eventos e links em `publico/js/chatbot.js` e os estilos em `publico/css/chatbot.css`. Os atalhos usam a navegação existente para abrir também seções inicialmente ocultas. Os links recebidos são limitados às rotas conhecidas do perfil conectado; o texto do chat é exibido sem executar HTML.

Para adicionar um tutorial, inclua no catálogo:

- `id`, `title`, `roles`: identificador único, título e perfis que executam a tarefa.
- `subjects`, `actions`: assuntos e ações usados na busca. Os verbos reconhecidos estão em `api/chatbot/tutorials.js`.
- `steps`, `notes`: instruções reais, pré-requisitos e limitações. Não inclua credenciais nem exemplos de senhas reais.
- `destinations`: link de seção por perfil, por exemplo `eng.html#cadastro-plantio`.
- `sources`: arquivos usados para conferir o procedimento.
- `targets`: elementos reais das páginas que dão suporte ao tutorial. Os testes conferem sua existência, ignorando HTML comentado.

Execute os testes ao modificar um tutorial ou renomear um menu, campo ou botão. Os tutoriais são conteúdo mantido com o código; não são gerados automaticamente a partir da interface em produção.

## Backend

Perguntas de quantidade de funcionários, usuários ou colaboradores são respondidas diretamente com contagem completa no banco, sem chamar a DeepSeek e sem carregar os catálogos de sensores ou talhões. Aceitam filtros de perfil e ativo/inativo, continuam restritas ao Administrador e distinguem falha de consulta de total zero. A contagem geral inclui as contas administrativas da organização.

Os arquivos de `api/chatbot/` têm responsabilidades separadas:

- `repository.js`: consultas PostgREST somente de leitura, paginação, contagens completas e timeout.
- `query.js`: identificação de talhões, sensores, métricas, datas e referências à pergunta anterior. Não gera nem executa SQL produzido pela IA.
- `context.js`: coleta dos dados autorizados, contagens independentes das listas e cálculos por sensor/unidade.
- `knowledge.js`: busca na documentação com normalização e sinônimos.
- `tutorials.js`: reconhecimento de perguntas de uso, busca no catálogo, escolha de perfil e construção dos passos.
- `counts.js`: reconhecimento e resposta direta para contagens de funcionários.
- `conversations.js`: histórico curto isolado pelo hash do token, usuário e conversa.
- `provider.js`: regras do assistente, separação entre instruções e dados, chamada à DeepSeek e erros sem credenciais.
- `index.js`: coordenação da consulta, histórico e referências na resposta.

O navegador mantém apenas o identificador da conversa e as mensagens visíveis. Não envia o histórico que será aceito como contexto pelo servidor. Nova conversa gera outro identificador e limpa as mensagens da tela. O histórico anterior expira automaticamente; não é salvo no banco nem em arquivos.

## Configuração

`DEEPSEEK_API_KEY` é obrigatória apenas para as respostas operacionais geradas por IA e continua exclusiva do servidor. Os tutoriais funcionam sem essa chave. As opções abaixo são facultativas; não é necessário alterar o `.env` para usar os padrões:

```env
DEEPSEEK_MODEL=deepseek-flash
CHATBOT_STALE_MINUTES=15
```

O intervalo de comunicação recente aceita de 1 a 1.440 minutos. Essa classificação vale para o contexto do assistente; não altera a classificação dos demais endpoints de telemetria. O modelo usa o modo sem raciocínio prolongado para responder dentro do timeout de 20 segundos. Referências: [modelo e integração](https://api-docs.deepseek.com/quick_start/agent_integrations/), [modos de resposta](https://api-docs.deepseek.com/guides/thinking_mode/).

## Limites explícitos

- Até três turnos anteriores por conversa, com expiração após 15 minutos de inatividade e até mil conversas por processo. Reiniciar o servidor limpa a memória. Em múltiplas instâncias, é necessário armazenar as sessões em um serviço compartilhado antes de depender da continuidade entre requisições.
- Catálogos paginados de até 10 mil registros por consulta; se estiverem incompletos, a busca falha explicitamente em vez de declarar que um item não existe.
- Listas operacionais de até 30 itens e listas de sensores/talhões de até 50, com totais independentes e indicação de lista parcial.
- Histórico de até 90 dias e 20 mil leituras por consulta. Ao exceder o limite, não são calculadas estatísticas incompletas; a resposta solicita um filtro menor. Comparações podem incluir também o período anterior.
- Estatísticas usam leituras de qualidade boa e não misturam unidades. Colheitas são agregadas por ano e unidade, até 20 mil registros, com aviso se esse limite for excedido.
- Alertas são restritos aos talhões da organização autorizada. Alertas sem talhão não podem ser atribuídos com segurança à organização e não entram nessa contagem.
- O reconhecimento de filtros é determinístico, não cobre toda expressão possível da linguagem natural e pede esclarecimento para ambiguidades conhecidas. Textos operacionais são tratados como dados não confiáveis, sem promessa de eliminar todo risco de manipulação do modelo.

## Validação

```powershell
npm.cmd run test:chatbot
npm.cmd run teste
```

Os testes verificam filtros, datas, contagens, paginação, estatísticas, isolamento/expiração da memória, composição das mensagens para a IA, erros do provedor, autenticação da rota e interação do chat no navegador. Usam banco e IA simulados; não consomem créditos nem alteram registros reais.

O programa Python em `chatboot/` é uma integração independente com Groq e não utiliza a memória ou o planejador deste assistente web.
