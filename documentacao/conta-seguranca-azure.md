# Conta, operacao e publicacao no Azure

## Ativar a versao

Aplique `supabase/034_conta_seguranca_operacao.sql` depois da 033 no SQL Editor do Supabase e execute `npm run migrations:check`. O comando apenas consulta o esquema, sem alterar dados. Publique frontend e API juntos depois da conferencia. A migracao e reaplicavel e nao marca enderecos antigos como confirmados. Antes dela, nao reinicie a API com esta versao: as consultas exigem as novas colunas.

Os metodos de 2FA sao alternativas independentes, conforme solicitado pelo usuario em 22/11/2026. Aplicativo autenticador mostra QR Code para a primeira configuracao e conclui a segunda etapa com o TOTP, sem solicitar OTP de email antes ou depois. A configuracao envia as chaves de recuperacao ao endereco cadastrado sem exibi-las na tela. O uso de TOTP nao marca o email como confirmado; essa confirmacao permanece disponivel em Minha conta e seguranca. Para enderecos ainda nao confirmados, a API usa substituir_autenticador, que valida conta ativa, senha e segredo anterior e troca segredo/codigos atomicamente; para os confirmados, usa configurar_autenticador_seguro, que tambem confere email e versao. Codigo por email envia o OTP de acesso diretamente ao cadastro. Desafios legados de confirmacao continuam aceitos durante sua validade de cinco minutos.

## Minha conta e seguranca

O link esta nos tres paineis. A pagina mostra e-mail confirmado, autenticador ativo e quantidade de codigos restantes. Confirmar e-mail, encerrar sessoes, renovar codigos ou substituir autenticador exige senha atual e um codigo de seis digitos enviado para a acao escolhida. Os desafios duram cinco minutos, aceitam cinco tentativas e so podem ser utilizados uma vez pela conta que os iniciou. O intervalo de solicitacao e de um minuto.

Encerrar sessoes incrementa `sessao_versao`, invalidando tambem o navegador atual. Trocar senha, e-mail ou segredo TOTP revoga as sessoes anteriores por trigger no banco, inclusive quando a mudanca acontece fora da API. Mudar o e-mail remove sua confirmacao. Renovar codigos e uma operacao atomica e tambem revoga sessoes. SMTP e banco nao compartilham transacao; se houver erro depois de um envio, use somente os codigos da ultima configuracao confirmada.

Senhas possuem de 8 a 128 caracteres. A API usa PBKDF2 assincrono, preservando o formato dos hashes existentes. As consultas centrais ao banco tem prazo de dez segundos.

## Administracao e historicos

`admin-operacao.html` apresenta os registros de `email_entrega` e `auditoria_evento`, sempre limitados a organizacao da sessao. Aceitacao SMTP nao comprova chegada na caixa de entrada. Resultados incertos nao sao repetidos automaticamente. O reenvio manual aceita somente boas-vindas com falha confirmada e intervalo de um minuto, para o endereco atual de uma conta ativa; codigos de seguranca devem ser gerados novamente no fluxo de seguranca. Dados de mensagens, senhas e codigos nao sao armazenados nesses registros.

A auditoria registra ator, metodo, recurso, resultado HTTP e horario das mutacoes autenticadas. Se o banco da auditoria falhar depois da operacao principal, a API preserva o resultado da operacao e emite `AUDITORIA_INDISPONIVEL` no log; esse sinal deve ser monitorado. O historico nao e retroativo e nao registra alteracoes feitas diretamente pelo SQL Editor.

Relatorios possuem filtros no servidor e paginas de 25 itens. A listagem de funcionarios possui paginas de 20 itens na interface, mantendo os filtros sobre a lista carregada para os selects de responsavel; a API aceita `pagina` e `limite` para consumidores que precisem de paginacao no servidor. Auditoria e registros de e-mail sao paginados no servidor. Limites explicitos aceitam de 1 a 100 itens.

Sensores diferenciam dispositivo offline, sem comunicacao, leitura ausente, falha de medicao e leitura desatualizada. Uma comunicacao recente nao transforma uma medicao antiga em dado atual.

## Azure App Service e GitHub Actions

O workflow `.github/workflows/qualidade-azure.yml` executa os testes em PRs e na `main`. A publicacao so e habilitada quando `AZURE_WEBAPP_NAME` estiver configurada. Depois dos testes e da conferencia do esquema remoto, usa OpenID Connect para publicar em um App Service existente. Nao cria recursos nem altera o banco automaticamente.

Configure um App Service Linux com Node.js 22 e comando de inicializacao `npm start`. O processo funciona sem arquivo `.env`; em producao, as variaveis ficam nas configuracoes do App Service. Configure `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `IOT_API_KEY`, `TOTP_ENCRYPTION_KEY`, `FRONTEND_ORIGIN` com a origem HTTPS publicada e as credenciais SMTP existentes. Use o mesmo segredo TOTP entre publicacoes. Configure `EMAIL_APP_URL` com a URL HTTPS publica. `TRUSTED_PROXIES` deve refletir apenas proxies confiaveis da infraestrutura; nao habilite confianca indiscriminada em cabecalhos enviados pelo cliente.

No repositorio GitHub, configure as variaveis `AZURE_WEBAPP_NAME`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` e `AZURE_SUBSCRIPTION_ID`. O ambiente `production` precisa de credencial federada OIDC no Microsoft Entra ID, com permissao de publicar no App Service. Configure tambem os secrets `SUPABASE_URL` e `SUPABASE_SECRET_KEY` nesse ambiente para a conferencia das migracoes antes da publicacao. Esses secrets nao sao copiados para o pacote. Os demais segredos permanecem no App Service. Nao ha credenciais de Azure neste repositorio.

Preparacao e autenticacao: [documentacao oficial do Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid).

## Azure Container Apps

Publicacao de 22/11/2026: https://frutlog-arthur.yellowmeadow-61dfd024.centralus.azurecontainerapps.io

O aplicativo `frutlog-arthur` usa o ambiente `frutlog-consumo`, em Central US, com perfil Consumption, 0,5 vCPU, 1 GiB de memoria e uma replica minima e maxima. Em 22/11/2026, o usuario autorizou manter a replica ligada para evitar a inicializacao apos inatividade e aumentar os recursos de 0,25 vCPU / 0,5 GiB. A estimativa para trinta dias majoritariamente ociosos e de US$ 10 para o Container App, considerando as franquias disponiveis, mais aproximadamente US$ 5 do registro de imagens. US$ 15 por mes e uma estimativa, nao um teto: uso ativo, trafego e outros recursos podem aumentar o total. Reinicios e publicacoes ainda podem exigir inicializacao. Os logs sao transmitidos sem armazenamento em Log Analytics. O banco continua no Supabase.

Dominio de producao: https://frutlog.com.br, com certificado gerenciado e binding HTTPS. `EMAIL_APP_URL` usa esse dominio; `FRONTEND_ORIGIN` permite o dominio e a URL original da Azure.

O envio de e-mail reutiliza ate duas conexoes SMTP com TLS, por ate cem mensagens cada. Conexoes ociosas sao encerradas em um minuto e codigos nao tem reenvio automatico em caso de falha. A imagem do e-mail e lida uma vez por servico. O login invalida desafios anteriores e remove expirados em uma unica consulta. Os paineis de tecnico e engenheiro iniciam consultas independentes em paralelo, mantendo o diagnostico e a telemetria ESP32 opcionais em caso de indisponibilidade.

A imagem privada fica no registro Basic `frutlogarthur20261122.azurecr.io`; a identidade `frutlog-image-pull` tem apenas AcrPull nesse registro. As variaveis sensiveis sao secrets do Container App, referenciados pelo backend. Nao sao incorporadas a imagem. `FRONTEND_ORIGIN` e `EMAIL_APP_URL` devem acompanhar a origem HTTPS acima.

O `Dockerfile` prepara Node 22 e instala somente dependencias de producao. A `.dockerignore` restringe o contexto aos arquivos de execucao e aos dois documentos usados pelo assistente. Para novas publicacoes, construa uma imagem Linux amd64, envie ao registro privado e atualize a revisao, preservando os secrets e o limite de uma replica. A assinatura bloqueou ACR Tasks; a primeira imagem foi montada com a base oficial Node e uma camada de arquivos/dependencias JavaScript usando crane. Nao reutilize essa abordagem se houver modulos nativos compilados no Windows; nesse caso, construa em Linux.

O registro Basic tem cobranca fixa aproximada de US$ 5/mes, alem do consumo do Container Apps, trafego e eventuais construcoes. A escala maxima de uma replica limita concorrencia de instancias, mas nao representa teto monetario. O workflow de App Service descrito acima nao publica no Container Apps; essa integracao ainda nao esta configurada.

A publicacao foi conferida por HTTPS: `/login.html` e `/api/health` retornaram 200, com banco e esquema confirmados. Uma rota protegida sem sessao retornou 401 e `/.env` retornou 404. Login com MFA e entrega de e-mail real ainda exigem verificacao funcional com a conta do usuario.

## Validacao

Execute `npm run test:seguranca`, `npm run test:email`, `npm run test:chatbot`, `npm run teste`, `npm run migrations:local` e `git diff --check`. Os testes usam dados sinteticos, incluindo PostgreSQL local em memoria para as migracoes, e nao enviam mensagens reais.
