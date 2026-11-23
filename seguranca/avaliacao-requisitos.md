# Avaliacao do enunciado - FrutLog

Revisao local em 21/11/2026, comparada com `Projeto Integrador_ Seguança da Informação 1.pdf`. Status descreve somente o que foi verificado no repositorio, `.env` local ou testes executados. Nao equivale a nota do professor.

## Pre-requisitos eliminatorios

| Requisito | Status | Verificacao |
|---|---|---|
| Repositorio GitHub com codigo do PI | Parcial | Repositorio tem remoto GitHub e projeto; permissao do professor/visibilidade ainda precisa ser confirmada. |
| Projeto funcionando na apresentacao | Parcial | Login real voltou a funcionar apos a migracao e a consulta ao Supabase confirmou as colunas TOTP/IDOR. API completa, telemetria ao vivo e ESP32 ainda precisam ser demonstrados. |
| Tag `entrega-final` ate 22/11/2026 23h59 | Pendente | Existe somente a tag `v3.0`; `entrega-final` nao existe localmente. |

## Requisitos de controles

| Requisito | Status | Verificacao |
|---|---|---|
| TOTP de 6 digitos, autenticador, QR, servidor e recuperacao de uso unico | Parcialmente validado em ambiente real | 20 testes locais passaram; login real voltou a funcionar e a consulta ao banco confirmou as colunas TOTP. Ainda faltam evidencias dos casos OTP errado/expirado/repetido e recuperacao, e confirmar a persistencia da chave no ambiente de apresentacao. |
| OTP errado/expirado/repetido recusado; senha sem OTP nao autentica | Automatizado localmente | Casos HTTP adicionados. PostgREST simulado; falta demonstracao live e evidencia. |
| IDOR em leituras e tentativas de vinculacao/alteracao | Parcialmente automatizado | A/B testa listas, telemetria, registros e status de sensor; ID alheio recebe 404. Configuracao funcional mais ampla e comandos remotos nao existem no projeto. Admin conserva acesso organizacional. |
| Codigo de missao nos logs de bloqueio dos dois controles | Implementado por variavel, mas nao configurado | OTP e IDOR geram log com `SECURITY_MISSION_CODE`; codigo oficial ainda nao fornecido. O fallback `PREENCHER` nao atende a entrega. |
| Nenhum segredo em arquivos/historico Git | Nao conforme ate rotacionar/tratar historico | `.env` nao e versionado e `arduino_secrets.h` foi removido do indice atual, mas esses arquivos estiveram em commits. Rotacione credenciais e planeje purga do historico conforme orientacao do professor. |

## Pasta `seguranca`

| Requisito | Status | Verificacao |
|---|---|---|
| README com identificacao, missao, arquitetura e checklist por controle | Parcial | Arquitetura e roteiro dos dois controles documentados; integrantes, usuarios GitHub e missao estao pendentes. |
| Modelo de 3 a 5 ameacas em no maximo uma pagina | Atende ao formato | Quatro ameacas; PDF conferido com uma pagina. |
| Declaracao de IA com ferramenta, uso e verificacao | Parcial | Ferramenta e finalidade descritas; cada integrante ainda precisa revisar, confirmar o que alterou e preencher contribuicoes reais. |
| Testes repetiveis de antes e depois para ambos os controles | Parcial | Comandos e testes automatizados locais de depois existem; nao ha procedimento/script e resultado reproduzivel da versao anterior registrado. |
| Evidencias de depois, nomes com missao, video de ate 90 segundos | Pendente | Pasta contem apenas `LEIA-ME.md`; nenhuma evidencia real foi anexada. |
| Somente dados sinteticos | Atende nos testes locais | Os testes usam usuarios/dispositivos ficticios. Conferir evidencias futuras antes de anexar. |
| `.env.example` apenas nomes de variaveis, `.gitignore` e sem segredo no historico | Parcial | Exemplo sem valores secretos e `.env` ignorado; historico ainda requer tratamento das credenciais antigas. |

## Processo, apresentacao e calendario

- Historico geral do projeto mostra commits em varios dias, branches e PRs anteriores. A autoria de cada integrante nos dois controles ainda nao pode ser conferida: as mudancas atuais estao locais e sem commits.
- Formulario com mapeamento dos controles, devido em 16/11/2026: estado nao verificavel; confirmar envio no AVA.
- Acesso do professor ao repositorio e estado do projeto online: confirmar.
- Projeto e controles precisam ser demonstrados junto ao PI em 23/12/2026; equipe deve preparar tentativa de contorno e alteracao ao vivo.
- Rever branches por integrante, commits pequenos, PRs, checkpoints e publicar `entrega-final` somente depois de revisar o commit definitivo.

## Resultado da revisao

Ainda nao e possivel afirmar que a entrega atende a todos os requisitos ou sustenta conceito Excelente. Os bloqueadores mais claros sao codigo de missao e identificacao da equipe pendentes, evidencias antes/depois ausentes, comando remoto sem implementacao, validacao completa de Supabase/hardware pendente, credenciais historicas a rotacionar/tratar e tag final inexistente. A chave TOTP precisa estar configurada de modo persistente no ambiente de apresentacao. Login real e colunas de schema TOTP/IDOR foram confirmados; isso nao valida todas as funcoes, rotas ou dispositivos. Suites locais nesta revisao: 20/20 testes de seguranca e 56/56 testes funcionais aprovados; ambos sao locais/sinteticos e nao substituem os itens acima.
