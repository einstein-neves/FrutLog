# FrutLog — Documentação Completa

> **Sistema de Gestão Agrícola e Monitoramento IoT**  
> Documentação central do projeto, reunindo visão do produto, funcionalidades, arquitetura, banco de dados, integrações, operação, segurança e histórico de desenvolvimento.

- **Repositório:** https://github.com/einstein-neves/FrutLog
- **Arquivo:** `DOCUMENTACAO_COMPLETA.md`
- **Status deste documento:** versão inicial consolidada, em construção
- **Última revisão documental:** 20/11/2026

---

## Sobre esta documentação

Este arquivo centraliza as informações do FrutLog que antes estavam distribuídas entre documentos, relatórios, registros do Trello e arquivos do repositório.

O projeto evoluiu desde seus primeiros protótipos. Por isso, é importante distinguir:

1. **Documentação do estado atual:** descreve a estrutura e os recursos apresentados na versão atual do repositório.
2. **Histórico do projeto:** registra decisões, protótipos, pesquisas e versões anteriores, sem tratá-los como funcionalidades ou limitações atuais.
3. **Informações a confirmar:** pontos que precisam ser conferidos com a equipe ou diretamente no código antes de serem descritos como definitivos.

A Desk Research inicial, os primeiros protótipos e os relatórios de QA antigos são registros históricos. Eles não devem ser usados isoladamente para definir o estado atual do sistema. Os problemas apontados nos relatórios antigos foram tratados posteriormente, conforme a atualização da equipe. Portanto, este documento não os apresenta como pendências atuais.

> **Regra de manutenção:** sempre que uma funcionalidade for alterada, esta documentação deve ser atualizada para refletir o comportamento real da versão vigente. Em caso de divergência entre um relatório antigo e a implementação atual, deve prevalecer a implementação atual validada pela equipe.

---

# 1. Visão geral do projeto

O **FrutLog** é um sistema web de gestão agrícola e monitoramento conectado. A plataforma reúne informações da propriedade, talhões, culturas, ciclos de plantio, sensores, leituras de telemetria e atividades realizadas pela equipe.

O objetivo é centralizar dados que poderiam ficar dispersos entre planilhas, anotações, equipamentos e conversas, permitindo que os responsáveis acompanhem a operação agrícola em painéis organizados por perfil de acesso.

O sistema conecta três áreas principais:

- **Gestão administrativa:** administração de usuários, sensores e informações gerais da propriedade.
- **Acompanhamento agronômico:** organização dos talhões, ciclos de cultivo, mapa, indicadores e histórico.
- **Operação de campo:** inspeções, ocorrências, problemas em sensores e relatórios diários.

A plataforma também integra dispositivos IoT para receber dados ambientais e disponibilizá-los aos usuários em painéis, tabelas e gráficos.

## 1.1 Objetivo geral

Desenvolver uma plataforma integrada de gestão agrícola que centralize informações operacionais e permita acompanhar as condições dos talhões por meio de registros da equipe e dados coletados por sensores.

## 1.2 Objetivos específicos

- Organizar o cadastro de fazendas, talhões, culturas e ciclos de plantio.
- Gerenciar usuários e permissões de acordo com suas responsabilidades.
- Cadastrar e associar sensores aos talhões.
- Receber e consultar leituras de sensores IoT.
- Acompanhar indicadores ambientais, incluindo temperatura, umidade do ar e umidade do solo.
- Registrar inspeções, ocorrências e problemas relacionados aos sensores.
- Registrar e consultar informações de colheita.
- Disponibilizar relatórios e históricos para apoiar o acompanhamento da propriedade.
- Oferecer visualizações específicas para Administração, Engenharia e Técnico.
- Apoiar a consulta de informações operacionais por meio do assistente integrado.

## 1.3 Proposta de valor

O FrutLog busca:

- **Centralizar informações:** reunir dados da propriedade em uma plataforma.
- **Dar contexto aos dados:** relacionar leituras, sensores, talhões e ciclos de cultivo.
- **Facilitar o acompanhamento:** apresentar indicadores e históricos em painéis.
- **Melhorar a comunicação:** permitir que registros de campo sejam consultados pelos demais responsáveis.
- **Apoiar decisões:** oferecer informações organizadas para análise dos profissionais responsáveis.

O FrutLog é uma ferramenta de apoio à gestão. Seus indicadores não substituem a observação em campo, a avaliação agronômica ou os procedimentos técnicos definidos pela propriedade.

---

# 2. Perfis de acesso

O sistema possui três perfis principais, cada um com painel e responsabilidades próprios.

## 2.1 Administrador

Responsável pela administração geral do ambiente e pela estrutura de acesso.

Principais atividades:

- Cadastrar, editar, ativar, inativar e excluir funcionários, conforme as permissões disponíveis.
- Cadastrar e administrar sensores.
- Consultar dados consolidados da operação.
- Acompanhar mapa, telemetria, relatórios e indicadores.
- Consultar informações de inspeções, ocorrências e colheitas.
- Administrar informações e configurações disponibilizadas no painel administrativo.
- Utilizar o assistente integrado ao painel.

## 2.2 Engenheiro Agrônomo

Responsável pelo acompanhamento agronômico e pela organização das informações dos talhões.

Principais atividades:

- Consultar talhões, sensores e dados de monitoramento.
- Acompanhar telemetria, inspeções, tarefas e histórico.
- Cadastrar ciclos de plantio, relacionando cultura, cultivar, solo e datas.
- Editar informações e geometrias dos talhões, conforme as permissões.
- Consultar e registrar informações de colheita.
- Acompanhar relatórios e indicadores da propriedade.

## 2.3 Técnico Agrícola

Responsável pelo acompanhamento operacional e pelos registros realizados em campo.

Principais atividades:

- Consultar talhões e sensores associados.
- Acompanhar leituras e informações de telemetria disponíveis.
- Registrar inspeções.
- Registrar ocorrências.
- Informar problemas relacionados aos sensores.
- Enviar relatórios diários.
- Consultar históricos e informações necessárias ao trabalho de campo.

## 2.4 Controle de permissões

O acesso é organizado por perfil. A interface apresenta as áreas correspondentes ao usuário, enquanto a API também aplica verificações de autenticação e autorização nas operações protegidas.

As permissões devem seguir o princípio do menor privilégio: cada conta deve possuir somente os acessos necessários para sua função.

---

# 3. Funcionalidades do sistema

Esta seção descreve os módulos funcionais identificados na documentação atual do repositório. A disponibilidade de cada operação depende dos dados cadastrados e da configuração do ambiente.

## 3.1 Autenticação e sessão

O acesso é realizado por matrícula e senha.

O backend valida as credenciais e, quando o acesso é autorizado, emite um token JWT. O frontend utiliza as informações recebidas para identificar o usuário e direcioná-lo ao painel correspondente ao seu perfil.

Perfis utilizados pelo sistema:

- `administrador`
- `engenheiro`
- `tecnico`

A autenticação e a autorização efetivas são responsabilidades do backend. A interface não deve ser considerada a única camada de proteção.

## 3.2 Administração de funcionários

O módulo administrativo permite gerenciar as contas dos integrantes da equipe, incluindo informações de identificação, perfil e estado da conta.

As ações disponíveis incluem operações de consulta e gerenciamento de funcionários, respeitando as regras de acesso da API.

## 3.3 Gestão de fazendas e talhões

O sistema organiza a propriedade por fazenda e talhão.

Os talhões possuem identificação e podem conter informações como nome, código, área e geometria utilizada na representação do mapa. A geometria pode ser editada por usuários autorizados.

A seleção de um talhão permite contextualizar as informações exibidas em outras áreas do sistema, como monitoramento, sensores, inspeções e ciclos de cultivo.

## 3.4 Culturas e ciclos de plantio

O cadastro de plantio permite relacionar um talhão a uma cultura e cultivar, registrando informações do ciclo, como solo e datas.

O histórico dos ciclos permite acompanhar o contexto produtivo de cada talhão.

## 3.5 Sensores e dispositivos

O administrador pode cadastrar sensores e associá-los aos talhões.

O cadastro identifica o dispositivo e a grandeza monitorada. Entre os tipos de leitura previstos no modelo operacional estão:

- Temperatura;
- Umidade do ar;
- Umidade do solo;
- Chuva.

O estado cadastrado de um sensor não significa necessariamente que ele esteja transmitindo. O estado de comunicação depende da chegada de leituras válidas ao sistema.

## 3.6 Monitoramento e telemetria

O módulo de telemetria reúne leituras dos sensores e informações ambientais disponíveis nas integrações configuradas.

As informações podem ser apresentadas em cards, tabelas, gráficos e históricos, conforme o painel e a funcionalidade.

O sistema contempla consultas de dados climáticos do ThingSpeak por meio de um proxy autenticado no backend e também possui uma rota própria para ingestão de leituras IoT.

### Umidade do solo

O monitoramento de umidade do solo faz parte do escopo funcional do FrutLog. A métrica está prevista no catálogo de grandezas do sistema e no modelo de sensores.

A leitura deve ser associada ao sensor e ao talhão correspondentes, mantendo o valor, a unidade e o horário de coleta. A visualização depende da integração e do envio correto dos dados pelo dispositivo.

> **Atenção:** a presença da métrica no sistema não significa que todo ambiente esteja recebendo dados naquele momento. Para documentar o funcionamento de uma instalação específica, devem ser conferidos o sensor, o firmware, o canal ou broker utilizado e as últimas leituras armazenadas.

## 3.7 Inspeções de campo

O módulo de inspeções permite registrar avaliações realizadas nos talhões.

Os registros podem conter data, situação, problemas identificados, observações e vínculo opcional com um sensor, conforme as regras do sistema.

## 3.8 Ocorrências

As ocorrências permitem registrar situações que exigem atenção ou acompanhamento da equipe.

Os registros são relacionados ao contexto operacional, incluindo talhão, data, tipo e observação.

## 3.9 Problemas em sensores

O técnico pode registrar problemas relacionados aos dispositivos de monitoramento, permitindo documentar falhas e apoiar o acompanhamento de manutenção.

O registro de um problema não depende necessariamente da existência de um sensor selecionado em todos os cenários previstos pelo modelo atual.

## 3.10 Alertas

O sistema possui estrutura para regras e alertas relacionados às leituras e condições monitoradas.

Os alertas são apresentados aos usuários autenticados conforme as permissões e os dados disponíveis. A interpretação de um alerta deve considerar o contexto do talhão e a avaliação do responsável técnico.

## 3.11 Colheitas

O módulo de colheitas permite registrar a produção associada a um talhão, com data, quantidade e unidade.

O registro pode ser relacionado ao ciclo ativo mais recente do talhão. O cadastro de uma colheita continua permitido mesmo quando não existe ciclo ativo associado.

Os dados podem ser consultados em históricos e consolidados.

## 3.12 Relatórios diários

O relatório diário registra informações da atividade de campo, incluindo data, conteúdo e autor.

Os relatórios ficam disponíveis para consulta nos painéis previstos, incluindo Engenharia e Administração, conforme a documentação do repositório.

## 3.13 Assistente integrado

O painel administrativo possui um assistente web que consulta informações operacionais por meio da API autenticada, incluindo ocorrências recentes e estado dos sensores.

O repositório também documenta um chatbot independente localizado na pasta `chatboot/`. Esse componente é distinto do assistente web do painel e possui instruções próprias de configuração.

As integrações de IA devem ser documentadas separadamente para evitar confusão entre provedores, modelos, credenciais e formas de execução.

## 3.14 Notificações por e-mail

O repositório documenta um serviço de envio de e-mails para notificações relacionadas a contas e senhas, relatórios e alertas.

O serviço depende da configuração das variáveis de ambiente, do cadastro dos destinatários e da execução do processo de monitoramento de e-mails.

A matriz exata de destinatários e os modelos de mensagens devem ser mantidos junto à documentação específica do serviço, quando incorporados a esta documentação central.

---

# 4. Arquitetura do sistema

A arquitetura separa a interface web, a API, o banco de dados e o fluxo de comunicação dos dispositivos IoT.

## 4.1 Visão geral

```text
                 ┌─────────────────────────────┐
                 │       Sensores / ESP32      │
                 └──────────────┬──────────────┘
                                │ MQTT com TLS
                                ▼
                 ┌─────────────────────────────┐
                 │       Broker MQTT           │
                 │     Mosquitto / EMQX        │
                 └──────────────┬──────────────┘
                                │ Assinatura privada
                                ▼
                 ┌─────────────────────────────┐
                 │    Ponte privada Node.js    │
                 └──────────────┬──────────────┘
                                │ HTTPS
                                │ POST /api/iot/telemetria
                                │ X-IoT-Key
                                ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│    Frontend Web      │◄►│       Backend Node.js       │
│                      │  │          API /api           │
│ • Administração      │  └──────────────┬──────────────┘
│ • Engenharia         │                 │
│ • Técnico            │                 │ PostgREST
└──────────────────────┘                 ▼
                            ┌───────────────────────────┐
                            │ Supabase / PostgreSQL     │
                            │ Esquema operacional       │
                            └───────────────────────────┘
```

O frontend não se conecta diretamente ao broker MQTT e não deve armazenar chaves privadas de serviço do banco. A comunicação de IoT passa pela ponte privada autenticada e pelo backend.

## 4.2 Frontend

A interface web disponibiliza os painéis de Administração, Engenharia e Técnico, além da tela de login.

Os painéis apresentam funcionalidades de acordo com o perfil do usuário. A interface consome a API para consultar e registrar informações.

## 4.3 Backend

O backend é desenvolvido em Node.js e disponibiliza endpoints para autenticação, consulta, cadastro e atualização de informações operacionais.

A API centraliza as regras de negócio, validações, permissões e comunicação com o banco de dados.

## 4.4 Banco de dados

O projeto utiliza Supabase com PostgreSQL como camada de persistência.

O repositório mantém um esquema oficial consolidado para novas instalações e migrações numeradas para a evolução de bancos já existentes.

## 4.5 Comunicação IoT

O fluxo MQTT utiliza um broker e uma ponte privada Node.js. A ponte encaminha as leituras para a API do FrutLog utilizando HTTPS e uma chave privada de integração no cabeçalho `X-IoT-Key`.

O endpoint de ingestão recebe informações como identificador do sensor, talhão, tipo de métrica, valor numérico e unidade.

---

# 5. Tecnologias e ferramentas

Com base no repositório e nos documentos de implementação disponíveis, o projeto utiliza:

| Camada | Tecnologia / ferramenta | Finalidade |
|---|---|---|
| Backend | Node.js | Execução da aplicação e da API |
| API | Rotas em `/api` | Comunicação entre interface, serviços e banco |
| Banco de dados | PostgreSQL / Supabase | Persistência dos dados |
| Autenticação | JWT | Identificação de sessões autenticadas |
| Senhas | PBKDF2 | Armazenamento de hashes de senha |
| IoT | MQTT com TLS | Transporte das mensagens dos dispositivos |
| Ponte IoT | Node.js | Encaminhamento autenticado de telemetria |
| Monitoramento externo | ThingSpeak | Consulta de dados climáticos, conforme configuração |
| Interface | HTML, CSS e JavaScript | Construção dos painéis web |
| Gráficos | Chart.js | Visualização de séries e indicadores |
| Ícones | Font Awesome | Elementos visuais da interface |
| Assistente web | Integração de IA via backend | Consulta contextual de informações operacionais |
| E-mail | Serviço de monitoramento de notificações | Envio de avisos configurados |

> A lista representa tecnologias identificadas nos materiais consultados. A relação definitiva de dependências deve ser conferida no `package.json` e nos arquivos de configuração da versão publicada.

---

# 6. Banco de dados

O FrutLog utiliza PostgreSQL por meio do Supabase. O esquema oficial consolidado está em:

`supabase/schema_oficial_atualizado.sql`

Esse arquivo é a referência para uma instalação nova. O repositório mantém esquemas e migrações anteriores para preservar o histórico de evolução.

**Não execute o esquema oficial novamente em um banco que já esteja em operação.** Em ambientes existentes, devem ser avaliadas e aplicadas somente as migrações pendentes, na ordem indicada pelo README e pela equipe responsável.

## 6.1 Principais entidades

| Entidade | Responsabilidade |
|---|---|
| `organizacao` | Representar a organização responsável pela propriedade |
| `usuario` | Armazenar contas, perfis e dados de autenticação |
| `fazenda` | Representar a propriedade rural |
| `talhao` | Armazenar os talhões e suas geometrias |
| `cultura` | Manter o catálogo de culturas |
| `cultivar` | Manter o catálogo de variedades |
| `ciclo_cultura` | Registrar ciclos e safras |
| `dispositivo` | Representar dispositivos físicos |
| `sensor` | Registrar sensores e grandezas monitoradas |
| `leitura_sensor` | Armazenar o histórico de telemetria |
| `inspecao` | Registrar inspeções de campo |
| `ocorrencia` | Registrar ocorrências operacionais |
| `problema_sensor` | Registrar problemas relacionados aos sensores |
| `colheita` | Registrar dados de produção |

O esquema também contém estruturas auxiliares, restrições, índices, triggers, views e mecanismos de organização dos dados.

## 6.2 Dados iniciais

O esquema oficial cria a estrutura do banco, mas não deve ser interpretado como um conjunto de dados de demonstração. Usuários, fazendas, talhões, sensores e registros operacionais precisam ser cadastrados ou provisionados conforme o procedimento da instalação.

---

# 7. API e rotas

A API disponibiliza rotas granulares e rotas compostas para atender aos painéis.

A tabela abaixo consolida as rotas descritas no README do repositório. Ela deve ser revisada quando endpoints forem adicionados, removidos ou alterados.

## 7.1 Autenticação, saúde e IoT

| Método | Rota | Finalidade | Acesso |
|---|---|---|---|
| `GET` | `/api/health` | Verificar o estado da API e a conexão com o banco | Pública |
| `POST` | `/api/login` | Autenticar matrícula e senha e emitir JWT | Pública |
| `POST` | `/api/iot/telemetria` | Receber leituras encaminhadas pela ponte IoT | Chave `X-IoT-Key` |
| `GET` | `/api/telemetria/thingspeak` | Consultar dados climáticos do ThingSpeak por proxy | Autenticado |
| `GET` | `/api/telemetria/diaria` | Consultar histórico diário agregado por talhão | Autenticado |

## 7.2 Painéis compostos

| Método | Rota | Finalidade | Perfis |
|---|---|---|---|
| `GET` | `/api/painel-engenheiro` | Retornar dados agregados para o painel de Engenharia | Engenheiro e Administrador |
| `GET` | `/api/painel-tecnico` | Retornar dados agregados para o painel Técnico | Técnico e Administrador |

## 7.3 Rotas operacionais

| Método | Rota | Finalidade | Perfis / acesso |
|---|---|---|---|
| `GET` | `/api/talhoes` | Listar talhões | Autenticado |
| `GET` | `/api/sensores` | Listar sensores, estado e última leitura | Autenticado |
| `GET`, `POST` | `/api/inspecoes` | Consultar e registrar inspeções | Técnico e Administrador |
| `GET`, `POST` | `/api/ocorrencias` | Consultar e registrar ocorrências | Técnico e Administrador |
| `GET`, `POST` | `/api/sensores/problemas` | Consultar e registrar problemas em sensores | Técnico e Administrador |
| `GET`, `POST` | `/api/plantios` | Consultar ciclos e cadastrar plantios | Engenheiro e Administrador |
| `GET` | `/api/alertas` | Consultar alertas | Autenticado |
| `GET`, `POST` | `/api/funcionarios` | Consultar e cadastrar funcionários | Administrador |

> Esta tabela não substitui a especificação completa dos contratos da API. Parâmetros, formatos JSON, códigos HTTP e validações devem ser documentados a partir das implementações atuais das rotas.

---

# 8. Integrações e serviços externos

## 8.1 Supabase

O Supabase hospeda o banco PostgreSQL utilizado pela aplicação. O backend acessa os dados por meio dos serviços configurados no servidor.

As chaves privadas devem permanecer no ambiente do backend, nunca no código público do frontend.

## 8.2 MQTT e dispositivos IoT

O broker MQTT recebe mensagens dos dispositivos. A ponte privada acompanha os tópicos autorizados e encaminha as leituras para a API.

O fluxo documentado utiliza MQTT com TLS, assinatura privada dos tópicos e autenticação entre a ponte e a API.

## 8.3 ThingSpeak

O projeto possui integração com ThingSpeak para consulta de dados climáticos por meio de um proxy autenticado.

O identificador do canal, a chave de leitura e o mapeamento dos campos são configurados por variáveis de ambiente no servidor. A chave de leitura não deve ser exposta na interface web.

## 8.4 Serviço de e-mail

O serviço de e-mail depende de configuração própria e de um processo de monitoramento. O README descreve notificações relacionadas a contas/senhas, relatórios e alertas.

## 8.5 Assistentes de IA

O projeto documenta dois componentes distintos:

- Assistente web acessado pelo painel administrativo e integrado ao backend.
- Chatbot independente na pasta `chatboot/`, com configuração e execução próprias.

As variáveis, provedores, modelos e instruções de cada componente devem ser mantidos separados.

---

# 9. Instalação e execução

Esta seção resume o procedimento descrito no README do repositório. Antes de executar comandos em um ambiente existente, confirme a situação do banco e das migrações.

## 9.1 Pré-requisitos

- Node.js 20.6 ou superior, conforme o guia de instalação disponível.
- npm.
- Projeto Supabase configurado.
- Credenciais e variáveis de ambiente necessárias.
- Acesso aos serviços externos utilizados pelo ambiente, quando aplicável.

## 9.2 Configuração do banco

Para uma instalação nova:

1. Acesse o SQL Editor do projeto Supabase.
2. Execute `supabase/schema_oficial_atualizado.sql`.
3. Configure as variáveis de ambiente do backend.
4. Provisione o primeiro administrador pelo procedimento indicado nesta documentação.

Para bancos já existentes, não reaplique o esquema-base. Verifique as migrações pendentes e siga a sequência indicada no README atual do repositório.

## 9.3 Configuração do servidor

Configure no servidor os parâmetros e segredos exigidos pelos serviços utilizados pelo FrutLog. Os valores dependem do ambiente e não devem ser inseridos diretamente no código-fonte ou publicados no repositório.

## 9.4 Provisionamento do primeiro administrador

O repositório disponibiliza uma rotina de bootstrap para criar o administrador inicial.

O procedimento documentado utiliza:

```bash
npm.cmd run bootstrap-admin
```

A rotina cria o administrador inicial quando o banco ainda não possui usuários. A senha gerada é exibida uma única vez e deve ser guardada com segurança. Uma senha de bootstrap configurada para a instalação deve ser tratada como segredo e nunca publicada.

## 9.5 Inicialização

Com as dependências instaladas e o ambiente configurado, execute:

```bash
npm start
```

A documentação do repositório indica a inicialização local em:

`http://localhost:3000`

A API fica disponível no caminho `/api`.

---

# 10. Segurança e boas práticas

A segurança deve ser considerada em todas as camadas do FrutLog: interface, API, banco de dados, integrações e dispositivos.

Práticas documentadas ou necessárias para a operação:

- Manter chaves privadas somente no backend.
- Utilizar autenticação nas rotas protegidas.
- Aplicar autorização no backend, não apenas ocultar elementos da interface.
- Utilizar HTTPS nas comunicações externas.
- Utilizar MQTT com TLS no fluxo IoT.
- Proteger o endpoint de ingestão de telemetria com a chave de integração.
- Armazenar senhas com hash seguro.
- Conceder a cada usuário somente as permissões necessárias.
- Evitar inserir conteúdo não confiável diretamente em HTML.
- Revisar dependências e configurações de produção periodicamente.

## 10.1 Proteção de credenciais

Antes de publicar qualquer material, confira se há tokens, senhas, chaves de API ou dados pessoais. Caso uma credencial real tenha sido publicada, ela deve ser substituída no serviço correspondente.

## 10.2 Relatórios de QA

O projeto possui relatórios de QA e segurança produzidos durante etapas anteriores de desenvolvimento. Eles documentam testes, observações e correções de versões passadas.

**Esses relatórios não representam a lista atual de defeitos do FrutLog.** Conforme a atualização da equipe, os problemas apontados nesses documentos foram resolvidos. Eles devem ser consultados como histórico de qualidade e evolução, não como evidência de falhas ainda existentes.

Novas validações devem registrar a versão testada, ambiente, cenário, resultado e evidência correspondente.

---

# 11. Interface e experiência de uso

O FrutLog possui painéis especializados por perfil, mantendo uma identidade visual compartilhada.

As telas organizam as informações por seções e permitem consultar dados da propriedade sem misturar as responsabilidades de cada perfil.

## 11.1 Mapa de talhões

A interface utiliza uma representação visual da propriedade e dos talhões. As geometrias podem ser representadas por polígonos e editadas por usuários autorizados.

A seleção de um talhão deve manter sincronizados os detalhes apresentados na interface, como identificação e informações relacionadas à área selecionada.

## 11.2 Indicadores e gráficos

Os painéis podem apresentar cards, tabelas e gráficos para resumir dados operacionais, leituras ambientais, históricos e informações de colheita.

A exibição depende da disponibilidade dos registros e das integrações configuradas.

## 11.3 Responsividade

A interface possui adaptações para diferentes larguras de tela. A navegação e a disposição dos componentes devem permanecer utilizáveis em desktop, tablet e dispositivos móveis.

---

# 12. Histórico e evolução do projeto

O FrutLog passou por etapas de concepção, prototipação, desenvolvimento, integração e refinamento.

Os materiais antigos são importantes para entender as decisões e a evolução do projeto, mas não devem ser confundidos com a versão atual.

## 12.1 Primeiros materiais

Entre os materiais históricos estão:

- Primeira versão do protótipo no Figma.
- Primeira persona elaborada para representar um possível usuário do sistema.
- Desk Research inicial.
- Benchmark de soluções relacionadas ao setor agrícola.
- Primeiros relatórios de análise do frontend.
- Relatórios de testes e auditorias de QA de versões anteriores.

Esses documentos ajudam a reconstruir a origem das ideias, o problema inicialmente investigado e as decisões de design. Como estão desatualizados, não devem ser usados como fonte única para descrever funcionalidades atuais.

## 12.2 Evolução funcional e técnica

Os registros de desenvolvimento apontam a evolução de áreas como:

- Organização dos painéis de Administração, Engenharia e Técnico.
- Mapa interativo e edição de geometrias dos talhões.
- Tabelas e gráficos de monitoramento.
- Integração com telemetria e sensores.
- Estrutura de banco de dados consolidada.
- Autenticação e controle de permissões.
- Assistente integrado ao painel.
- Notificações por e-mail.
- Refinamentos de interface, acessibilidade e responsividade.

## 12.3 Como consultar o histórico

O arquivo `documentacao/relatorio.md` contém registros de contribuições e commits reunidos durante o desenvolvimento. Ele pode ser utilizado como fonte complementar para consultar autores, títulos e datas das alterações registradas.

O histórico do GitHub permanece como referência primária para verificar o conteúdo exato de cada commit.

---

# 13. Organização do repositório

A estrutura principal do repositório inclui diretórios e arquivos relacionados à aplicação, banco, hardware, testes e documentação.

| Caminho | Conteúdo / finalidade |
|---|---|
| `api/` | Rotas e lógica do backend |
| `documentacao/` | Documentos do projeto e materiais de apoio |
| `hardware/` | Materiais relacionados ao hardware e IoT |
| `publico/` | Arquivos públicos da aplicação |
| `scripts/` | Scripts auxiliares e rotinas de manutenção |
| `src/` | Código-fonte da aplicação |
| `supabase/` | Esquema e migrações do banco de dados |
| `testes/` | Materiais e rotinas de teste |
| `chatboot/` | Chatbot independente, conforme documentação do projeto |
| `README.md` | Orientações principais do repositório |
| `package.json` | Scripts e dependências Node.js |

A estrutura pode mudar conforme a evolução do código. Ao atualizar este documento, confira os diretórios e nomes diretamente na versão atual do repositório.

---

# 14. Equipe e contribuições

O desenvolvimento do FrutLog é realizado em equipe, com contribuições distribuídas entre programação, interface, banco de dados, IoT, testes, documentação e organização do projeto.

O histórico de commits e os registros de equipe devem ser utilizados para atribuir responsabilidades com precisão.

**A completar nesta documentação:**

- Relação oficial e atualizada dos integrantes.
- Responsabilidades atuais de cada integrante.
- Participações em frontend, backend, banco de dados, IoT, QA, UX/UI e documentação.
- Critério utilizado para registrar contribuições que não aparecem diretamente no histórico de commits.

---

# 15. Glossário

| Termo | Significado |
|---|---|
| **Fazenda** | Propriedade rural acompanhada pelo sistema |
| **Talhão** | Área delimitada da propriedade utilizada para organizar o cultivo |
| **Cultura** | Espécie ou produto agrícola cultivado |
| **Cultivar** | Variedade específica de uma cultura |
| **Ciclo de cultura** | Período de plantio e desenvolvimento de uma cultura em um talhão |
| **Sensor** | Componente que mede uma grandeza física ou ambiental |
| **Dispositivo** | Equipamento físico ao qual sensores podem estar associados |
| **Telemetria** | Coleta e transmissão de dados de sensores |
| **IoT** | Internet das Coisas; conexão de dispositivos físicos à rede |
| **MQTT** | Protocolo de mensagens utilizado na comunicação IoT |
| **Broker MQTT** | Serviço que recebe e distribui mensagens MQTT |
| **JWT** | Token utilizado para representar uma sessão autenticada |
| **Supabase** | Plataforma utilizada pelo projeto para hospedar e acessar o PostgreSQL |
| **Inspeção** | Registro de avaliação realizada em campo |
| **Ocorrência** | Registro de uma situação que exige atenção |
| **Umidade do solo** | Métrica relacionada à quantidade de água presente no solo |
| **Umidade do ar** | Métrica relacionada à quantidade de vapor de água no ar |
| **Colheita** | Registro da produção obtida em determinado talhão e período |

---

# 16. Manutenção desta documentação

Este arquivo deve acompanhar a evolução do sistema.

Sempre que houver uma mudança relevante, atualizar as seções correspondentes:

- Nova funcionalidade: seção 3.
- Alteração de arquitetura ou integração: seções 4 e 8.
- Alteração no banco: seção 6.
- Nova rota ou mudança de contrato: seção 7.
- Mudança na instalação: seção 9.
- Mudança de segurança: seção 10.
- Mudança de interface: seção 11.
- Alteração de equipe ou contribuição: seção 14.

## 16.1 Critérios para registrar uma funcionalidade

Antes de descrever uma funcionalidade como concluída, confirmar:

1. Ela existe na versão atual do código?
2. Está integrada ao backend e ao banco, quando necessário?
3. Depende de alguma configuração externa?
4. Quais perfis podem utilizá-la?
5. Há evidência de teste ou validação?
6. Há limitações conhecidas que precisam ser explicadas?

## 16.2 Informações a confirmar na próxima revisão

Os pontos abaixo foram deixados explicitamente para validação, evitando inventar detalhes:

- Relação completa e atual das funcionalidades de cada painel.
- Relação dos sensores físicos em uso e seus modelos.
- Como o sensor de umidade do solo está conectado ao fluxo atual de telemetria.
- Quais métricas estão efetivamente sendo transmitidas em cada ambiente.
- Limites e regras atuais utilizados para geração de alertas.
- Detalhamento dos contratos JSON das principais rotas da API.
- Fluxo atualizado do chatbot web e do chatbot independente.
- Matriz completa de notificações por e-mail e destinatários.
- Lista oficial de integrantes e responsabilidades atuais.
- Evidências recentes de testes funcionais, integração e segurança.

---

## Referências do projeto

As informações desta versão inicial foram consolidadas a partir dos seguintes materiais:

- Repositório oficial: https://github.com/einstein-neves/FrutLog
- `README.md` do repositório.
- `documentacao/Manual-Completo-FrutLog.pdf` — manual de uma versão anterior, consultado como referência histórica e funcional.
- `documentacao/relatorio.md` — histórico de contribuições registrado.
- `documentacao/design-pulse-frutlog.md` — registro de alterações de interface.
- `documentacao/integracao-versao-amigo.md` — registro de integração de interface.
- `documentacao/tutorial instalar/ligar.md` — instruções auxiliares de instalação.
- Relatórios antigos de QA e testes exportados do Trello — utilizados exclusivamente como histórico.
- Atualização fornecida pela equipe responsável pela documentação: a Desk Research e os relatórios antigos não representam o estado atual; os problemas de QA citados foram resolvidos; o monitoramento de umidade do solo faz parte da evolução do sistema.

---

**FrutLog — Da fazenda ao dado. Do dado à decisão.**
