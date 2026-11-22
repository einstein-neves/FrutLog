# Autenticacao TOTP e propriedade de dispositivos

O login exige matricula, senha e codigo temporario de seis digitos de um aplicativo autenticador compatível (Google Authenticator, Microsoft Authenticator ou Authy). No primeiro login, a API entrega um QR Code e um segredo manual; a conta somente recebe uma sessao depois de confirmar um codigo TOTP. O desafio expira em cinco minutos, aceita no maximo cinco tentativas e e consumido atomicamente. Codigos TOTP ja usados sao recusados. A ativacao tambem gera dez codigos de recuperacao de uso unico, exibidos uma vez.

## Ativacao

1. Em banco existente, aplique `supabase/030_login_otp.sql` e depois `supabase/031_totp_idor.sql`; a 029 de notificacoes por email e opcional para TOTP. Em banco novo, execute primeiro `schema_oficial_atualizado.sql`. Ver `supabase/README.md` para detalhes.
2. Configure `TOTP_ENCRYPTION_KEY` no ambiente da API com pelo menos 32 caracteres aleatorios e mantenha a mesma chave entre implantacoes. Exemplo para gerar localmente: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Se a chave for perdida ou trocada, os segredos cifrados existentes deixam de ser validos e cada usuario precisara reconfigurar o autenticador por um procedimento administrativo.
3. Instale as dependencias e publique API e frontend juntos. O frontend usa `qrcode` no servidor; o segredo TOTP nunca e persistido em texto puro.
4. Em cada primeiro acesso, digitalize o QR no app autenticador, confirme o codigo e guarde os dez codigos de recuperacao em local seguro. Nao compartilhe QR, segredo manual, OTP ou codigos de recuperacao.

Os segredos TOTP sao cifrados com AES-256-GCM. Os codigos de recuperacao sao armazenados como HMAC, associados ao usuario e removidos atomicamente no primeiro uso. Configure tambem `SECURITY_MISSION_CODE` quando a equipe receber o codigo da atividade; ele aparece nos eventos de bloqueio IDOR. Nao substitua esse valor por um codigo inventado.

## Posse dos dispositivos e IDOR

Cada dispositivo possui `responsavel_usuario_id`. Administradores atribuem ou reatribuem o dispositivo no painel; somente funcionarios ativos da mesma organizacao podem ser escolhidos. Endpoints de sensores, leituras, problemas e alertas filtram os dispositivos pelo identificador da sessao. Ao associar um sensor a uma inspeção ou problema, a API valida novamente a posse. IDs enviados pelo navegador nunca definem a autorizacao. A integracao IoT usa uma chave de servidor e e uma identidade maquina separada das sessoes humanas.

Dispositivos existentes ficam sem responsavel apos a migracao e nao aparecem para usuarios comuns ate serem atribuidos no painel. O administrador conserva visao operacional para realizar a atribuicao.

## Verificacao local

Execute `npm run test:seguranca` para os testes de TOTP, sessao e isolamento A/B. Eles usam somente registros sinteticos e nao conectam ao Supabase de producao. A equipe deve guardar evidencias reais de execucao na pasta `seguranca/evidencias/` sem dados pessoais, tokens, codigos MFA ou segredos.
