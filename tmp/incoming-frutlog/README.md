# FrutLog — Sistema de Gestão Agrícola e Monitoramento IoT

Sistema web completo para gestão agrícola, monitoramento de talhões com sensores IoT, acompanhamento de telemetria em tempo real, registro de inspeções de campo e controle administrativo de usuários.

---

## 🌾 Sobre o Projeto

O **FrutLog** centraliza o ciclo operacional do cultivo agrícola através de painéis especializados por perfil de atuação:

*   **Engenheiro Agrônomo:** Edição sincronizada da geometria e da área dos talhões, acompanhamento de dados reais de sensores e cadastro de ciclos de plantio.
*   **Técnico Agrícola:** Monitoramento de campo, inspeções, ocorrências, problemas em sensores e envio de relatório diário.
*   **Administrador:** Gestão de funcionários e sensores, dados operacionais consolidados, mapa e acompanhamento de relatórios.

---

## 🏛️ Arquitetura do Sistema

A arquitetura do FrutLog é projetada para garantir segurança, desacoplamento e integridade dos dados:

```text
[Sensores / ESP32]
       │ (MQTT c/ TLS porta 8883)
       ▼
 [Broker MQTT] (Mosquitto / EMQX)
       │ (Assinatura privada frutlog/+/telemetria)
       ▼
 [Ponte Privada Node.js]
       │ (HTTPS POST /api/iot/telemetria c/ X-IoT-Key)
       ▼
 [Backend API Node.js] (api/[...route].js)
       │ (PostgREST c/ Service Role)
       ▼
 [Banco de Dados Supabase / PostgreSQL] (Modelo Operacional Singular)
       ▲
       │ (Sessão JWT Bearer / HTTPS)
 [Frontend Web] (Dashboards Engenheiro, Técnico e Admin)
```

> [!IMPORTANT]
> O frontend nunca se conecta diretamente ao broker MQTT nem armazena chaves de serviço do banco. Toda a comunicação de IoT passa pela ponte privada autenticada.

---

## 💾 Banco de Dados Consolidado (Supabase)

O banco de dados foi unificado no **modelo operacional singular**. O esquema cria estrutura, restrições, índices, triggers, views e partições, mas não insere usuários, fazendas, talhões, sensores ou registros operacionais de exemplo:

📁 [`supabase/schema_oficial_atualizado.sql`](supabase/schema_oficial_atualizado.sql) (referência consolidada para uma instalação nova).

`supabase/schema.sql` e as migrações numeradas são mantidos para preservar o histórico; não reaplique o esquema de referência em um banco já em operação.

### Tabelas Principais
*   `organizacao`: Entidade gestora da propriedade.
*   `usuario`: Contas com perfis (`administrador`, `engenheiro`, `tecnico`) e senha com hash seguro PBKDF2.
*   `fazenda`: Propriedade rural vinculada à organização.
*   `talhao`: Talhões e geometrias cadastrados para cada fazenda.
*   `cultura` e `cultivar`: Espécies e variedades plantadas.
*   `ciclo_cultura`: Safras e ciclos ativos de plantio.
*   `dispositivo` e `sensor`: Hardwares e grandezas monitoradas (`temperatura`, `umidadeSolo`, `umidadeAr`, `chuva`).
*   `leitura_sensor`: Histórico de telemetria registrado.
*   `inspecao`, `ocorrencia`, `problema_sensor`: Registros operacionais de campo.
*   `colheita`: Histórico anual de produtividade.

---

## 🚀 Como Executar o Projeto

### 1. Configurar o Banco de Dados
1. Em uma instalação nova, abra o **SQL Editor** do Supabase e execute `supabase/schema_oficial_atualizado.sql`.
2. Em instalações existentes, aplique apenas as migrações pendentes na ordem histórica: `006`, `007`, `008`, `009`, `010`, `011`, `012` e `014` a `022` (sem reaplicar o esquema-base; `013` é uma rotina de recuperação de senha de Admin). A 018 repara colunas de ciclos e inspeções e a tabela de ocorrências; a 019 permite excluir sensores com suas leituras e corrige a visão de telemetria; a 020 completa a coluna de usuário do ciclo e permite colheitas sem ciclo ativo; a 021 registra o autor da colheita; a 022 mantém o registro de problemas mesmo quando não há sensor cadastrado.
3. Não execute importações legadas para inicializar uma instalação vazia. Em ambientes existentes, preserve e revise os dados antes de aplicar qualquer script de migração.

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha as credenciais:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sua-chave-service-role
JWT_SECRET=gere-uma-chave-aleatoria-com-pelo-menos-32-caracteres
IOT_API_KEY=gere-uma-chave-forte-para-os-dispositivos
FRONTEND_ORIGIN=http://localhost:5500
PORT=3000
BOOTSTRAP_ADMIN_PASSWORD=
THINGSPEAK_CHANNEL_ID=id-do-canal
THINGSPEAK_READ_API_KEY=chave-de-leitura-privada
THINGSPEAK_FIELD_TEMPERATURE=1
THINGSPEAK_FIELD_HUMIDITY=2
THINGSPEAK_FIELD_SOIL_HUMIDITY=3
THINGSPEAK_FIELD_RAINFALL=4
```

Preencha os valores ThingSpeak com o canal real do hardware e mantenha a chave de leitura apenas no `.env` do servidor. Os números de campo são ajustáveis caso o firmware publique métricas em outra ordem.

O relatório diário é salvo no banco e fica disponível nas telas de Engenharia e Administração; o sistema não envia e-mail nem notificação externa. O cadastro inicial do administrador exibe a senha provisória somente uma vez. Se ela foi perdida, defina temporariamente `ADMIN_RESET_PASSWORD` no `.env` (8 a 10 caracteres) e execute `npm.cmd run reset-admin-password`; a rotina altera a senha da matrícula `admin` existente e solicita sua troca no próximo acesso. Remova o valor temporário do `.env` depois da redefinição. Isso não cria uma segunda conta nem habilita uma conta desativada.

O Administrador cadastra os sensores e os associa a um talhão. Engenharia e Técnico visualizam os sensores ativos desse talhão; na inspeção, o sensor é opcional e só pode ser escolhido se estiver cadastrado naquele talhão. O sensor aparecer como cadastrado/ativo não significa que já transmitiu leituras: o status Online depende da comunicação do dispositivo. Edições do mapa salvas pela Engenharia ficam no banco; os demais painéis atualizam ao voltar à página ou em até 15 segundos. O cadastro de colheita pode ser vinculado ao ciclo ativo mais recente do talhão; sem ciclo ativo, o registro de colheita continua permitido.

O assistente web do Admin busca ocorrências recentes e o estado dos sensores através da API autenticada. O chatbot independente em `chatboot/` pode usar o mesmo contexto se `FRUTLOG_API_TOKEN` estiver configurado localmente; consulte `chatboot/README.md`.

As senhas novas, temporárias ou alteradas devem possuir de 8 a 10 caracteres. Esta validação também é aplicada no endpoint de login; contas existentes com senhas maiores que 10 caracteres precisarão ter a credencial redefinida antes de adotar esta versão.

### 3. Iniciar o Servidor
No diretório do projeto, execute:

```powershell
npm start
```

O servidor iniciará em `http://localhost:3000` (com a API respondendo em `/api`).

---

## 🔐 Provisionar o primeiro administrador

O bootstrap inicial cria o Administrador Master com matrícula `admin`. Se `BOOTSTRAP_ADMIN_PASSWORD` estiver definida no `.env` local, o comando usa esse valor; caso contrário, gera uma senha aleatória de 10 caracteres. A senha é exibida apenas uma vez e deve possuir de 8 a 10 caracteres. Configure o `.env` e, após executar as migrações, rode:

```powershell
npm.cmd run bootstrap-admin
```

Guarde a senha mostrada no terminal. Ela não pode ser recuperada pelo banco e deverá ser alterada no primeiro acesso. O comando falha de forma explícita se já houver qualquer usuário no banco. Para usar uma senha de bootstrap definida pela operação, informe-a em `BOOTSTRAP_ADMIN_PASSWORD` somente no `.env` local (não versionado); mantenha a senha fora dos arquivos do repositório.

---

Se a matrícula `admin` já existir ou for necessário redefinir seu acesso, gere um hash com `npm.cmd run password-hash -- "senha-temporaria-de-8-a-10"`, substitua o marcador em [`supabase/013_reparar_admin.sql`](supabase/013_reparar_admin.sql) e execute o script no SQL Editor. O hash usa o mesmo PBKDF2 do backend; a senha será provisória e deverá ser alterada no primeiro login.

## 📡 Ingestão de telemetria IoT

A ponte IoT envia ao endpoint `/api/iot/telemetria` leituras reais de sensores previamente cadastrados. O corpo JSON contém `sensorId`, `talhao`, `tipo`, `valor` numérico e `unidade`; a requisição também precisa enviar a chave privada do servidor no cabeçalho `X-IoT-Key`.
---

## 🌐 Catálogo de Rotas da API (`/api`)

A API suporta tanto **endpoints granulares REST** (para consultas específicas de componentes) quanto **endpoints compostos BFF** (para carregamento veloz em uma única requisição):

### Autenticação, Saúde e IoT
| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/health` | Verifica status da API e conexão ao banco. | Pública |
| `POST` | `/api/login` | Autentica matrícula/senha e emite token JWT. | Pública |
| `POST` | `/api/iot/telemetria` | Ingestão de leitura enviada pela ponte privada MQTT. | Header `X-IoT-Key` |
| `GET` | `/api/telemetria/thingspeak` | Proxy autenticado de leituras climáticas ThingSpeak; usa segredo somente no servidor. | Autenticado |
| `GET` | `/api/telemetria/diaria` | Histórico diário agregado de leituras por talhão. | Autenticado |

### Painéis Compostos (BFF)
| Método | Rota | Descrição | Perfil Permitido |
|---|---|---|---|
| `GET` | `/api/painel-engenheiro` | Retorna talhões, sensores, inspeções e tarefas agregadas. | Engenheiro, Admin |
| `GET` | `/api/painel-tecnico` | Retorna dados operacionais agregados para o técnico de campo. | Técnico, Admin |

### Rotas REST Granulares
| Método | Rota | Descrição | Perfil Permitido |
|---|---|---|---|
| `GET` | `/api/talhoes` | Lista todos os talhões cadastrados na fazenda. | Autenticado |
| `GET` | `/api/sensores` | Lista sensores de campo com status e última leitura. | Autenticado |
| `GET` / `POST` | `/api/inspecoes` | Consulta ou registra inspeção de rotina em talhão. | Técnico, Admin |
| `GET` / `POST` | `/api/ocorrencias` | Consulta ou reporta anomalia operacional. | Técnico, Admin |
| `GET` / `POST` | `/api/sensores/problemas` | Consulta ou registra chamado de manutenção em sensor. | Técnico, Admin |
| `GET` / `POST` | `/api/plantios` | Consulta ciclos ou cadastra novo plantio agrícola. | Engenheiro, Admin |
| `GET` | `/api/alertas` | Lista notificações ativas de limiares de sensores. | Autenticado |
| `GET` / `POST` | `/api/funcionarios` | Consulta equipe ou cadastra novo funcionário com perfil. | Admin |
