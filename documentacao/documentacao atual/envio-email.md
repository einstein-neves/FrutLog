# Envio de e-mail pelo Gmail

A infraestrutura fica no servidor em `src/email/`. Usa Nodemailer com `smtp.gmail.com:465`, TLS e validação de certificado, remetente fixado na conta configurada e mensagens com texto simples e HTML. A migração 029 integra os eventos abaixo por uma fila transacional. O cadastro de conta tenta enviar as boas-vindas antes de responder; os demais eventos aguardam o worker. Não há rota pública de envio.

## Mensagens integradas

| Evento | Destinatário | Conteúdo |
| --- | --- | --- |
| Conta criada | Funcionário cadastrado | Boas-vindas, matrícula e orientação para primeiro acesso |
| E-mail cadastrado/alterado | Funcionário com esse contato | Aviso de associação do endereço |
| Senha redefinida | Titular da conta | Aviso de reset e revogação das sessões, sem enviar a senha |
| Senha alterada | Titular da conta | Confirmação de segurança, sem enviar a senha |
| Relatório diário enviado | Administração e Engenharia da organização do autor | Data e aviso de relatório disponível, sem copiar o conteúdo do relatório |
| Status do relatório alterado | Autor do relatório | Acompanhamento em análise/concluído |
| Alerta aberto | Administração, Engenharia e Técnicos da organização do talhão | Talhão, título e prioridade |
| Alerta resolvido | Mesmos perfis da organização do talhão | Aviso de resolução |

Ocorrências e problemas de sensor que criam um alerta usam o aviso de alerta: não geram um segundo e-mail pelo mesmo registro. O Predador também usa os eventos da tabela alerta. Atualizar a mensagem/temperatura de um alerta já aberto não cria outro aviso. Um diagnóstico consultado sem registrar alerta não envia e-mail. Telemetria rotineira, consultas do chatbot, filtros, login comum, edições do mapa e colheitas não geram disparos.

## Ativar notificações automáticas

1. Aplicar [029_notificacoes_email.sql](../supabase/029_notificacoes_email.sql) no SQL Editor do Supabase **antes** de publicar a API/cadastro novos. Ela adiciona `usuario.email`, cria `email_fila`, funções privadas e gatilhos. O esquema consolidado para instalações novas já inclui essa etapa. A migração não envia mensagens nem notifica registros antigos retroativamente.
2. Preencher o e-mail individual no cadastro de funcionários. Campo vazio mantém a conta sem notificações. Contas inativas não são selecionadas. O endereço é informado pela Administração; o aviso de cadastro não constitui prova de que o titular confirmou o contato.
3. Para o primeiro administrador, que não pode editar a própria conta na tela, cadastrar o contato pelo SQL Editor: `update public.usuario set email = 'email-do-admin@exemplo.com' where matricula = 'admin';`. Substituir pelo endereço correto. Isso coloca apenas um aviso de contato na fila.
4. Preencher as credenciais abaixo e, opcionalmente, `EMAIL_APP_URL=https://endereco-publico-do-frutlog/`. Sem URL, o e-mail não mostra botão de acesso; não usa localhost como endereço público.
5. Rodar `npm run email:verificar`. Depois manter `npm run email:vigiar` como processo separado no servidor, junto à API. Ele verifica a fila a cada 30 segundos. Para cron/agendador, `npm run email:processar` executa um lote de até dez mensagens e termina. Esses comandos **enviam e-mails reais** aos contatos cadastrados quando habilitados; não foram executados contra o banco real durante a implementação.

A listagem e as alterações dos contatos de funcionários foram limitadas à organização do administrador. A fila resolve destinatários dentro da organização, e o trabalhador revalida ID, endereço, organização, status e perfil antes do envio. Eventos para contato removido/alterado, conta desativada/excluída, perfil sem acesso ou com mais de 24 horas são descartados. Não existe envio retroativo para um endereço cadastrado depois do evento.

Reservas são atômicas e usam `FOR UPDATE SKIP LOCKED`, evitando que dois trabalhadores peguem a mesma notificação. Um envio aceito fica `enviado`; rejeição explícita fica `falhou`; timeout ou processo interrompido após reservar fica `incerto`. Reservas expiram em cinco minutos e não retornam automaticamente a pendente. Isso evita repetir mensagens quando o resultado SMTP é desconhecido; não é garantia de entrega exatamente uma vez. Antes de reprocessar manualmente um registro falho/incerto, conferir a caixa e o estado da entrega.

Para consultar a fila sem ler credenciais: `select tipo, status, count(*) from public.email_fila group by tipo, status order by tipo, status;`. O status não fica público na API. A tabela tem RLS e privilégios revogados de anon/authenticated; os RPCs de reserva/confirmação são exclusivos de service_role. Não conceder acesso público para depurar.

## Identidade visual e prévias

Os e-mails têm logo FrutLog embutido como imagem CID (não depende de uma URL pública), cartão claro, cores verde/âmbar/vermelho conforme o aviso, resumo e botão HTTPS. CSS em linha e tabelas favorecem clientes de e-mail; o texto simples funciona como alternativa. Clientes podem ainda bloquear imagens ou adaptar as cores; o nome FrutLog permanece em texto.

Rodar `npm run email:preview` gera oito [prévias HTML locais](previews-email/index.html) com dados fictícios e imagem embutida. Esse comando não usa o .env, não consulta o banco e não envia e-mails.

## Configurar

Os campos abaixo já foram acrescentados ao `.env` local, sem modificar as credenciais existentes. Preencha-os somente nesse arquivo ou nas variáveis privadas da hospedagem:

```dotenv
EMAIL_ENABLED=true
GMAIL_USER=conta-do-projeto@gmail.com
GMAIL_APP_PASSWORD=senha_de_aplicativo_do_google
EMAIL_FROM_NAME=FrutLog
EMAIL_APP_URL=https://endereco-publico-do-frutlog/
```

Substitua o exemplo de senha pelos 16 caracteres gerados pelo Google. Não use a senha normal da conta e não envie a chave pelo chat. Os espaços entre os quatro grupos exibidos pelo Google são aceitos e removidos internamente. O envio permanece desativado com `EMAIL_ENABLED=false`.

O arquivo `.env.email.example` contém apenas campos de referência e pode ser versionado. O `.env` e suas variantes com credenciais estão no `.gitignore`. Não preencha o arquivo de exemplo com segredos. Reinicie o processo após mudar as variáveis.

## Verificar conexão sem enviar e-mail

```powershell
npm run email:verificar
```

Esse comando verifica conexão e autenticação no Gmail. Não envia mensagens e não confirma entrega a um destinatário.

## Enviar uma mensagem de teste

Escolha um destinatário autorizado, como a própria conta do projeto:

```powershell
npm run email:teste -- seu-destinatario@exemplo.com
```

O destinatário é obrigatório. O comando envia uma única mensagem e informa se ela foi aceita pelo servidor SMTP. Confira também o spam: aceitação SMTP não garante chegada à caixa de entrada.

## Usar no backend

```js
const { criarServicoEmail } = require("./src/email"); // ajustar caminho ao arquivo chamador
const email = criarServicoEmail();

await email.enviarNotificacao({
  para: "destinatario@exemplo.com",
  titulo: "Novo aviso do FrutLog",
  mensagem: "O relatório solicitado está disponível no sistema.",
});
```

`para` aceita um único endereço simples, sem nome, cópia ou lista. Título e mensagem são tratados como texto, com escape no HTML. O serviço impede leitura de arquivos e carregamento de URLs pelo Nodemailer e não aceita anexos ou remetentes fornecidos pelo cliente. Apenas o servidor lê o arquivo fixo do logo e o incorpora como Buffer; nenhum caminho é recebido do navegador.

Erros expõem apenas códigos e mensagens controladas: `EMAIL_DISABLED`, `EMAIL_CONFIG`, `EMAIL_AUTH`, `EMAIL_INPUT`, `EMAIL_RECIPIENT` e `EMAIL_UNAVAILABLE`. Respostas brutas do SMTP, senha e logs de autenticação não são propagados. Erros de conteúdo (título/mensagem) também possuem mensagens locais sem dados do SMTP.

Ao integrar um evento do sistema, determine o destinatário no servidor a partir de cadastro autorizado. Não permita que um usuário escolha qualquer destinatário por uma rota genérica. Evite enviar senhas, tokens ou dados pessoais desnecessários em notificações. Persista a operação principal antes de notificar; uma falha de e-mail não deve desfazer o registro de campo. Para envio garantido, implementar uma fila persistente/outbox com deduplicação; o serviço atual não possui fila nem repetição automática.

## Diagnóstico

- `EMAIL_AUTH`: conferir conta, senha de aplicativo e verificação em duas etapas. O Google pode revogar senhas de aplicativo após mudanças na conta.
- `EMAIL_UNAVAILABLE`: verificar internet, DNS, acesso de saída à porta 465 na hospedagem e disponibilidade do Gmail. Não desabilitar a validação TLS.
- `EMAIL_RECIPIENT`: conferir o destinatário e eventuais restrições da conta.
- Timeout durante envio pode ocorrer depois de o servidor receber a mensagem. Confira a caixa antes de repetir para evitar duplicidade.
- Gmail possui limites e mecanismos antispam; esta configuração não é um serviço de disparos em massa.

## Testes

```powershell
npm run test:email
```

Os 17 testes de e-mail usam transporte em memória, simulações e PostgreSQL embarcado (PGlite). Exercitam o SQL real da migração, destinatários por organização/perfil, rollback, ACLs, gatilhos sem repetição, reservas e o trabalhador, além de configuração/TLS/templates/CLI. O teste de segurança da API cobre o campo de e-mail e o isolamento dos contatos. Não autenticam no Gmail e não enviam e-mail real.

Referências: [Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Nodemailer com Gmail](https://nodemailer.com/guides/using-gmail), [segurança do conteúdo da mensagem](https://nodemailer.com/message).
## Boas-vindas no cadastro

Ao criar uma conta ativa por `POST /funcionarios` ou `/admin/usuarios`, a API envia o aviso de boas-vindas ao e-mail vinculado, com matricula e orientacoes de primeiro acesso. Senhas e hashes nunca entram na mensagem. O administrador recebe `emailNotificacao` e `avisoEmail` na resposta, exibidos no formulario. Uma falha de envio nao desfaz a conta criada e nao provoca repeticao automatica de SMTP.

O envio usa a configuracao SMTP existente (`EMAIL_ENABLED`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`). Nao exige nova migracao: sem a tabela opcional `email_fila`, envia diretamente. Com a migracao 029, reserva atomicamente apenas o evento `conta_criada` daquele usuario e o confirma, compartilhando as regras do worker para evitar duplicacao. Nao processa a fila de outros usuarios. Eventos ja reservados ou processados nao sao enviados novamente pela API. Contas criadas inativas nao recebem esse aviso.
