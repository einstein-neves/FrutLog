# Testes de seguranca

Execute na raiz com Node.js instalado:

```powershell
npm ci
npm run test:seguranca
```

Os casos automatizados estao em `../../testes/seguranca/` e simulam PostgREST com usuarios, dispositivos e dados sinteticos. Cobrem fluxo OTP, isolamento A/B, leituras e tentativas de vinculacao/alteracao entre proprietarios. Na revisao, 20 testes de seguranca passaram. Repita apos cada alteracao e guarde a saida real em `../evidencias/`, com codigo oficial de missao no nome.

A simulacao nao valida Supabase real, RLS, hospedagem ou hardware. Os testes de referencia anteriores e evidencias visuais precisam ser executados pela equipe; nao fabrique resultados.
