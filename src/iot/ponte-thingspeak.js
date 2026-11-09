/* =========================================================================
   FRUTLOG - PONTE IOT: ThingSpeak  ->  leitura_sensor
   =========================================================================

   POR QUE ESTA PONTE EXISTE
   -------------------------
   O ESP32 (hardware/IOT ESP32/sketch_sep14a) publica por MQTT no ThingSpeak,
   e nao na API do FrutLog. Resultado: os graficos funcionam (a rota
   GET /telemetria/thingspeak le o canal direto), mas a tabela `leitura_sensor`
   do nosso banco fica vazia -- e e dela que vivem o mapa, o painel de detalhes
   e a IA Preditiva (src/ia/predador-nucleo.js). Por isso tudo aparece como
   "Sem leitura" mesmo com o sensor ligado.

   O README ja descrevia esta ponte ("A ponte IoT envia ao endpoint
   /api/iot/telemetria..."), mas ela nunca tinha sido escrita. Este arquivo e ela.

        ESP32 --MQTT--> ThingSpeak --[ESTA PONTE]--> POST /api/iot/telemetria
                                                              |
                                                       leitura_sensor
                                                              |
                                             mapa + detalhes + Predador

   POR QUE LER DO THINGSPEAK EM VEZ DE MUDAR O FIRMWARE
   ----------------------------------------------------
   1. Nao exige reprogramar o ESP32 que esta no campo.
   2. O ThingSpeak continua alimentando os graficos que ja funcionam.
   3. A IOT_API_KEY fica aqui no servidor, lida do .env. Se o ESP32 postasse
      direto na API, a chave teria que morar dentro do .ino -- um arquivo que
      vai para o Git. Chave em codigo-fonte e chave vazada.

   POR QUE NAO ESCREVE NO BANCO DIRETO
   -----------------------------------
   Esta ponte NAO usa a service key do Supabase. Ela fala com a mesma rota
   publica que um ESP32 usaria, autenticando com a IOT_API_KEY. Assim toda a
   validacao da rota continua valendo: dispositivo precisa existir, o talhao
   informado precisa bater com o do dispositivo, e o sensor daquela metrica
   precisa estar ativo. A ponte nao tem poder nenhum que o ESP32 nao tenha.

   COMO RODAR
   ----------
     node --env-file=.env src/iot/ponte-thingspeak.js --simular   <- COMECE AQUI
     node --env-file=.env src/iot/ponte-thingspeak.js --uma-vez
     node --env-file=.env src/iot/ponte-thingspeak.js

   --simular le o ThingSpeak e mostra na tela o que SERIA enviado, sem gravar
   nada. Rode esse primeiro: a partir do segundo modo a ponte escreve no banco
   de producao.

   O servidor do FrutLog (npm run dev) precisa estar de pe em TODOS os modos,
   inclusive no --simular: e dele que vem tanto a rota /api/iot/telemetria
   quanto o catalogo de sensores explicado abaixo.

   DE ONDE VEM O NOME DO SENSOR
   ----------------------------
   De lugar nenhum deste arquivo. A ponte pergunta ao servidor, a cada rodada,
   quais sensores estao ativos (GET /api/iot/sensores), e de la vem o
   identificador do dispositivo, o talhao e a metrica de cada um.

   A razao e uma regra simples: o nome do sensor e escolhido por quem cadastra,
   na tela Sensores do admin, e esse deve ser o UNICO lugar onde ele existe.
   Na primeira versao desta ponte o nome tambem ficava escrito aqui, e era
   preciso manter os dois iguais na mao -- um "A1" virando "A-1" nao gerava
   erro nenhum, so fazia a leitura sumir sem explicacao.

   O que sobrou em configuracao foi so o formato do canal: qual coluna
   (field1, field2...) carrega qual grandeza. Isso e verdade sobre o
   ThingSpeak, nao sobre a fazenda, e nao e nome de sensor nenhum.
   ========================================================================= */

const fs = require("fs");
const path = require("path");

// -------------------------------------------------------------------------
// 1. DE-PARA: coluna do ThingSpeak  ->  metrica do FrutLog
// -------------------------------------------------------------------------
// O ThingSpeak so sabe "field1 = 33.10". Ele nao faz ideia de qual talhao e,
// nem de qual dispositivo veio: numero de coluna nao e nome de ninguem. A
// identidade do sensor se perde no caminho, e alguem precisa devolve-la.
//
// Esta tabela diz APENAS qual coluna carrega qual grandeza. Isso e verdade
// sobre o FORMATO DO CANAL, nao sobre a fazenda -- por isso pode morar em
// configuracao. Sao os mesmos numeros que a rota GET /telemetria/thingspeak
// ja usa (api/[...route].js), para as duas telas nunca discordarem.
//
// O NOME DO SENSOR NAO ESTA AQUI, E ISSO E DE PROPOSITO.
// Ele vem do cadastro da tela Sensores do admin, lido a cada rodada por
// buscarCatalogo(). Antes esse nome ficava escrito neste arquivo, e era
// preciso digitar o mesmo texto em dois lugares; divergir nao dava erro
// nenhum, so fazia a leitura nunca chegar. Agora quem cadastra escolhe o
// nome e a ponte obedece -- inclusive se o nome mudar com a ponte no ar.
//
// INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: chuva removida (a API nao aceita mais)
// As chaves so aceitam os tres valores de TYPES em api/[...route].js:
//   "temperatura" | "umidadeSolo" | "umidadeAr"
// Qualquer outra coisa a rota devolve 400 e a leitura e descartada.
const CAMPO_DA_METRICA = {
  temperatura: Number(process.env.THINGSPEAK_FIELD_TEMPERATURE) || 1,
  umidadeAr: Number(process.env.THINGSPEAK_FIELD_HUMIDITY) || 2,
  umidadeSolo: Number(process.env.THINGSPEAK_FIELD_SOIL_HUMIDITY) || 3,
};
// FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
// -------------------------------------------------------------------------
// 1b. QUAIS CAMPOS VEM DO MESMO APARELHO FISICO
// -------------------------------------------------------------------------
// O DHT11 mede temperatura E umidade do ar no mesmo chip: ele devolve as duas
// ou nenhuma. Quando a leitura falha, o sketch do ESP32 publica `0` no campo
// de temperatura e nada no de umidade -- e esse zero nao e uma temperatura, e
// um defeito disfarcado de medicao.
//
// O numero confirma: das 1223 leituras do canal, 1217 trazem as duas grandezas
// e 6 nao trazem nenhuma. NAO EXISTE um unico caso de uma vir sem a outra.
// Por isso a regra nao e "zero e suspeito" (0 °C e uma temperatura possivel em
// outros lugares), e sim "faltou uma das duas, entao o aparelho falhou".
//
// POR QUE ISSO IMPORTA MAIS DO QUE PARECE: sem este filtro, um sensor
// quebrado publicando 0 °C vira um talhao "NORMAL com leitura fresca" aos
// olhos do Predador -- o pior dos mundos, porque esconde o defeito em vez de
// mostra-lo. Com o filtro, a leitura e descartada e o talhao cai em
// SEM_DADOS, que e a verdade: nao sabemos a temperatura dali.
//
// Cada grupo lista campos do MESMO aparelho. Campo que nao esta em grupo
// nenhum continua sendo avaliado sozinho.
const APARELHOS_FISICOS = [
  { nome: "DHT11", campos: ["field1", "field2"] },
];

// -------------------------------------------------------------------------
// 1c. ATE ONDE O CURSOR PODE AVANCAR
// -------------------------------------------------------------------------
// Regra em uma frase: o cursor sobe enquanto tudo deu certo e PARA na
// primeira falha -- nao na ultima.
//
// O BUG QUE ISTO CORRIGE (existia desde a primeira versao da ponte):
// o codigo fazia `if (todasAceitas) cursor = leitura.entry_id` dentro do laco.
// Com a leitura 10 recusada e as 11 e 12 aceitas, o cursor terminava em 12 --
// passando POR CIMA da 10. Na rodada seguinte a ponte pedia `entry_id > 12` e
// a leitura 10 desaparecia para sempre, em silencio. O comentario antigo dizia
// "se a rota recusar, o id nao avanca", e isso so era verdade quando a
// recusada era a ultima do lote.
//
// Separado em funcao pura de proposito: e o tipo de logica que erra calado,
// entao precisa de teste. Depende de `resultados` vir em ordem crescente de
// entry_id, que e como buscarLeituras() entrega.
function cursorFinal(resultados, cursorInicial) {
  let cursor = cursorInicial;
  for (const resultado of resultados) {
    if (!resultado.ok) break;
    cursor = Number(resultado.entry_id);
  }
  return cursor;
}

/** Diz se a leitura inteira deve ser descartada por falha de aparelho. */
function aparelhoFalhou(leitura) {
  for (const aparelho of APARELHOS_FISICOS) {
    const presentes = aparelho.campos.filter((campo) => {
      const bruto = leitura[campo];
      if (bruto === null || bruto === undefined || String(bruto).trim() === "") return false;
      // Zero so conta como ausencia dentro de um grupo: e assim que o sketch
      // sinaliza falha. Fora de grupo, zero continua sendo valor valido
      // (0 mm de chuva, por exemplo, e informacao legitima).
      return Number(String(bruto).replace(",", ".")) !== 0;
    });

    // Nem tudo veio, mas tambem nao veio nada: aparelho sem resposta.
    if (presentes.length > 0 && presentes.length < aparelho.campos.length) {
      return { falhou: true, aparelho: aparelho.nome, motivo: "leitura parcial" };
    }
    if (presentes.length === 0 && aparelho.campos.some((campo) => leitura[campo] !== undefined)) {
      return { falhou: true, aparelho: aparelho.nome, motivo: "nenhuma grandeza respondeu" };
    }
  }
  return { falhou: false };
}

// Lembrete que continua valendo na hora de cadastrar: a rota POST /sensores
// recusa (409) um segundo sensor com o mesmo identificador no mesmo
// dispositivo. Entao, para o mesmo ESP32 medir temperatura E umidade do ar,
// sao dois cadastros com identificadores diferentes, ambos no mesmo talhao.

// -------------------------------------------------------------------------
// 2. CONFIGURACAO
// -------------------------------------------------------------------------
// Tudo por variavel de ambiente, com padrao razoavel. Credencial nenhuma mora
// neste arquivo: ele vai para o Git, o .env nao (ver .gitignore).
const CANAL = process.env.THINGSPEAK_CHANNEL_ID;
const CHAVE_LEITURA = process.env.THINGSPEAK_READ_API_KEY;
const CHAVE_IOT = process.env.IOT_API_KEY;
const PORTA = Number(process.env.PORT || 3000);
const API_BASE = process.env.PONTE_API_BASE || `http://127.0.0.1:${PORTA}`;

// De quanto em quanto tempo a ponte acorda, no modo continuo.
// O ESP32 publica a cada 20s (delay(20000) no .ino) e o plano gratuito do
// ThingSpeak exige ~15s entre mensagens; 60s pega tudo sem martelar o servico.
const INTERVALO_SEGUNDOS = Number(process.env.PONTE_INTERVALO_SEGUNDOS) || 60;

// Quantas leituras pedir por rodada. 100 cobre ~33 minutos de ESP32 a cada 20s,
// entao mesmo que a ponte fique um tempo fora do ar ela se recupera sozinha.
const LOTE = Math.min(Number(process.env.PONTE_LOTE) || 100, 8000);

// Pausa entre um envio e o seguinte.
// O servidor aceita 120 requisicoes por minuto por IP (rateLimit em
// api/[...route].js) e responde 429 acima disso. Na importacao do historico a
// ponte dispara centenas de POSTs seguidos e bate nesse teto em segundos.
//
// 550ms da ~109 envios por minuto: abaixo do teto, com folga para a consulta
// do catalogo que abre cada rodada. Importar 900 leituras leva ~8 minutos --
// e esse e o preco certo. A alternativa seria afrouxar o limite do servidor,
// trocando uma defesa real contra abuso por pressa numa tarefa que roda uma
// vez. No regime normal (uma leitura a cada 20s) a pausa nem aparece.
const PAUSA_MS = Number(process.env.PONTE_PAUSA_MS) || 550;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Onde a ponte anota ate onde ja importou. Sem isso, cada rodada reenviaria o
// mesmo historico e a tabela leitura_sensor encheria de duplicata.
const ARQUIVO_ESTADO =
  process.env.PONTE_ARQUIVO_ESTADO || path.join(__dirname, "ponte-estado.json");

const MODO_SIMULACAO = process.argv.includes("--simular");
const MODO_UMA_VEZ = process.argv.includes("--uma-vez");

// -------------------------------------------------------------------------
// 3. ESTADO: ate onde ja importamos
// -------------------------------------------------------------------------
// O ThingSpeak numera cada leitura com um entry_id que so cresce. Guardando o
// ultimo que entrou, a proxima rodada pede so o que veio depois.
//
// O try/catch nao e preguica: na primeira execucao o arquivo nao existe, e um
// arquivo corrompido nao pode derrubar a ponte. Nos dois casos o certo e
// recomecar do zero, e o de-para abaixo evita reenvio de qualquer jeito.
function lerEstado() {
  try {
    const bruto = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, "utf8"));
    return { ultimoId: Number(bruto.ultimoId) || 0 };
  } catch {
    return { ultimoId: 0 };
  }
}

function gravarEstado(estado) {
  // Em simulacao nao se grava estado: senao o "teste" marcaria as leituras como
  // ja importadas e a rodada real seguinte acharia que nao tem nada a fazer.
  if (MODO_SIMULACAO) return;
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2), "utf8");
}

// -------------------------------------------------------------------------
// 4. LER O THINGSPEAK
// -------------------------------------------------------------------------
async function buscarLeituras(ultimoId) {
  const parametros = new URLSearchParams({ results: String(LOTE) });
  // Canal publico dispensa chave de leitura -- e o caso do canal "Temperatura"
  // deste projeto. So mandamos api_key quando ela existe de fato: enviar vazia
  // nao quebra, mas esconde do log a diferenca entre "canal publico" e "chave
  // errada", que sao dois problemas bem diferentes de diagnosticar.
  if (CHAVE_LEITURA) parametros.set("api_key", CHAVE_LEITURA);

  const resposta = await fetch(
    `https://api.thingspeak.com/channels/${encodeURIComponent(CANAL)}/feeds.json?${parametros}`
  );
  if (!resposta.ok) {
    throw new Error(`ThingSpeak respondeu HTTP ${resposta.status}`);
  }

  const corpo = await resposta.json();
  const feeds = Array.isArray(corpo.feeds) ? corpo.feeds : [];

  // Segundo filtro, por cima do estado em disco: mesmo que o arquivo suma, o
  // entry_id garante que uma leitura ja enviada nao volta.
  return feeds
    .filter((leitura) => Number(leitura.entry_id) > ultimoId)
    .sort((a, b) => Number(a.entry_id) - Number(b.entry_id));
}

// -------------------------------------------------------------------------
// 4b. CATALOGO: perguntar ao FrutLog quais sensores existem
// -------------------------------------------------------------------------
// Esta e a parte que faz o nome do cadastro valer. A ponte pergunta ao
// servidor "quais sensores estao ativos?" e recebe, para cada um, o
// identificador do dispositivo, o talhao e a metrica -- exatamente o que ela
// precisa para montar o envio.
//
// Continua valendo a regra do cabecalho: a ponte NAO le o Supabase. Ela fala
// com a API pela mesma porta e com a mesma x-iot-key que ja usava. Nao ganhou
// poder nenhum que um ESP32 nao tenha.
async function buscarCatalogo() {
  const resposta = await fetch(`${API_BASE}/api/iot/sensores`, {
    headers: { "x-iot-key": CHAVE_IOT },
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    const dica =
      resposta.status === 401
        ? "A IOT_API_KEY da ponte esta diferente da que o servidor carregou."
        : "O servidor do FrutLog esta de pe? (npm run dev)";
    throw new Error(`GET /api/iot/sensores -> HTTP ${resposta.status}: ${corpo.mensagem || "(sem mensagem)"}. ${dica}`);
  }

  const corpo = await resposta.json();
  return Array.isArray(corpo.sensores) ? corpo.sensores : [];
}

// Transforma o catalogo do servidor na lista que traduzir() consome.
// Aqui mora a unica ambiguidade real do desenho: um canal do ThingSpeak tem
// UMA coluna por grandeza. Se dois talhoes tiverem sensor de temperatura
// ativo, field1 nao tem como dizer de qual deles veio o valor. Nesse caso a
// ponte prefere nao alimentar nenhum dos dois a chutar e gravar a leitura no
// talhao errado -- numero errado no banco e pior que numero faltando, porque
// o Predador acredita nele.
function montarMapa(catalogo) {
  const porMetrica = new Map();
  for (const sensor of catalogo) {
    const lista = porMetrica.get(sensor.tipo) || [];
    lista.push(sensor);
    porMetrica.set(sensor.tipo, lista);
  }

  const mapa = [];
  for (const [tipo, lista] of porMetrica) {
    const numero = CAMPO_DA_METRICA[tipo];

    if (!numero) {
      console.warn(`   AVISO: a metrica "${tipo}" nao tem coluna definida neste canal; ignorada.`);
      continue;
    }

    if (lista.length > 1) {
      console.warn(
        `   AVISO: ${lista.length} sensores ativos medem "${tipo}" (${lista.map((s) => `${s.sensorId}@${s.talhao}`).join(", ")}).\n` +
        `          O canal so tem um field${numero}, entao nao da para saber de qual talhao e o valor.\n` +
        `          Nenhum sera alimentado. Desative os excedentes na tela Sensores, ou use um canal por ESP32.`
      );
      continue;
    }

    const sensor = lista[0];
    mapa.push({
      campo: `field${numero}`,
      tipo,
      unidade: sensor.unidade,
      dispositivo: sensor.sensorId,
      talhao: sensor.talhao,
    });
  }

  return mapa;
}

// -------------------------------------------------------------------------
// 5. TRADUZIR: uma linha do ThingSpeak vira N leituras do FrutLog
// -------------------------------------------------------------------------
// Uma linha do canal traz varios campos de uma vez (field1, field2...). Cada
// campo preenchido vira UMA chamada a rota, porque leitura_sensor e tabela de
// formato longo: uma linha por medicao, o valor na coluna `valor`.
function traduzir(leitura, mapa) {
  const medicoes = [];

  // Aparelho que nao respondeu nao gera medicao nenhuma -- nem o campo que
  // "veio". Importar meia leitura de um sensor quebrado e pior que nao
  // importar: o Predador trataria como dado bom.
  const falha = aparelhoFalhou(leitura);
  if (falha.falhou) return medicoes;

  for (const regra of mapa) {
    const bruto = leitura[regra.campo];

    // Campo ausente ou vazio nao e zero -- e "nao medido". Tratar como 0
    // criaria leitura falsa de 0 °C e 0% de umidade em todo talhao.
    if (bruto === null || bruto === undefined || String(bruto).trim() === "") continue;

    const valor = Number(String(bruto).replace(",", "."));
    if (!Number.isFinite(valor)) continue;

    medicoes.push({
      sensorId: regra.dispositivo,
      talhao: regra.talhao,
      tipo: regra.tipo,
      valor,
      unidade: regra.unidade,
      // O horario e o do ThingSpeak, nao o de agora. Importar leitura antiga
      // com a hora atual mentiria para o Predador (que descarta leitura com
      // mais de IA_VALIDADE_LEITURA_MINUTOS) e estragaria a serie temporal de
      // que o Degrau 2 (tendencia) vai precisar.
      timestamp: leitura.created_at,
    });
  }

  return medicoes;
}

// -------------------------------------------------------------------------
// 6. ENVIAR PARA A API DO FRUTLOG
// -------------------------------------------------------------------------
async function enviar(medicao, tentativa = 1) {
  const resposta = await fetch(`${API_BASE}/api/iot/telemetria`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Mesma credencial que um ESP32 usaria. Nao e a chave do Supabase.
      "x-iot-key": CHAVE_IOT,
    },
    body: JSON.stringify(medicao),
  });

  // Freio de mao entre envios, para nao estourar o limite do servidor.
  // Fica aqui, e nao no laco, porque enviar() so e chamada no modo real --
  // a simulacao nao toca na rede e nao tem motivo para ser lenta.
  await dormir(PAUSA_MS);

  // 429 nao e recusa, e "volte mais tarde": a leitura esta correta, so chegou
  // rapido demais. A janela do servidor e de 60s, entao esperamos ela virar e
  // tentamos de novo em vez de descartar a medicao.
  if (resposta.status === 429 && tentativa <= 3) {
    console.warn(`   limite de requisicoes atingido; aguardando a janela virar (tentativa ${tentativa}/3)...`);
    await dormir(61000);
    return enviar(medicao, tentativa + 1);
  }

  if (resposta.ok) return { ok: true };

  const corpo = await resposta.json().catch(() => ({}));
  return { ok: false, status: resposta.status, mensagem: corpo.mensagem || "(sem mensagem)" };
}

// -------------------------------------------------------------------------
// 7. UMA RODADA
// -------------------------------------------------------------------------
// Guarda a ultima lista de sensores impressa, so para nao repetir a mesma
// linha a cada 60s. Quando voce mexe no cadastro, a linha muda e aparece --
// e essa e a confirmacao visivel de que a ponte seguiu o seu cadastro.
let assinaturaDoMapa = "";

async function rodar() {
  // O catalogo e relido a cada rodada de proposito: cadastrar, renomear ou
  // desativar um sensor na tela passa a valer na rodada seguinte, sem
  // reiniciar a ponte e sem tocar em codigo.
  const mapa = montarMapa(await buscarCatalogo());

  if (!mapa.length) {
    console.log(
      `[${new Date().toLocaleTimeString("pt-BR")}] nenhum sensor ativo utilizavel.\n` +
      "   Cadastre na tela Sensores do admin (o talhao precisa estar ativo) e a ponte pega sozinha."
    );
    return;
  }

  const assinatura = mapa.map((regra) => `${regra.campo}->${regra.tipo}@${regra.talhao} (${regra.dispositivo})`).join(", ");
  if (assinatura !== assinaturaDoMapa) {
    assinaturaDoMapa = assinatura;
    console.log(`   cadastro lido: ${assinatura}`);
  }

  const estado = lerEstado();
  const leituras = await buscarLeituras(estado.ultimoId);

  if (!leituras.length) {
    console.log(`[${new Date().toLocaleTimeString("pt-BR")}] nada novo no canal (ultimo id importado: ${estado.ultimoId})`);
    return;
  }

  console.log(`\n[${new Date().toLocaleTimeString("pt-BR")}] ${leituras.length} leitura(s) nova(s) no ThingSpeak`);

  let enviadas = 0;
  let recusadas = 0;
  // Leitura em que o aparelho falhou. Nao e erro da ponte nem da rota: e o
  // sensor que nao respondeu. Vale contar em separado para a diferenca entre
  // "o sensor esta ruim" e "a importacao esta com problema" ficar visivel.
  let descartadas = 0;
  // Resultado de cada leitura, na ordem em que vieram. O cursor e calculado
  // so no fim, por cursorFinal(), em vez de ser empurrado dentro do laco.
  const resultadosPorLeitura = [];

  for (const leitura of leituras) {
    // Aparelho que nao respondeu: a leitura conta como RESOLVIDA (ok), porque
    // tentar de novo traria o mesmo lixo -- o dado ruim e o que esta gravado
    // no ThingSpeak. Travar o cursor aqui pararia a importacao para sempre na
    // primeira falha do DHT.
    const falha = aparelhoFalhou(leitura);
    if (falha.falhou) {
      descartadas += 1;
      resultadosPorLeitura.push({ entry_id: leitura.entry_id, ok: true });
      continue;
    }

    const medicoes = traduzir(leitura, mapa);

    // Comeca como `true` para o caso de zero medicoes (valor ilegivel, por
    // exemplo): nao ha o que enviar, logo nao ha o que repetir. Na versao
    // anterior isso comecava como `medicoes.length > 0`, e uma leitura com
    // texto no lugar do numero travava o cursor para sempre.
    let todasAceitas = true;

    for (const medicao of medicoes) {
      if (MODO_SIMULACAO) {
        console.log(`   [simulado] ${medicao.talhao} ${medicao.tipo.padEnd(12)} ${String(medicao.valor).padStart(7)} ${medicao.unidade}  (${medicao.sensorId} @ ${medicao.timestamp})`);
        enviadas += 1;
        continue;
      }

      const resultado = await enviar(medicao);
      if (resultado.ok) {
        enviadas += 1;
      } else {
        recusadas += 1;
        todasAceitas = false;
        console.warn(`   RECUSADA  ${medicao.talhao} ${medicao.tipo} (${medicao.sensorId}) -> HTTP ${resultado.status}: ${resultado.mensagem}`);
      }
    }

    resultadosPorLeitura.push({ entry_id: leitura.entry_id, ok: todasAceitas });
  }

  // Ate onde a ponte pode dizer que importou: para na primeira falha, nao na
  // ultima. A regra inteira esta em cursorFinal(), com teste.
  const maiorIdAceito = cursorFinal(resultadosPorLeitura, estado.ultimoId);

  gravarEstado({ ultimoId: maiorIdAceito });

  const rotulo = MODO_SIMULACAO ? "seriam enviadas" : "enviadas";
  console.log(`   ${rotulo}: ${enviadas} | recusadas: ${recusadas} | descartadas (aparelho falhou): ${descartadas} | ultimo id importado: ${maiorIdAceito}`);

  if (recusadas > 0) {
    console.log(
      // Como o mapa agora vem do proprio cadastro, erro de nome deixou de ser
      // causa possivel: a ponte envia exatamente o que o servidor listou.
      // Estes 403 so sobram em casos de corrida -- o sensor foi desativado ou
      // o talhao arquivado entre a leitura do catalogo e o envio.
      "\n   403 'Dispositivo nao autorizado'      -> o dispositivo foi desativado durante a rodada\n" +
      "   403 'Dispositivo nao pertence ao talhao' -> o dispositivo mudou de talhao durante a rodada\n" +
      "   403 'Sensor ou metrica nao autorizada'   -> o sensor foi desativado durante a rodada\n" +
      "   401 'Credencial IoT invalida'            -> IOT_API_KEY diferente da que o servidor carregou\n" +
      "   429 'Muitas requisicoes'                 -> rajada acima de 120/min; aumente PONTE_PAUSA_MS no .env\n" +
      "   Em qualquer um deles a leitura NAO se perde: o id nao avanca e a proxima rodada tenta de novo."
    );
  }
}

// -------------------------------------------------------------------------
// 8. ENTRADA
// -------------------------------------------------------------------------
function conferirConfiguracao() {
  const faltando = [];
  if (!CANAL) faltando.push("THINGSPEAK_CHANNEL_ID");
  // THINGSPEAK_READ_API_KEY nao entra aqui de proposito: o canal deste projeto
  // e publico e dispensa chave. Exigir ela travaria a ponte sem motivo.
  //
  // A IOT_API_KEY agora e exigida ATE em simulacao: mesmo sem gravar nada, a
  // ponte precisa perguntar ao servidor quais sensores existem, e essa
  // pergunta e autenticada. Em troca, o --simular virou um teste de verdade:
  // ele prova que o cadastro chegou ate aqui antes de voce gravar no banco.
  if (!CHAVE_IOT) faltando.push("IOT_API_KEY");

  if (faltando.length) {
    console.error(`Configuracao ausente no .env: ${faltando.join(", ")}`);
    process.exit(1);
  }
}

async function principal() {
  conferirConfiguracao();

  console.log("FrutLog - Ponte IoT ThingSpeak -> leitura_sensor");
  console.log(`   canal ThingSpeak : ${CANAL}`);
  console.log(`   API do FrutLog   : ${API_BASE}/api/iot/telemetria`);
  console.log(`   catalogo         : ${API_BASE}/api/iot/sensores (lido a cada rodada)`);
  console.log(`   colunas do canal : ${Object.entries(CAMPO_DA_METRICA).map(([m, n]) => `field${n}=${m}`).join(", ")}`);
  console.log(`   estado em        : ${ARQUIVO_ESTADO}`);
  if (MODO_SIMULACAO) console.log("   MODO SIMULACAO: nada sera gravado no banco.");

  await rodar();

  if (MODO_SIMULACAO || MODO_UMA_VEZ) return;

  console.log(`\nRodando a cada ${INTERVALO_SEGUNDOS}s. Ctrl+C para parar.`);
  setInterval(() => {
    // O erro de uma rodada nao pode derrubar a ponte: o ThingSpeak cai, a rede
    // oscila, o servidor reinicia. Loga e espera a proxima.
    rodar().catch((erro) => console.error("Falha na rodada:", erro.message));
  }, INTERVALO_SEGUNDOS * 1000);
}

// So roda quando chamada direto pelo terminal. Antes, `principal()` era
// invocada sempre que o arquivo fosse carregado -- o que impedia escrever
// teste para traduzir() e aparelhoFalhou(), porque so o `require` ja tentaria
// falar com o ThingSpeak e com o banco.
if (require.main === module) {
  principal().catch((erro) => {
    console.error("Falha na ponte IoT:", erro.message);
    process.exitCode = 1;
  });
}

// Exportadas para teste. Sao as duas funcoes puras da ponte: entra uma leitura
// do ThingSpeak, sai o que seria enviado -- sem rede, sem banco, sem .env.
module.exports = {
  APARELHOS_FISICOS,
  CAMPO_DA_METRICA,
  aparelhoFalhou,
  cursorFinal,
  traduzir,
  montarMapa,
};
