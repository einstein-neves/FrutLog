# Manual de Acesso ao FrutLog — Autenticação em Duas Etapas

## 1. Introdução

Boa tarde novo usuario do FrutLog nosso sistema utiliza uma autenticação em duas etapas como uma camada adicional de segurança para proteger o acesso dos usuários ao sistema. 

Por isso além da matrícula e da senha fornecidas pelo administrador, o usuário precisa confirmar sua identidade por meio de um segundo código de verificação.

Este documento apresenta o passo a passo para realizar o primeiro acesso e utilizar os métodos de autenticação disponíveis.

## 2. Primeiro acesso ao sistema

Antes de começar, o usuário precisa receber do administrador:

- Matrícula de acesso;
- Senha inicial;
- Orientações sobre o perfil de acesso disponibilizado.

### Passo 1 — Entrar no sistema

1. Acesse a página de login do FrutLog.
2. Informe a matrícula fornecida pelo administrador.
3. Digite sua senha.
4. Realize o login.

Após essa etapa, o sistema apresentará o processo de autenticação em duas etapas.

## 3. Autenticação pelo Microsoft Authenticator

Esse método utiliza um aplicativo autenticador para gerar códigos de verificação.

### Passo 1 — Selecionar o método

Na tela de autenticação, selecione a opção Microsoft Authenticator.

### Passo 2 — Escanear o QR Code

1. Abra o aplicativo Microsoft Authenticator no celular.
2. Selecione a opção para adicionar uma conta.
3. Escolha a opção de leitura de QR Code.
4. Escaneie o QR Code apresentado pelo FrutLog.

### Passo 3 — Informar o código

1. Após cadastrar a conta, o aplicativo começará a gerar códigos de verificação.
2. Consulte o código apresentado no aplicativo.
3. Digite o código na tela do FrutLog.
4. Confirme a autenticação.

Se o código for aceito, o acesso será liberado e o usuário será direcionado à página correspondente ao seu perfil.

**Atenção:** o QR Code e a etapa de configuração podem expirar. Caso isso aconteça, será necessário realizar o login novamente e repetir o processo. Não compartilhe o QR Code ou os códigos de autenticação com outras pessoas.

## 4. Autenticação por código enviado ao e-mail

Outra possibilidade de autenticação utilizada no sistema é o envio de um código de verificação por e-mail.

### Passo 1 — Selecionar o método

Na tela de autenticação, escolha a opção de recebimento do código por e-mail.

### Passo 2 — Verificar a caixa de entrada

1. Acesse o e-mail associado à sua conta.
2. Procure a mensagem enviada pelo FrutLog.
3. Consulte o código recebido.

Caso não encontre a mensagem, verifique também a caixa de spam.

### Passo 3 — Confirmar o acesso

1. Retorne à página do FrutLog.
2. Digite o código recebido por e-mail.
3. Confirme a autenticação.

Após a validação, o sistema libera o acesso à página correspondente ao perfil do usuário.

O sistema também informa que o código possui validade de **5 minutos**. Portanto, realize a confirmação dentro desse período.

## 5. Acesso conforme o perfil do usuário

Após concluir a autenticação, o usuário é direcionado à área correspondente ao seu perfil.

Durante os testes de utilização, foram observados os seguintes exemplos:

- **Engenheira:** acesso à página de engenheira após a autenticação pelo Microsoft Authenticator.
- **Técnico:** acesso à página de técnico após a autenticação por código enviado ao e-mail.

As permissões e funcionalidades disponíveis dependem do perfil cadastrado para cada conta.

## 6. Problemas comuns durante o acesso

| Problema | Orientação |
|---|---|
| QR Code expirado | Realize o login novamente e gere um novo QR Code. |
| Código do autenticador não aceito | Confira se está utilizando o código atual do aplicativo. |
| Código enviado por e-mail expirado | Solicite um novo código e utilize-o dentro do prazo de 5 minutos. |
| E-mail não recebido | Verifique a caixa de spam e confira se está acessando o e-mail correto. |
| Acesso não liberado | Confira os dados informados e repita o processo de autenticação. Se o problema continuar, procure o administrador. |
|configurações de hora de algum dispositivo incorreta| se algum dispositivo estiver com a hora desconfigurada o seu codigo de acesso sempre estara expirado sempre verifique se ambos os dispositivos estão com as horas corretas|

## 7. Observações da experiência de utilização

Durante uma entrevista com uma usuária que testou o sistema, foram identificadas algumas observações:

- O primeiro acesso depende do recebimento da matrícula e da senha pelo administrador.
- A configuração pelo Microsoft Authenticator exige a leitura do QR Code.
- Quando o QR Code expirou durante a configuração, foi necessário realizar o login novamente.
- A usuária relatou que não recebeu um aviso claro na tela informando que o tempo havia expirado.
- A autenticação por e-mail foi considerada mais rápida e simples durante a experiência relatada.
- O sistema apresentou uma informação sobre a validade de 5 minutos do código enviado por e-mail.

Essas observações ajudam a orientar novos usuários e também apontam oportunidades de melhoria na experiência de autenticação.

## 8. Recomendações de segurança

- Não compartilhe sua matrícula e senha.
- Não envie seu QR Code de configuração para outras pessoas.
- Não compartilhe códigos de autenticação.
- Utilize somente os métodos de autenticação disponibilizados pelo sistema.
- Não tente reutilizar códigos expirados.
- Em caso de dificuldade de acesso, procure o administrador responsável.

## 9. Considerações finais

A autenticação em duas etapas adiciona uma camada de proteção ao FrutLog, dificultando o acesso indevido mesmo quando uma senha é conhecida por terceiros.

Seguindo este manual, novos usuários poderão realizar a configuração inicial, autenticar-se e acessar as funcionalidades correspondentes ao seu perfil.