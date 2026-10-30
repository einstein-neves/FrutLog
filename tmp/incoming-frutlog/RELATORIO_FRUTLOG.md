# Relatorio do Sistema FrutLog

Este documento explica a estrutura atual do FrutLog para facilitar a manutencao pelo grupo, principalmente quando o backend e o banco de dados forem adicionados.

## 1. O que e o FrutLog

O FrutLog e um sistema web de gestao agricola voltado para monitoramento de talhoes, sensores, inspecoes, ocorrencias, funcionarios e indicadores de producao.

Hoje ele funciona como prototipo frontend em modo demonstracao. Isso significa que as telas ja existem e simulam dados, mas ainda nao existe banco de dados real conectado. O codigo ja possui pontos preparados para chamar uma API no futuro.

## 2. Estrutura de arquivos

### Paginas HTML

- `index.html`: pagina inicial. Serve como entrada do sistema e redireciona para o painel se ja existir sessao.
- `login.html`: tela de login. Hoje permite escolher perfil de demonstracao.
- `eng.html`: painel do engenheiro agronomo.
- `tec.html`: painel do tecnico agricola.
- `admin.html`: painel do administrador.

### CSS

- `css/global.css`: variaveis globais, reset simples, fonte, cores e classes comuns.
- `css/index.css`: estilo da pagina inicial.
- `css/login.css`: estilo da tela de login.
- `css/dashboard.css`: componentes compartilhados dos dashboards, como sidebar, cards, mapa, tabelas, botoes e formularios.
- `css/eng.css`: ajustes especificos da tela do engenheiro.
- `css/tec.css`: ajustes especificos da tela do tecnico.
- `css/admin.css`: ajustes especificos da tela do administrador.

### JavaScript

- `js/global.js`: objeto principal `FrutLog`, responsavel por sessao, rotas por perfil, logout e chamadas para API.
- `js/index.js`: verifica se ja existe sessao e redireciona.
- `js/login.js`: controla login, validacao basica e modo demonstracao.
- `js/eng.js`: dados e interacoes do painel do engenheiro.
- `js/tec.js`: dados e interacoes do painel do tecnico.
- `js/admin.js`: dados e interacoes do painel administrativo.

### Outros

- `frutlog-smoke.spec.js`: teste simples com Playwright para verificar se as paginas carregam sem erro.
- `.vscode/settings.json`: configuracao local do Visual Studio Code. Atualmente define a porta do Live Server como `5501`.
- `ids.indexOf(id)!`: arquivo vazio, provavelmente criado por acidente. Pode ser removido do projeto.

## 3. O que e o objeto `FrutLog`

O `FrutLog` fica em `js/global.js` e funciona como uma central do sistema.

Ele guarda:

- `API_BASE_URL`: endereco base da API futura, hoje `http://localhost:3000/api`.
- `AUTENTICACAO_API_ATIVA`: controla se o login sera real ou demonstracao.
- `obterSessao()`: le a sessao salva no navegador.
- `salvarSessao(usuario, token)`: salva usuario e token no `sessionStorage`.
- `criarSessaoDemonstracao(perfil, matricula)`: cria usuario falso para demonstracao.
- `encerrarSessao()`: apaga sessao e volta para `login.html`.
- `verificarSessao(perfisPermitidos)`: bloqueia acesso se o perfil nao for permitido.
- `redirecionarPorPerfil(perfil)`: envia o usuario para `eng.html`, `tec.html` ou `admin.html`.
- `apiFetch(caminho, opcoes)`: funcao preparada para chamar o backend.
- `configurarLogout()`: adiciona evento no botao de sair.

Quando o backend ficar pronto, a troca principal sera ativar `AUTENTICACAO_API_ATIVA` e usar `apiFetch()` nos formularios.

## 4. Mapa das classes CSS principais

### Classes globais

- `.sr-only`: texto visivel apenas para leitores de tela. Usado para acessibilidade.
- `.mensagem-feedback`: area de mensagem de formulario.
- `.mensagem-feedback.erro`: mensagem de erro.
- `.mensagem-feedback.sucesso`: mensagem de sucesso.

### Pagina inicial

- `.pagina-inicial`: define fundo e centralizacao da pagina inicial.
- `.entrada-sistema`: caixa central da entrada.
- `.logo-entrada`: icone principal da entrada.
- `.btn-acessar`: botao para ir ao login.

### Login

- `.pagina-login`: fundo e centralizacao da tela de login.
- `.login`: container principal da tela de login.
- `.caixa-do-login1`: lado visual/apresentacao do login.
- `.caixa-do-login2`: lado do formulario.
- `.titulo-do-sistema`: nome FrutLog no painel esquerdo.
- `.banner-text`: bloco com mensagem de boas-vindas.
- `.input-field`: caixa que agrupa icone e input.
- `.icon-left`: icone esquerdo dentro do input.
- `.btn-toggle-senha`: botao para mostrar/ocultar senha.
- `.campo-demo`: select usado para escolher perfil no modo demonstracao.
- `.btn-login`: botao principal de login.

### Layout dos dashboards

- `.layout-dashboard`: organiza sidebar e conteudo principal.
- `.sidebar`: menu lateral fixo.
- `.logo-area`: area com icone e nome FrutLog.
- `.logo-icone`: icone da folha no menu.
- `.menu`: agrupamento dos links laterais.
- `.nav-link`: link do menu.
- `.nav-link.active`: link ativo.
- `.sidebar-acoes`: area inferior da sidebar.
- `.btn-logout`: botao sair.
- `.conteudo-dashboard`: area principal ao lado da sidebar.
- `.topo`: cabecalho de cada dashboard.

### Cards, formularios e tabelas

- `.cartao`: bloco branco reutilizavel.
- `.cartao-full-diario`: card de largura total usado na telemetria.
- `.titulo-cartao`: titulo padrao de card.
- `.titulo-do-cartao`: variacao de titulo usada em telemetria.
- `.cabecalho-detalhes`: cabecalho do card de detalhes do talhao.
- `.cabecalho-cadastro`: cabecalho de formularios de cadastro.
- `.titulo-talhao`: titulo usado em detalhes/cadastros.
- `.subtitulo-cadastro`: texto auxiliar do cadastro.
- `.badge-status`: etiqueta visual de status.
- `.badge-status.atencao`: status de atencao.
- `.badge-status.critico`: status critico.
- `.info-grid-detalhes`: grade dos detalhes do talhao.
- `.info-grid-cadastro`: grade dos campos do formulario.
- `.item-detalhe`: item de informacao exibida.
- `.item-detalhe-cadastro`: campo de formulario.
- `.label`: rotulo pequeno de campo/detalhe.
- `.valor`: valor exibido dentro de `.item-detalhe`.
- `.campo-formulario`: estilo padrao para input, select e textarea.
- `.campo-com-unidade`: campo numerico com unidade ao lado.
- `.area-botao-cadastro`: area do botao do formulario.
- `.btn-primario`: botao principal dos formularios.
- `.tabela-responsiva`: wrapper para tabela rolar no celular.
- `.tabela-dados`: estilo padrao das tabelas.

### Mapa dos talhoes

- `.secao-mapa-detalhes`: grid com mapa e detalhes.
- `.cartao-mapa-wrapper`: card que guarda o mapa.
- `.card-detalhes-elegante`: card de detalhes do talhao.
- `.mapa-header`: cabecalho acima do mapa.
- `.botoes-do-talhao`: grupo dos botoes A1, A2, B1 e B2.
- `.btn-talhao`: botao de selecao de talhao.
- `.btn-talhao.active`: talhao selecionado.
- `.status-mapa`: texto "Monitoramento Ativo".
- `.mapa-container`: area com imagem e camada SVG.
- `.mapa-imagem`: imagem base do mapa.
- `.camada-talhoes`: camada SVG posicionada por cima da imagem.
- `.talhao-mapa`: poligono clicavel de um talhao.
- `.talhao-mapa.status-normal`: cor do talhao normal.
- `.talhao-mapa.status-atencao`: cor do talhao em atencao.
- `.talhao-mapa.status-critico`: cor do talhao critico.
- `.talhao-mapa.selecionado`: destaque do talhao selecionado.
- `.ponto-arrastavel`: pontos visuais dos vertices do poligono.
- `.legenda-mapa`: caixa da legenda.
- `.legenda-item`: item individual da legenda.
- `.legenda-cor`: quadrado de cor da legenda.
- `.legenda-normal`: cor normal.
- `.legenda-atencao`: cor de atencao.
- `.legenda-critico`: cor critica.
- `.legenda-selecao`: cor de selecionado.

### Graficos e resumo

- `.header-grafico`: cabecalho do grafico.
- `.subtitulo-grafico`: texto auxiliar do grafico.
- `.filtros-grafico`: botoes de unidade do grafico.
- `.btn-filtro`: botao de filtro.
- `.btn-filtro.active`: filtro selecionado.
- `.container-grafico`: area do canvas do grafico.
- `.grid-resumo-colheita`: grade dos cards de resumo.
- `.card-resumo`: card pequeno de resumo.
- `.destaque-vermelho`: borda vermelha.
- `.destaque-amarelo`: borda amarela.
- `.destaque-azul`: borda azul.
- `.destaque-verde`: borda verde.
- `.titulo-resumo`: titulo pequeno do resumo.
- `.dados-resumo`: area com icone e valor.
- `.icone-resumo`: icone do card de resumo.
- `.rodape-resumo`: texto inferior do resumo.

### Tela do engenheiro

- `.card-cadastro-produto`: card de cadastro de produto.
- `.destaque-tecnico`: destaque para problema/recomendacao tecnica.

### Tela do tecnico

- `.bloco-talhoes-tecnico`: bloco geral de talhoes do tecnico.
- `.painel-mapa-tecnico`: ajuste do mapa na tela do tecnico.
- `.lista-tarefas`: grade das tarefas do dia.
- `.tarefa-card`: card de tarefa.
- `.tarefa-card.atencao`: tarefa de atencao.
- `.tarefa-card.critica`: tarefa critica.
- `.talhao-card`: card de talhao.
- `.talhao-card.atencao`: card de talhao em atencao.
- `.talhao-card.critico`: card de talhao critico.
- `.campo-largo`: campo que ocupa duas colunas.
- `.status-sensor`: etiqueta de status de sensor.
- `.status-sensor.online`: sensor online.
- `.status-sensor.offline`: sensor offline.
- `.status-sensor.atencao`: sensor em atencao.
- `.lista-alertas`: lista dos alertas.
- `.alerta-tecnico`: card de alerta.
- `.alerta-tecnico.critico`: alerta critico.

### Tela do administrador

- `.status-usuario`: status online/offline do usuario.
- `.bolinha-status`: bolinha colorida do status.
- `.status-usuario.online`: usuario online.
- `.status-usuario.offline`: usuario offline.
- `.texto-ajuda`: texto pequeno abaixo de campo.
- `.admin-graficos`: grade dos graficos administrativos.
- `.admin-grafico-container`: area do canvas dos graficos admin.

## 5. IDs importantes usados pelo JavaScript

Os IDs conectam o HTML ao JavaScript. Se renomear um ID, tem que renomear tambem no JS.

### Login

- `formularioLogin`: formulario de login.
- `matricula`: campo de matricula.
- `senha`: campo de senha.
- `togglePassword`: botao mostrar/ocultar senha.
- `perfil-demo`: perfil usado no modo demonstracao.
- `mensagem-login`: mensagem do login.

### Engenheiro

- `tabela-telemetria-diaria`: corpo da tabela diaria.
- `tabela-talhao-mensal`: corpo da tabela mensal.
- `graficoColheita`: canvas do grafico de colheita.
- `formulario-plantio`: formulario de cadastro de produto.
- `mensagem-plantio`: mensagem do cadastro de produto.
- IDs com `talhao-...`: campos preenchidos ao selecionar um talhao.

### Tecnico

- `lista-tarefas`: cards de tarefas do dia.
- `lista-talhoes`: cards de talhoes.
- `form-inspecao`: formulario de inspecao.
- `tabela-inspecoes`: historico de inspecoes.
- `form-ocorrencia`: formulario de ocorrencia.
- `tabela-sensores`: tabela de sensores.
- `form-problema-sensor`: formulario de problema no sensor.
- `lista-alertas`: cards de alerta.

### Admin

- `form-funcionario`: cadastro de funcionario.
- `funcionario-matricula`: matricula gerada automaticamente.
- `tabela-funcionarios`: tabela prevista para funcionarios cadastrados.
- `tabela-sessoes`: tabela de usuarios ativos.
- `grafico-colheita-anual`: grafico de colheita.
- `grafico-clima-mensal`: grafico de clima.

## 6. O que fazer com `ids.indexOf(id)!`

O arquivo `ids.indexOf(id)!` esta vazio e nao e chamado por nenhuma pagina. Provavelmente foi criado por acidente durante alguma edicao.

Recomendacao: remover antes da entrega para deixar o projeto limpo.

## 7. O `index.html` esta servindo para algo?

Sim. O `index.html` serve como porta de entrada do sistema.

Ele faz duas coisas:

- mostra um botao para acessar o login;
- se ja existir uma sessao salva, o `js/index.js` redireciona automaticamente para o painel correto.

Recomendacao: manter o `index.html`, mas melhorar o texto visual para explicar que ele e a entrada do FrutLog.

## 8. Para que serve `.vscode`

A pasta `.vscode` guarda configuracoes locais do Visual Studio Code.

No projeto atual, o arquivo `.vscode/settings.json` contem:

```json
{
  "liveServer.settings.port": 5501
}
```

Isso faz o Live Server abrir o projeto na porta `5501`. Nao afeta diretamente o sistema em producao.

Recomendacao: pode manter se todo o grupo usa VS Code e Live Server. Se quiser um projeto mais limpo/independente, pode remover do controle de versao.

## 9. O que editar quando o backend estiver pronto

### Em `js/global.js`

Trocar:

```js
const AUTENTICACAO_API_ATIVA = false;
```

Para:

```js
const AUTENTICACAO_API_ATIVA = true;
```

Confirmar tambem:

```js
const API_BASE_URL = "http://localhost:3000/api";
```

Esse endereco deve bater com o backend.

### Em `js/login.js`

O login real ja esta preparado em `realizarLogin()`. O backend precisa responder algo parecido com:

```json
{
  "sucesso": true,
  "usuario": {
    "id": 1,
    "matricula": "1001",
    "nome": "Carlos",
    "perfil": "engenheiro"
  },
  "token": "token-jwt-aqui"
}
```

### Em `js/eng.js`

Descomentar/adaptar a chamada de cadastro de plantio:

```js
await FrutLog.apiFetch("/plantios", {
  method: "POST",
  body: JSON.stringify(dadosFormulario),
});
```

Tambem sera bom trocar os dados fixos de talhoes e colheitas por chamadas GET da API.

### Em `js/tec.js`

Descomentar/adaptar:

- `POST /inspecoes`
- `POST /ocorrencias`
- `POST /sensores/problemas`

E trocar os arrays fixos de `talhoes`, `sensores`, `alertas`, `tarefasDia` e `historicoInspecoes` por dados vindos da API.

### Em `js/admin.js`

Descomentar/adaptar:

- `POST /funcionarios`

Tambem buscar do backend:

- funcionarios cadastrados;
- sessoes ativas;
- dados dos graficos administrativos.

## 10. Lista de melhorias para preparar o sistema

1. Criar `js/mock-data.js` para centralizar dados falsos temporarios.
2. Criar `js/api.js` com funcoes como `listarTalhoes()`, `criarPlantio()`, `listarSensores()` e `criarFuncionario()`.
3. Criar `API_CONTRATO.md` com todas as rotas esperadas do backend.
4. Padronizar nomes com acento nos textos visuais: Tecnico -> Tecnico, Historico -> Historico, Talhao -> Talhao, etc. Se o grupo quiser, usar acentos reais: Técnico, Histórico, Talhão.
5. Remover o arquivo vazio `ids.indexOf(id)!`.
6. Decidir se `.vscode` fica ou sai do controle de versao.
7. Adicionar `README.md` explicando como abrir o sistema.
8. Adicionar testes para login, troca de perfil, clique em talhoes e envio de formularios.
9. Evitar repetir o SVG do mapa em tres paginas; transformar em componente ou documentar onde atualizar.
10. Criar mensagens mais profissionais no modo demonstracao, por exemplo: "Registro salvo em modo demonstracao".

## 11. Melhorias de seguranca

1. Fazer autenticacao real no backend, nunca apenas no frontend.
2. Usar senha com hash no banco, como bcrypt ou Argon2.
3. Nunca salvar senha no navegador.
4. Usar token JWT ou sessao segura validada no backend.
5. Validar perfil no backend, nao confiar somente no `sessionStorage`.
6. Proteger rotas da API por perfil: admin, tecnico e engenheiro.
7. Validar todos os dados recebidos no backend.
8. Sanitizar textos que aparecem em tabelas para evitar XSS.
9. Evitar montar HTML com `innerHTML` quando os dados vierem de usuarios; preferir `textContent` ou criar elementos com DOM.
10. Ativar HTTPS em ambiente real.
11. Configurar CORS permitindo apenas o dominio do sistema.
12. Definir tempo de expiracao da sessao.
13. Implementar logout invalidando token/sessao no backend quando possivel.
14. Bloquear tentativas repetidas de login.
15. Registrar logs de acesso e acoes importantes.
16. Separar variaveis sensiveis em `.env` no backend.
17. Nao expor chaves, senhas ou configuracoes internas no frontend.
18. Validar matricula, cargo, perfil, status, datas e numeros no backend.
19. Criar auditoria para cadastros e alteracoes administrativas.
20. Usar banco com usuario de permissao limitada, nao usuario administrador geral.

## 12. Mensagem para alinhar com o grupo

O sistema ja tem uma boa base visual e funcional, mas ainda esta em modo demonstracao. Antes do backend ficar pronto, o grupo precisa manter atualizados os nomes de classes, IDs e funcoes para nao quebrar a ligacao entre HTML, CSS e JS. Quando o backend chegar, os pontos principais de alteracao serao `js/global.js`, `js/login.js`, `js/eng.js`, `js/tec.js` e `js/admin.js`.

Prioridade para a proxima etapa:

1. limpar arquivos desnecessarios;
2. documentar as rotas da API;
3. centralizar dados simulados;
4. preparar funcoes de API;
5. reforcar seguranca no backend.
