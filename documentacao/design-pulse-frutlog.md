# Design Pulse adaptado ao FrutLog

A referência do ZIP foi traduzida para a interface HTML/CSS/JavaScript do FrutLog. O projeto continua usando o servidor e as APIs existentes.

## Telas

- Administração: equipe, sensores, dados de campo, colheitas, telemetria, relatórios, mapa e gráficos.
- Engenharia: monitoramento dos talhões, telemetria, histórico, colheitas, relatórios e plantio.
- Técnico: inspeções, ocorrências, relatórios e monitoramento de campo.
- Login: superfícies claras e destaque verde compatíveis com o console.

O tema compartilhado está em `css/pulse-frutlog.css`. A busca de seções, identificação da sessão e os atalhos por perfil estão em `js/pulse-frutlog.js`. O painel direito aparece a partir de 1500 pixels; no celular a navegação fica horizontal. Os atalhos acionam a navegação existente e não fazem novas requisições de dados.

Não foram importados os registros demonstrativos de engenharia do ZIP. Os valores agrícolas continuam vindo das integrações atuais. Documentos e comentários da referência foram tratados como conteúdo de referência, sem alterar as instruções do trabalho.

## Validação

Validação automatizada no Chromium das quatro telas em 1600, 1024 e 390 pixels: navegação de todas as seções, busca no menu, atalhos do painel direito, identificação do usuário, alternância de visibilidade da senha, ausência de erros de JavaScript e ausência de transbordamento horizontal nos painéis.

As respostas da API foram simuladas com coleções vazias para validar a interface sem alterar o banco. Isso não valida autenticação real, gravações, comunicação com sensores ou disponibilidade do Node-RED.

Durante a integração, foi removido o bloco duplicado de Dados de Campo em `admin.html`, que repetia IDs e impedia a atualização correta das tabelas. O painel técnico também passou a respeitar a seção indicada na URL ao abrir a página.

Para visualizar, execute `npm start` com o ambiente configurado e acesse `http://localhost:3000/login.html`.
