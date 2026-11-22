# Alteracoes de seguranca no FrutLog

## Objetivo e resultado

Este documento explica as mudancas feitas para exigir autenticacao em dois fatores no acesso ao painel e limitar os dados de sensores ao usuario responsavel por cada dispositivo. A senha deixa de ser suficiente para criar uma sessao: depois dela, o usuario confirma um codigo TOTP do aplicativo autenticador. Nas rotas de sensores, a API usa o usuario da sessao para filtrar dispositivos, leituras e registros associados.

As mudancas afetam o login, o cadastro administrativo de sensores, o banco de dados e os endpoints que consultam telemetria. A implantacao exige aplicar as migracoes e configurar uma chave de cifragem antes que os usuarios possam entrar.

## O que mudou no login

### Primeiro acesso

1. O usuario informa matricula e senha.
2. A API cria um desafio temporario e apresenta um QR Code e um segredo manual para cadastrar o FrutLog no Google Authenticator, Microsoft Authenticator, Authy ou aplicativo compatível.
3. O usuario informa o codigo de seis digitos gerado pelo aplicativo.
4. Depois da validacao, a conta recebe uma sessao e o sistema apresenta dez codigos de recuperacao. Cada codigo pode ser usado uma vez; a tela pede que o usuario os guarde antes de continuar.

### Acessos seguintes

Depois de validar matricula e senha, o usuario informa o codigo TOTP atual. A tela também permite usar um codigo de recuperacao. O servidor recusa codigos vencidos, tentativas acima do limite e o reuso de um mesmo passo TOTP. Um desafio dura cinco minutos e aceita ate cinco tentativas.

O segredo TOTP e cifrado no banco com AES-256-GCM. Os codigos de recuperacao sao armazenados como HMAC, associados a conta e consumidos atomicamente. O QR, o segredo manual e a lista de recuperacao nao sao gravados em texto puro no banco.

## O que mudou no acesso a dispositivos

Cada registro de dispositivo agora tem `responsavel_usuario_id`. O administrador escolhe um funcionario ativo da mesma organizacao ao cadastrar ou reatribuir um dispositivo no painel.

Para usuarios comuns, as consultas de sensores e telemetria incluem o identificador da sessao como filtro de responsavel. Assim, alterar no navegador o UUID de um sensor nao amplia o acesso. Quando uma inspeção ou um problema referencia um sensor, a API consulta novamente o dispositivo, a organizacao, o talhao e o responsavel antes de gravar o registro.

Dispositivos que ja existiam antes da migracao ficam sem responsavel. Eles continuam visiveis ao administrador para provisionamento, mas nao aparecem para usuarios comuns ate que sejam atribuidos.

## Onde a mudanca impacta

| Area | Alteracao | Impacto pratico |
|---|---|---|
| API de login | `POST /login` agora inicia o desafio; `POST /login/otp` valida TOTP ou recuperacao e so entao emite sessao. | O frontend e os clientes de login precisam usar a segunda etapa. |
| Tela de login | Mostra QR no primeiro acesso, campo TOTP, opcao de recuperacao e confirmacao para guardar codigos. | Cada usuario precisa de um aplicativo autenticador no primeiro acesso. |
| Painel administrativo | O cadastro de sensor exige responsavel; a tabela permite reatribuir o dispositivo. | Administradores devem atribuir dispositivos existentes e novos. |
| Consultas de sensores | `/sensores`, `/telemetria/talhao/:codigo`, `/telemetria/diaria`, `/chatbot/contexto`, `/predador/analise` e painéis de campo aplicam o escopo do responsavel. | Um usuario comum ve dados apenas dos dispositivos atribuídos a ele. |
| Inspecoes, problemas e alertas | Consultas e vinculacoes relacionadas a sensor consideram a posse do dispositivo. | IDs enviados pelo cliente sao conferidos no servidor. |
| Banco Supabase | Novos campos de TOTP e responsavel, tabela de desafios, tabela de codigos de recuperacao e visao diaria por dispositivo. | As migracoes 030 e 031 precisam ser aplicadas na ordem indicada. |
| Seguranca e evidencias | Foram adicionados testes sinteticos A/B e documentos de ameacas, uso de IA e entrega. | Os testes nao conectam ao banco de producao; evidencias da equipe ainda devem ser produzidas. |

## Arquivos principais

- `api/[...route].js`: fluxo TOTP, filtros por responsavel e validacao de vinculos por ID.
- `api/totp.js`: geracao e verificacao TOTP, cifragem do segredo, QR URI e codigos de recuperacao.
- `api/database.js`: consultas de fazendas limitadas a organizacao da sessao.
- `supabase/030_login_otp.sql` e `supabase/031_totp_idor.sql`: estrutura e funcoes do banco para desafios, recuperacao e propriedade de dispositivo.
- `publico/login.html`, `publico/js/login.js`, `publico/js/auth.js` e `publico/css/login.css`: telas e tratamento da segunda etapa.
- `publico/admin.html` e `publico/js/admin.js`: selecao e reatribuicao de responsavel pelo administrador.
- `testes/seguranca/`: cenarios HTTP com usuarios e dispositivos sinteticos e testes do algoritmo TOTP.
- `seguranca/`: README da entrega, modelo de ameacas, declaracao de uso de IA e orientacoes para evidencias.

## Preparacao para implantacao

1. Aplique `supabase/030_login_otp.sql` e depois `supabase/031_totp_idor.sql`, junto das migracoes anteriores do projeto.
2. Configure `TOTP_ENCRYPTION_KEY` com pelo menos 32 caracteres aleatorios e mantenha o mesmo valor entre implantacoes. Uma chave nova ou perdida impede a leitura dos segredos TOTP ja cifrados; os usuarios afetados terao de reconfigurar o autenticador por procedimento administrativo.
3. Configure `SECURITY_MISSION_CODE` quando a equipe receber o codigo oficial da atividade. O codigo ainda nao foi fornecido e, por isso, os documentos usam marcadores para preenchimento posterior.
4. Publique API e frontend atualizados.
5. Entre como administrador e atribua os dispositivos existentes aos funcionarios corretos. Depois, cada usuario podera cadastrar seu autenticador no proximo login.
6. Execute `npm run test:seguranca` e produza as evidencias reais antes/depois com dados sinteticos. Nao inclua QR ativo, codigos de recuperacao, tokens, senhas ou dados pessoais nas evidencias.

## Verificacao realizada

Na revisao de 21/11/2026, `npm run test:seguranca` passou em 20 testes e `npm run teste` passou em 56 testes funcionais. Os cenarios usam dados sinteticos; a API foi exercitada com PostgREST simulado. Isso nao substitui aplicacao e validacao das migracoes no Supabase de entrega nem teste no ESP32.

## Limites conhecidos

- Administradores mantem visao operacional dos dispositivos da propria organizacao para atribui-los e gerencia-los.
- A integracao IoT usa uma chave de maquina compartilhada e nao uma credencial individual por dispositivo. Ela nao usa sessao humana; a chave deve permanecer no servidor e ser rotacionada se exposta.
- O codigo oficial da missao, os nomes e matriculas da equipe, a URL do repositorio e as evidencias de execucao precisam ser preenchidos pela equipe. Nenhum desses dados foi inventado.
