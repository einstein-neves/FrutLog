# Publicacao automatica do FrutLog

O workflow `.github/workflows/qualidade-azure.yml` executa testes em Pull Requests. Um push ou merge na `main` publica a imagem somente depois que os testes passam. Acompanhe a aba Actions no GitHub. Uma execucao manual na main tambem permite publicar novamente.

Os arquivos de codigo, `Dockerfile`, `.dockerignore` e imagens devem estar commitados. `.env`, credenciais e arquivos de `tmp/` nao devem ser enviados. Uma alteracao apenas no VS Code nao modifica a producao: e necessario enviar a branch e integrar o Pull Request na main.

## Autenticacao

A identidade gerenciada `frutlog-github-deploy` autentica por OIDC, sem segredo permanente. A credencial `github-main` confia exclusivamente no emissor `https://token.actions.githubusercontent.com` e no assunto `repo:einstein-neves/FrutLog:ref:refs/heads/main`. O job publicar nao usa um GitHub Environment: isso preserva o assunto federado de branch e dispensa administracao de ambientes do repositorio.

A identidade tem AcrPush somente em `frutlogarthur20261122` e Contributor somente no Container App `frutlog-arthur`. A identidade de leitura da imagem continua sendo `frutlog-image-pull`, separada da identidade de publicacao. IDs de cliente, tenant e assinatura no workflow sao identificadores publicos, nao credenciais. As chaves do Supabase, Gmail e demais segredos continuam na Azure.

## Imagem e recursos

O GitHub constroi uma imagem Linux amd64 com o Dockerfile, envia ao registro privado e usa o SHA do commit como tag. A construcao acontece no runner, sem depender de ACR Tasks. A atualizacao altera somente a imagem do Container App; preserva recursos, escala, dominio, certificado, identidade e variaveis de ambiente.

A publicacao so e considerada concluida quando a revisao criada esta pronta e `https://frutlog.com.br/api/health` responde com sucesso. Consulte os logs do job em caso de falha. Se uma revisao nova nao ficar pronta, a revisao anterior pode continuar atendendo; confira o portal antes de tentar outra publicacao.

## Banco e reversao

O workflow valida as migracoes em PostgreSQL local em memoria e nao executa SQL na producao. Aplique migracoes necessarias no Supabase antes de integrar codigo que dependa delas. Confirme compatibilidade com a versao anterior durante a transicao.

Para reverter codigo, reverta o commit na main e integre um novo Pull Request. Isso executa novamente testes e publicacao. Reverter codigo nao desfaz migracoes SQL; confirme a compatibilidade do banco.
