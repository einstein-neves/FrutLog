# FrutLog

Sistema web para gestao agricola, monitoramento de talhoes, acompanhamento de sensores, registro de inspecoes de campo e controle administrativo de funcionarios.

O projeto foi desenvolvido como prototipo frontend para o Projeto Integrador. A interface ja esta preparada para integracao futura com backend e banco de dados.

## Sobre o Projeto

O FrutLog tem como objetivo auxiliar o acompanhamento da producao agricola por meio de paineis separados por perfil de usuario.

Cada perfil possui uma visao especifica do sistema:

- **Engenheiro agronomo:** acompanha talhoes, telemetria, historico mensal, previsao de colheita e cadastro de plantio.
- **Tecnico agricola:** registra inspecoes, ocorrencias, problemas em sensores e acompanha tarefas de campo.
- **Administrador:** gerencia funcionarios, visualiza usuarios ativos, mapa da fazenda e graficos gerais.

## Funcionalidades

- Tela inicial com redirecionamento por sessao.
- Login em modo demonstracao por perfil.
- Dashboard para engenheiro agronomo.
- Dashboard para tecnico agricola.
- Dashboard administrativo.
- Mapa visual dos talhoes com selecao interativa.
- Exibicao de status dos talhoes: normal, atencao e critico.
- Tabelas de telemetria, sensores, inspecoes e usuarios ativos.
- Graficos com Chart.js.
- Formularios de cadastro e registro preparados para envio ao backend.
- Controle basico de sessao usando `sessionStorage`.
- Teste smoke com Playwright para validar carregamento das paginas.

## Status Atual

O sistema esta em **modo demonstracao**.

Nesta etapa, os dados ainda sao simulados no frontend. O banco de dados e o backend ainda nao estao conectados, mas o projeto ja possui estrutura preparada para API em `js/global.js`.

Quando o backend estiver pronto, sera necessario ativar a autenticacao real e substituir os dados locais por chamadas HTTP.

## Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript
- Chart.js
- Font Awesome
- Playwright
- Live Server

## Estrutura do Projeto

```txt
.
├── admin.html
├── eng.html
├── index.html
├── login.html
├── tec.html
├── css/
│   ├── admin.css
│   ├── dashboard.css
│   ├── eng.css
│   ├── global.css
│   ├── index.css
│   ├── login.css
│   └── tec.css
├── js/
│   ├── admin.js
│   ├── eng.js
│   ├── global.js
│   ├── index.js
│   ├── login.js
│   └── tec.js
├── imagem/
│   ├── fotinha.png
│   └── mapa-FrutLog.jpg
├── frutlog-smoke.spec.js
└── RELATORIO_FRUTLOG.md
```

## Como Executar

1. Clone o repositorio:

```bash
git clone <url-do-repositorio>
```

2. Acesse a pasta do projeto:

```bash
cd <nome-da-pasta>
```

3. Abra o projeto com o Live Server.

4. Acesse a pagina inicial:

```txt
http://localhost:5501/index.html
```

Caso a porta do seu Live Server seja diferente, ajuste a URL conforme a porta exibida no VS Code.

## Como Usar em Modo Demonstracao

1. Abra `login.html`.
2. Digite uma matricula qualquer.
3. Digite uma senha com pelo menos 8 caracteres.
4. Escolha o perfil de demonstracao:
   - Engenheiro
   - Tecnico
   - Admin
5. Clique em **Entrar**.

O sistema redirecionara para o painel correspondente ao perfil escolhido.

## Preparacao Para Backend

O arquivo principal para integracao futura e:

```txt
js/global.js
```

Nele existem duas configuracoes importantes:

```js
const API_BASE_URL = "http://localhost:3000/api";
const AUTENTICACAO_API_ATIVA = false;
```

Quando o backend estiver pronto, a autenticacao real podera ser ativada alterando:

```js
const AUTENTICACAO_API_ATIVA = true;
```

Rotas previstas para integracao:

- `POST /api/login`
- `GET /api/talhoes`
- `POST /api/plantios`
- `GET /api/inspecoes`
- `POST /api/inspecoes`
- `POST /api/ocorrencias`
- `GET /api/sensores`
- `POST /api/sensores/problemas`
- `GET /api/funcionarios`
- `POST /api/funcionarios`
- `GET /api/sessoes`
- `GET /api/dashboard/colheitas`
- `GET /api/dashboard/clima`

## Observacoes de Desenvolvimento

- Os dados atuais sao demonstrativos.
- A validacao de seguranca real deve ser feita no backend.
- O frontend nao deve armazenar senhas.
- O controle de perfil feito no navegador e apenas uma simulacao ate a API estar pronta.
- O arquivo `RELATORIO_FRUTLOG.md` contem uma explicacao mais detalhada das classes, IDs, arquivos e pontos de manutencao.

## Melhorias Futuras

- Criar backend com autenticacao real.
- Integrar banco de dados.
- Centralizar dados simulados em um arquivo unico.
- Criar camada propria de API em `js/api.js`.
- Adicionar CRUD completo de funcionarios, talhoes, plantios e sensores.
- Melhorar acessibilidade do mapa.
- Adicionar mais testes automatizados.
- Substituir dependencias via CDN por arquivos locais ou processo de build.
- Implementar logs e auditoria para acoes administrativas.
- Aplicar validacoes de seguranca no backend.

## Autores

Projeto desenvolvido para fins academicos no Projeto Integrador.

Adicione aqui os nomes dos integrantes do grupo:

- Nome 1
- Nome 2
- Nome 3
- Nome 4

