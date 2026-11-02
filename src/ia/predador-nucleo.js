//ja aqui no predador-nucleo.js sera o cerebro onde a  onde tem as estruçoes e regra de negocio aqui termos os calculos  do estresse hiodrico , umidasde de solo e ar isso gera um diagnostico 

function numeroOuNulo(valor) {
if (valor === null || valor === undefined || valor === "") return null;
const convertido = Number(valor);
return Number.isFinite(convertido) ? convertido : null;
}

//temos q  trazer metrica  , limiares ,validade de leituras,numero ou nulo do predador.js para o predador-nucleo.js  para nao expor nada do predador.js  para o cliente  e  so enviar para o servidor

const METRICAS = {
TEMPERATURA: "temperatura",
UMIDADE_SOLO: "umidadeSolo",
UMIDADE_AR: "umidadeAr",
};

const LIMIARES_PADRAO = {
temperaturaMaxima: 32.0,
umidadeSoloMinima: 45.0,
};

const VALIDADE_LEITURA_MINUTOS =
Number(process.env.IA_VALIDADE_LEITURA_MINUTOS) || 120;

// Margem de aviso previo: a quantos graus do teto o talhao ja entra em atencao.
// Essa regra nasceu no navegador (publico/js/frutlog-talhoes.js, que pintava o
// mapa de amarelo a 3 graus do limite) e veio para o nucleo para existir uma vez
// so. Sai do codigo para o .env: mudar a margem nao exige mais editar JavaScript.
const MARGEM_APROXIMACAO_C = Number(process.env.IA_MARGEM_APROXIMACAO_C) || 3;

function montarLeituraPorTalhao(cenario) {
const talhaoPorDispositivo = new Map(
cenario.dispositivos.map((d) => [d.id, d.talhao_id]),
);

const leituraPorSensor = new Map(
cenario.ultimasLeituras.map((l) => [l.sensor_id, l]),
);

const horaLimite = Date.now() - VALIDADE_LEITURA_MINUTOS * 60 * 1000;

const porTalhao = new Map();

for (const sensor of cenario.sensores) {
const talhaoId = talhaoPorDispositivo.get(sensor.dispositivo_id);

const leitura = leituraPorSensor.get(sensor.id);

if (!talhaoId || !leitura) continue;

// Descarta o que o proprio banco marcou como invalido e o que envelheceu.
if (leitura.qualidade === "invalida") continue;

const coletadoEm = new Date(leitura.coletado_em).getTime();

if (!Number.isFinite(coletadoEm) || coletadoEm < horaLimite) continue;

const valor = numeroOuNulo(leitura.valor);
if (valor === null) continue;

const registro = porTalhao.get(talhaoId) || {
    metricas: {},
    coletadoEm: null,
};

const anterior = registro.metricas[sensor.codigo_metrica];
// Um talhao pode ter mais de um sensor da mesma metrica: vale o mais novo.

if (!anterior || coletadoEm > anterior.coletadoEm) {
    registro.metricas[sensor.codigo_metrica] = {
    valor,
    unidade: leitura.unidade || sensor.unidade,
    qualidade: leitura.qualidade,
    coletadoEm,
    };
}
if (!registro.coletadoEm || coletadoEm > registro.coletadoEm) {
    registro.coletadoEm = coletadoEm;
}
porTalhao.set(talhaoId, registro);
}

return porTalhao;
}

/** Normaliza o registro do talhao no formato que a analise de risco espera. */
function leituraNormalizada(registro) {
if (!registro) return null;
const metricas = registro.metricas;

return {
temperatura: metricas[METRICAS.TEMPERATURA]?.valor ?? null,
umidadeSolo: metricas[METRICAS.UMIDADE_SOLO]?.valor ?? null,
umidadeAr: metricas[METRICAS.UMIDADE_AR]?.valor ?? null,
coletadoEm: registro.coletadoEm
    ? new Date(registro.coletadoEm).toISOString()
    : null,
suspeita: Object.values(metricas).some(
    (item) => item.qualidade === "suspeita",
),
};
}

// Monta um mapa de limiares por métrica, a partir das regras do banco de dados.
function montarLimiaresPorMetrica(regras) {
const porMetrica = new Map();

for (const regra of regras) {
if (!regra || !regra.codigo_metrica) continue;

const limiar = porMetrica.get(regra.codigo_metrica) || {
    minimo: null,
    maximo: null,
    severidade: null,
};

// Formato do repositorio: dois numeros explicitos.

const minimoDireto = numeroOuNulo(regra.valor_minimo);

const maximoDireto = numeroOuNulo(regra.valor_maximo);

if (minimoDireto !== null) limiar.minimo = minimoDireto;

if (maximoDireto !== null) limiar.maximo = maximoDireto;

// Formato do banco publicado: o operador diz se o limite e teto ou piso.
const limite = numeroOuNulo(regra.limite);

if (limite !== null && typeof regra.operador === "string") {
    const operador = regra.operador.trim();

    if (operador.startsWith(">")) limiar.maximo = limite; // dispara acima -> teto

    if (operador.startsWith("<")) limiar.minimo = limite; // dispara abaixo -> piso
}

if (regra.severidade) limiar.severidade = regra.severidade;
porMetrica.set(regra.codigo_metrica, limiar);
}

return porMetrica;
}
/** 
//* Analisa o risco agronômico usando os limiares definidos pelo Engenheiro/Admin

* @param {Object} leituraAtual - Dados vindos do ESP32 (leitura_sensor), já normalizados por métrica

* @param {Object} configTalhao 

* - Limites configurados pelo engenheiro para o talhão (Ex: temperaturaMaxima, umidadeSoloMinima)
*/
function analisarRiscoDinamico(leituraAtual, configTalhao) {
if (!leituraAtual) {
return {
    status: "SEM_DADOS",
    mensagem: "Aguardando novas leituras reais dos sensores do ESP32.",
    alerta: false,
    severidade: null,
    dados: {
    temperatura: null,
    umidade_solo: null,
    umidade_ar: null,
    coletado_em: null,
    },
};
}

// Cada metrica pode faltar isoladamente. null significa "nao medido" e fica
// fora das regras: tratar ausencia como 0 gerava alarme falso de umidade
// (0 < 45) em todo talhao que ainda nao tem sensor de solo instalado.
const temperatura = numeroOuNulo(leituraAtual.temperatura);

const umidadeSolo = numeroOuNulo(leituraAtual.umidadeSolo);

const umidadeAr = numeroOuNulo(leituraAtual.umidadeAr);

// Se o engenheiro ainda não definiu os limites para o talhão, usamos padrões seguros de fallback,
// mas a prioridade é sempre o que o engenheiro/admin cadastrou no painel!
const limiteTempMax =
configTalhao?.temperaturaMaxima ?? LIMIARES_PADRAO.temperaturaMaxima;

const limiteUmidadeMin =
configTalhao?.umidadeSoloMinima ?? LIMIARES_PADRAO.umidadeSoloMinima;

const dados = {
temperatura,
umidade_solo: umidadeSolo,
umidade_ar: umidadeAr,
coletado_em: leituraAtual.coletadoEm ?? null,
};

// Sem as duas metricas que sustentam o diagnostico nao ha o que concluir.
if (temperatura === null && umidadeSolo === null) {
return {
    status: "SEM_DADOS",
    mensagem:
    "Sem leitura recente de temperatura ou de umidade do solo neste talhão.",
    alerta: false,
    severidade: null,
    dados,
};
}

let diagnostico = {
status: "NORMAL",
mensagem: "Parâmetros dentro da faixa ideal configurada para o talhão.",
alerta: false,
severidade: null,
dados,
};

const soloSeco = umidadeSolo !== null && umidadeSolo < limiteUmidadeMin;

const calorExcessivo = temperatura !== null && temperatura > limiteTempMax;

// Regras dinâmicas baseadas na configuração do Engenheiro e  Admin
if (soloSeco && calorExcessivo) {
diagnostico.status = "ALERTA_CRITICO";
diagnostico.mensagem = `Estresse hídrico! Temp (${temperatura}°C) acima do limite máx. do talhão (${limiteTempMax}°C) e umidade crítica. Irrigação imediata!`;
diagnostico.alerta = true;
diagnostico.severidade = "critica"; // enum severidade_alerta do banco
} else if (soloSeco) {
diagnostico.status = "ATENCAO";
diagnostico.mensagem = `Umidade do solo (${umidadeSolo}%) abaixo do limite mínimo configurado (${limiteUmidadeMin}%).`;
diagnostico.alerta = true;
diagnostico.severidade = "alta";
} else if (calorExcessivo) {
diagnostico.status = "ATENCAO";
diagnostico.mensagem = `Temperatura atual (${temperatura}°C) ultrapassou o teto de segurança do talhão (${limiteTempMax}°C).`;
diagnostico.alerta = true;
diagnostico.severidade = "alta";
// Aviso previo: ainda nao ultrapassou, mas esta a menos de MARGEM_APROXIMACAO_C
// graus do teto. Precisa ser o ULTIMO da cadeia: 34°C com teto de 32 satisfaz
// esta condicao tambem, e num else-if quem vem primeiro ganha. Invertida a
// ordem, o talhao que ja estourou seria diagnosticado como "se aproximando".
// alerta fica false de proposito: aviso previo pinta de amarelo, nao toca a
// sirene. Se contasse como alerta, a lista encheria de avisos sem acao e o
// engenheiro pararia de olhar.
} else if (temperatura !== null && temperatura >= limiteTempMax - MARGEM_APROXIMACAO_C) {
diagnostico.status = "ATENCAO";
diagnostico.mensagem = `Temperatura (${temperatura}°C) se aproximando do teto do talhão (${limiteTempMax}°C).`;
diagnostico.alerta = false;
diagnostico.severidade = "media";
}

// Leitura marcada como suspeita no banco: o diagnostico vale, mas o tecnico
// precisa saber que a origem do dado esta sob suspeita.
if (leituraAtual.suspeita) {
diagnostico.mensagem += " (há leitura marcada como suspeita neste talhão)";
}

return diagnostico;
}

function montarConfigTalhao(talhao, limiaresPorMetrica) {
const limiarTemperatura = limiaresPorMetrica.get(METRICAS.TEMPERATURA);

const limiarSolo = limiaresPorMetrica.get(METRICAS.UMIDADE_SOLO);

const temperaturaMaxima =
numeroOuNulo(talhao.temperatura_maxima) ??
numeroOuNulo(limiarTemperatura?.maximo);

const umidadeSoloMinima = numeroOuNulo(limiarSolo?.minimo);

return {
temperaturaMaxima: temperaturaMaxima ?? LIMIARES_PADRAO.temperaturaMaxima,
umidadeSoloMinima: umidadeSoloMinima ?? LIMIARES_PADRAO.umidadeSoloMinima,
// Registra se o numero veio do painel ou do fallback, para o relatorio nao
// dar a entender que o engenheiro configurou algo que ele nao configurou.
temperaturaMaximaCadastrada: temperaturaMaxima !== null,
umidadeSoloMinimaCadastrada: umidadeSoloMinima !== null,
};
}

// funcção diagnosticar talhao serve  para o cli e a rota usarem  a msm regra .
function diagnosticarTalhoes(cenario) {
const talhoes = cenario.talhoes || [];

const limiaresPorMetrica = montarLimiaresPorMetrica(cenario.regras || []);
const leiturasPorTalhao = montarLeituraPorTalhao({
dispositivos: cenario.dispositivos || [],
sensores: cenario.sensores || [],
ultimasLeituras: cenario.ultimasLeituras || [],
});

// Talhoes que tem cultura plantada agora. Quem nao esta nesta lista nao e
// julgado: o teto de temperatura pertence a PLANTA, nao a terra. Encerrado o
// ciclo da manga, continuar medindo contra o teto dela seria julgar uma
// cultura que ja foi colhida -- e foi exatamente o que a tela fez antes
// desta regra existir (T4 marcava NORMAL a 35 °C contra o teto de 45 da
// manga, dias depois da colheita).
const talhoesComCicloAtivo = new Set(
(cenario.ciclos || [])
    .filter((ciclo) => !ciclo.status || ciclo.status === "ativo")
    .map((ciclo) => ciclo.talhao_id),
);

const resultados = talhoes.map((talhao) => {
const configTalhao = montarConfigTalhao(talhao, limiaresPorMetrica);

// Sem cultura nao ha limite, e sem limite nao ha o que concluir. O sensor
// continua gravando no banco (o historico entre ciclos tem valor), mas a
// tela para de exibir numero: melhor dizer "sem ciclo" do que exibir uma
// temperatura que ninguem esta usando para decidir nada.
if (!talhoesComCicloAtivo.has(talhao.id)) {
    return {
    talhao_id: talhao.id,
    talhao: talhao.codigo,
    nome: talhao.nome,
    limiares: configTalhao,
    status: "SEM_CICLO",
    mensagem: "Talhão sem cultura plantada. Cadastre o produto para retomar o monitoramento.",
    alerta: false,
    severidade: null,
    dados: {
        temperatura: null,
        umidade_solo: null,
        umidade_ar: null,
        coletado_em: null,
    },
    };
}

const leituraAtual = leituraNormalizada(leiturasPorTalhao.get(talhao.id));
const diagnostico = analisarRiscoDinamico(leituraAtual, configTalhao);

return {
    talhao_id: talhao.id,
    talhao: talhao.codigo,
    nome: talhao.nome,
    limiares: configTalhao,
    ...diagnostico,
};
});

return resultados;
}

//esse arquivo vai mostrar tudo de dados e oq nao estiver aqui resente e privado por questa de segunraça so sera enviado para o servidor e nao sera mostrado no cliente.

module.exports = {
METRICAS,
LIMIARES_PADRAO,
VALIDADE_LEITURA_MINUTOS,
numeroOuNulo,
montarLeituraPorTalhao,
leituraNormalizada,
montarLimiaresPorMetrica,
montarConfigTalhao,
analisarRiscoDinamico,
diagnosticarTalhoes,
};
