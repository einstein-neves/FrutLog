# Modelo de ameacas — FrutLog

## Ativos e limites de confianca

Contas/sessoes, segredo TOTP e recuperacao, dispositivos, sensores, telemetria e registros de campo. Navegador e ESP32 sao nao confiaveis; API valida entradas e identidade. Chaves do Supabase, IoT e cifra TOTP ficam no servidor.

## Ameacas priorizadas

| Ameaca (max. 5) | Impacto | Controle | Risco/evidencia |
|---|---|---|---|
| Senha roubada ou OTP adivinhado/reutilizado | Tomada de conta | TOTP server-side, desafio curto, limite de tentativas, passo OTP consumido e recuperacao HMAC de uso unico | Validar OTP correto, incorreto, expirado, repetido e recuperacao. Compromisso do autenticador continua possivel. |
| Usuario altera ID para acessar dispositivo de colega (IDOR) | Exposicao ou alteracao de dados | Consultas e mutacoes verificam responsavel da sessao; bloqueio retorna 404 e registra evento | Teste A/B sintetico. Admin tem acesso organizacional para provisionamento. |
| Credencial IoT compartilhada e exposta | Telemetria falsa ou acesso indevido | Chave de servidor comparada em tempo constante, rate limit | Chave global nao autentica individualmente cada ESP32; rotacionar credencial exposta. |
| Chaves ou dados sensiveis vazam | Acesso ao banco/conta | `.env` ignorado; segredo TOTP cifrado e recuperacao armazenada como HMAC | Arquivos de secrets ESP32 precisam sair do Git; rotacionar e limpar historico antes da entrega. |

## Escopo e exclusoes

Testes automatizados usam dados sinteticos e PostgREST simulado; nao provam RLS, hospedagem, configuracao de producao nem funcionamento no ESP32. Evidencias reais e revisao da equipe continuam necessarias.
