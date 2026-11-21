# Seguranca do FrutLog

## 1. Identificacao

- Integrantes, matriculas e usuarios GitHub: **pendente de preenchimento pela equipe**.
- Projeto do PI: **FrutLog**.
- Codigo oficial da missao: **pendente de recebimento do professor**. A variavel `SECURITY_MISSION_CODE` ainda nao esta no `.env`; nao usar codigo sintetico na entrega.
- Repositorio/tag: repositorio GitHub FrutLog; a tag `entrega-final` ainda precisa ser criada e publicada apos a revisao final.

## 2. Projeto e arquitetura

O FrutLog monitora condicoes agricolas por sensores conectados a ESP32. A placa envia telemetria por MQTT ao ThingSpeak; a aplicacao web e a API Node.js/Express consultam e registram dados no PostgreSQL do Supabase. O login do painel e a autorizacao operacional ficam na API; a ingestao IoT usa chave de maquina.

## Controle 1 - MFA TOTP

### 3. Ameaca e impacto

Senha roubada ou reutilizada poderia permitir acesso a contas, sensores e dados operacionais.

### 4. Controle e decisao

A API exige senha e OTP TOTP de seis digitos. No primeiro acesso mostra QR/segredo manual e so conclui login depois de confirmar o codigo. Segredo fica cifrado; desafios expiram, limitam tentativas e sao consumidos uma vez; repeticao do passo e recusada; codigos de recuperacao sao HMAC e de uso unico. Uma `TOTP_ENCRYPTION_KEY` aleatoria, com pelo menos 32 caracteres, deve ser configurada de modo persistente no servidor. Arquivos: [`api/[...route].js`](../api/%5B...route%5D.js), [`api/totp.js`](../api/totp.js), [`login.js`](../publico/js/login.js), [`030_login_otp.sql`](../supabase/030_login_otp.sql), [`031_totp_idor.sql`](../supabase/031_totp_idor.sql).

### 5. Como testar

Na raiz do projeto: `npm ci` e `npm run test:seguranca`. Casos HTTP OTP: [`sessoes.test.cjs`](../testes/seguranca/sessoes.test.cjs); vetores, replay e criptografia: [`totp.test.cjs`](../testes/seguranca/totp.test.cjs). Antes de implantar, execute `npm run security:check`; o comando informa apenas nomes de variaveis ausentes/invalidas, nunca valores.

### 6. Resultado e evidencias

Depois, teste automatizado sintetico: 20/20 testes de seguranca passaram nesta revisao. Ele inclui senha correta sem OTP (sem sessao), OTP errado/expirado (recusados), OTP valido, repeticao do mesmo passo (recusada) e recuperacao de uso unico. **Antes:** nao ha captura/relatorio real da versao-base. **Depois visual/live:** ainda nao ha evidencia. A pasta [`evidencias/`](evidencias/LEIA-ME.md) tem apenas instrucoes; inserir arquivos reais com o codigo oficial no nome.

### 7. Limitacoes

O fluxo ainda precisa ser configurado com chave real, validado no Supabase de entrega e demonstrado no painel. Testes locais simulam PostgREST e nao provam implantacao. Perda da chave TOTP exige procedimento de recuperacao administrativo.

## Controle 2 - Protecao contra IDOR

### 3. Ameaca e impacto

Um usuario poderia trocar o ID de dispositivo/sensor em uma requisicao e consultar ou alterar recurso de colega da mesma organizacao, expondo leituras ou afetando operacao.

### 4. Controle e decisao

Dispositivo possui `responsavel_usuario_id`. A API filtra leituras, listas e mutacoes pela identidade da sessao; tentativas de usar ID alheio retornam 404 e geram log `IDOR_BLOQUEADO` com o codigo configurado em `SECURITY_MISSION_CODE`. Administradores conservam visao organizacional para provisionar/atribuir dispositivos. Arquivos: [`api/[...route].js`](../api/%5B...route%5D.js), [`031_totp_idor.sql`](../supabase/031_totp_idor.sql), [`idor.test.cjs`](../testes/seguranca/idor.test.cjs).

### 5. Como testar

`npm ci` e `npm run test:seguranca`. O cenario A/B usa a mesma organizacao e verifica lista, leitura bruta/agregada, vinculacao de inspecao/problema e alteracao do status do sensor. Usuario A atualiza o proprio sensor; ID do sensor B recebe 404.

### 6. Resultado e evidencias

Depois, os testes A/B sinteticos passaram dentro da suite de seguranca (20/20). **Antes:** nao ha evidencia real da revisao-base. **Depois visual/live:** ainda nao ha captura/log/vídeo. Nao ha evidencias na pasta alem das instrucoes; gerar com dados sinteticos e codigo oficial da missao no nome.

### 7. Limitacoes

O firmware atual so publica telemetria MQTT e nao implementa comandos remotos; portanto, nao existe rota de comando para demonstrar propriedade de comando. Usuarios comuns podem alterar status do proprio sensor no cadastro, nao configurar o ESP32 remotamente. Administradores tem acesso operacional a todos os dispositivos da organizacao. A chave IoT e compartilhada, nao individual por ESP32. Validar todas as rotas na implantacao real.

## Banco, configuracao e repeticao

Em banco novo, executar `schema_oficial_atualizado.sql`, depois `030_login_otp.sql` e `031_totp_idor.sql`. Em banco existente, aplicar somente migracoes pendentes. A migracao 029 de email e opcional para esses controles. Ver [`../supabase/README.md`](../supabase/README.md). As variaveis sem valores estao em [`.env.example`](../.env.example); valores reais nunca devem ser copiados para Git ou evidencias. Uma `TOTP_ENCRYPTION_KEY` local foi gerada neste ambiente e armazenada no `.env`; a equipe ainda precisa configurar de modo persistente o ambiente de entrega e obter o codigo da missao.

A suite geral `npm run teste` foi executada nesta revisao: 56/56 testes funcionais passaram. Ambas as suites usam dados sinteticos; nao foram testados Supabase, hospedagem ou ESP32 reais.

## Pendencias que impedem declarar entrega pronta

Receber codigo oficial da missao e preencher integrantes/usuarios GitHub; configurar `TOTP_ENCRYPTION_KEY`; produzir evidencias reais de antes/depois; aplicar e validar as migracoes em banco de entrega; rotacionar credenciais ESP32 que foram versionadas no passado e tratar o historico Git; confirmar formulario e acesso do professor; demonstrar o projeto funcionando no PI; completar branches/PRs e commits exigidos; criar e enviar `entrega-final`; revisar e compreender o codigo e a declaracao de IA. Nao preencher dados nem fabricar evidencias.

Declaracao de IA: [`uso-de-ia.md`](uso-de-ia.md). Modelo de ameacas: [`modelo-ameacas.md`](modelo-ameacas.md).

Checklist detalhado contra o enunciado: [`avaliacao-requisitos.md`](avaliacao-requisitos.md).
