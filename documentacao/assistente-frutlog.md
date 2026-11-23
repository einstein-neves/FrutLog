# Base de conhecimento do assistente FrutLog

## Visão geral

O FrutLog é um sistema web de gestão agrícola e monitoramento IoT. Ele usa páginas HTML, JavaScript Vanilla, CSS e uma API Node.js conectada ao Supabase. A telemetria de sensores é armazenada no banco e exibida conforme as permissões do usuário.

## Perfis de acesso

- Administrador: administra funcionários e sensores, consulta dados de campo consolidados, colheitas, telemetria, relatórios, mapa e gráficos.
- Engenheiro: administra talhões, geometria do mapa, plantios, culturas e acompanha telemetria e colheitas.
- Técnico: executa inspeções de campo, registra ocorrências e problemas de sensores e acompanha alertas.

## Painel administrativo e menu lateral

O painel do Administrador tem as seções: Funcionários, Sensores, Dados de Campo, Colheitas, Telemetria, Relatórios Recebidos, Mapa e Gráficos. O botão Sair encerra a sessão.

A aba lateral (sidebar) tem cor de fundo marrom escuro `#492d03`. O texto principal da sidebar é creme claro `#fff7ed`. Ao passar o mouse, um item do menu usa marrom `#60421c`; o item ativo usa marrom `#77532a`.

## Funcionários e privacidade

Funcionários possuem matrícula, cargo, profissão, perfil e status ativo ou inativo. A matrícula é gerada automaticamente. O assistente pode informar totais e distribuição por perfil, mas não deve revelar nomes, senhas, chaves ou dados pessoais.

## Dados de campo

Talhões representam áreas da fazenda. Cada um pode ter plantios, dispositivos e sensores. Sensores podem medir temperatura, umidade do solo, umidade do ar e chuva. Um sensor cadastrado não necessariamente possui leitura; o status Online depende da comunicação do dispositivo.

Ocorrências, inspeções, problemas de sensores e alertas são registros operacionais. Alertas abertos representam situações pendentes e devem ser acompanhados pela equipe responsável.

## Plantios e colheitas

Plantios ativos relacionam talhão, produto, variedade, área, solo, data de plantio e previsão de colheita. Colheitas são registradas por ano, quantidade e unidade; o sistema pode consolidar esses valores por ano e unidade.

## Limites do assistente

O assistente responde com base nos dados recebidos do banco e nesta base de conhecimento. Ele não acessa a internet, não enxerga telas em tempo real e não executa ações no sistema. Para dúvidas agronômicas que impliquem decisão de campo, deve orientar a consultar o engenheiro agrônomo responsável.

## Conversa e perguntas específicas

O assistente do Administrador aceita perguntas com código de talhão, identificador de sensor, métrica e período. Exemplos: “Como está o T1?”, “E os sensores dele?”, “Qual a média de temperatura do T1 nos últimos 7 dias?” e “Compare as colheitas de 2025 e 2026”. O botão Nova conversa inicia um novo assunto sem reutilizar o histórico anterior.

O histórico curto da conversa fica temporariamente no servidor. Ele ajuda a interpretar referências, mas os dados operacionais são consultados novamente a cada pergunta. O histórico não é um registro permanente nem prova do estado atual da fazenda.

## Tutoriais para usar as telas

O assistente está disponível nos painéis de Administração, Engenharia e Técnico para explicar como usar as funções de cada perfil. Perguntas como “Como cadastrar um sensor?”, “Como cadastrar um plantio?” e “Como registrar uma inspeção?” recebem um passo a passo revisado, com nomes reais dos menus e botões. O link Abrir a seção do tutorial leva à seção correspondente do próprio painel. O usuário executa as ações; o chatbot não cadastra nem exclui dados.

Administração pode cadastrar e gerenciar funcionários e sensores, registrar colheitas, acompanhar relatórios e editar o mapa administrativo. Engenharia cadastra plantios e cria, edita, divide ou exclui talhões pelo mapa, além de acompanhar relatórios e colheitas. Técnico registra inspeções, ocorrências, problemas de sensores e relatórios diários; não edita limites de talhões nem cadastra sensores.

Os tutoriais não dependem da IA e continuam disponíveis sem a chave do provedor. A conta precisa estar autenticada e ativa. Perguntas operacionais completas com IA continuam restritas ao Administrador. A ajuda informa quando uma tarefa depende de outro perfil ou não possui procedimento documentado, sem inventar campos ou botões.

## Comunicação, sinal e atualidade das leituras

No assistente, um sensor Online precisa estar ativo, associado a um dispositivo com status online e sinal recente. O intervalo padrão de comunicação recente é 15 minutos, ajustável pelo operador do servidor. A leitura possui sua própria data: um dispositivo pode ter sinal recente e ainda possuir apenas uma leitura antiga. “Sem leitura” significa ausência de registro, não valor zero. Offline significa falta de comunicação recente ou dispositivo offline, não necessariamente defeito físico.

Perguntas sobre umidade devem indicar solo ou ar, pois são métricas diferentes. Dados de temperatura, umidade e chuva têm unidades distintas e não podem ser somados como uma única medida.

## Períodos e análises de histórico

O assistente interpreta hoje, ontem, esta semana, semana passada, este mês, mês passado, últimos N dias e datas no formato DD/MM/AAAA ou AAAA-MM-DD. O fuso de referência é America/Fortaleza. Consultas de histórico aceitam intervalos de até 90 dias; sem período explícito, uma pergunta sobre evolução de sensores usa os últimos 7 dias, incluindo hoje.

Médias, mínimos, máximos e variações são calculados no servidor com leituras de qualidade boa, separados por sensor e unidade. Uma comparação pode usar o período anterior, explicitado na resposta. Semana atual pode estar incompleta; médias de períodos com durações distintas precisam ser interpretadas com cuidado. Uma única leitura não permite determinar tendência. A diferença entre primeira e última leitura não prova aumento contínuo.

Status de usuários, comunicação de sensores, plantios ativos e alertas abertos representam o estado atual. Filtrar registros por data não reconstrói o status que eles tinham no passado.

## Totais, listas e informações indisponíveis

As contagens completas são calculadas separadamente das listas apresentadas. Uma lista parcial mostra apenas parte dos registros; itens ausentes dela podem existir. Quando o volume de histórico for excessivo, o assistente deve pedir um período menor ou um sensor específico, sem apresentar estatísticas de uma amostra como totais completos.

Falha ao consultar o banco não significa ausência de registros. Uma resposta deve distinguir dados indisponíveis, consulta sem registros, leitura antiga e leitura inexistente. A data da consulta e as referências dos dados acompanham as respostas operacionais.
