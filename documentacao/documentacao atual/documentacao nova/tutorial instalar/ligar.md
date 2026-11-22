# Instalação e inicialização do FrutLog

Este guia explica como preparar o ambiente local e iniciar o servidor do FrutLog.

## Requisitos

- Windows com PowerShell (os comandos abaixo também podem ser adaptados para outros terminais).

- Node.js 20.6 ou superior e npm. O servidor usa `node --env-file` para carregar as configurações.

- Acesso ao projeto Supabase configurado para o FrutLog.

Para conferir as versões instaladas:

```powershell
node --version
npm --version
```

## 1. Abrir a pasta do projeto

No PowerShell, navegue até a pasta raiz que contém `package.json`. Exemplo:

```powershell
cd C:\caminho\para\FrutLog-main
```

## 2. Instalar as dependências

Na primeira instalação, ou depois de alterações nas dependências, execute:

```powershell
npm install
```

O projeto usa Node.js e npm. As bibliotecas declaradas em `package.json` serão instaladas em `node_modules`.

## 3. Configurar o arquivo `.env`

O servidor precisa de configurações locais para conectar ao Supabase e atender a API. Crie ou edite `.env` na raiz do projeto (na mesma pasta de `package.json`) e preencha os valores reais:

```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
IOT_API_KEY=
FRONTEND_ORIGIN=
PORT=
BOOTSTRAP_ADMIN_PASSWORD=
THINGSPEAK_CHANNEL_ID=
THINGSPEAK_READ_API_KEY=
THINGSPEAK_FIELD_TEMPERATURE=
THINGSPEAK_FIELD_HUMIDITY=
THINGSPEAK_FIELD_SOIL_HUMIDITY=
THINGSPEAK_FIELD_RAINFALL=
```

Ajuste `FRONTEND_ORIGIN` para a origem usada para abrir o frontend. Se o frontend for servido por outra porta ou endereço, informe essa origem. Os campos ThingSpeak só são necessários para a integração com esse serviço; use os números correspondentes ao canal e ao firmware. Não compartilhe nem versiona o `.env`, pois ele contém credenciais.

> O repositório não inclui um `.env.example` na raiz. Use os nomes de variáveis acima como referência e confirme os valores com quem administra o ambiente Supabase/IoT.

## 4. Preparar o banco de dados (primeira instalação)

Para um banco Supabase novo, abra o SQL Editor do projeto e execute `supabase/schema_oficial_atualizado.sql`. Esse esquema cria a estrutura, mas não cria fazendas, sensores nem outros dados operacionais.

Para um banco já em uso, não reaplique o esquema oficial por cima. Consulte o README da raiz e aplique somente as migrações pendentes apropriadas, preservando os dados existentes.

## 5. Criar o administrador inicial (se necessário)

Depois de configurar o `.env` e preparar o banco, rode uma única vez:

```powershell
npm.cmd run bootstrap-admin
```

Guarde a senha exibida no terminal: ela é mostrada apenas uma vez. Se `BOOTSTRAP_ADMIN_PASSWORD` estiver definida, o comando usa esse valor. A senha deve ter de 8 a 10 caracteres.

## 6. Iniciar o FrutLog

Na pasta raiz, execute:

```powershell
npm.cmd start
```

A API ficará disponível em `http://localhost:3000`; a verificação de saúde pode ser acessada em `http://localhost:3000/api/health`. Mantenha essa janela do terminal aberta enquanto usar o sistema. Para parar o servidor, pressione `Ctrl+C`.

Durante o desenvolvimento, use o modo que reinicia o servidor quando os arquivos mudam:

```powershell
npm.cmd run dev
```

## Inicialização rápida depois da primeira configuração

Quando as dependências já estiverem instaladas e o `.env` e o banco configurados:

```powershell
cd C:\caminho\para\FrutLog-main
npm.cmd start
```

Depois, abra o frontend conforme a forma como ele está sendo servido no seu ambiente.

## Problemas comuns

- **`node` ou `npm` não reconhecido:** instale o Node.js 20.6 ou superior e abra um novo PowerShell.
- **Erro sobre `.env` ou variáveis ausentes:** confira se `.env` está na raiz, ao lado de `package.json`, e se os nomes e valores estão corretos.
- **Erro ao conectar ao Supabase:** confira `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, acesso à internet e se o esquema foi aplicado ao banco correto.
- **A porta 3000 já está em uso:** encerre o outro processo que a utiliza ou altere `PORT` no `.env`.
- **PowerShell não executa `npm`:** use `npm.cmd` nos comandos, como nos exemplos deste guia.
