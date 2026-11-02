//  o predador js vai funcioanr como servico do predador-nucleo , dentro do predador teremos  entradas e rotas  api / cli lidando com  conexoes mais segura com o supabase  tratamento de erros  de redes requeisiçoes paralelas
//objetivo do (predador.js  e predadornucleo.js)  virificar os dados em segundo plano e agir avisando com alertas antes da perda de produtos.  


require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const {
LIMIARES_PADRAO,
diagnosticarTalhoes,




analisarRiscoDinamico,
} = require("./predador-nucleo.js"); //rota para o nucleo.js

// FrutLog - Modulo de IA Preditiva e Alertas

// Le a telemetria real enviada pelos ESP32 e cruza, talhao por talhao, com os
// limiares cadastrados pelo Engenheiro Agronomo/Admin.

// Modelo de dados real (conferir em supabase/schema.sql):
//   talhao                   -> limiar do engenheiro na coluna `temperatura_maxima`
//   dispositivo              -> amarra o ESP32 (`id_externo`) ao `talhao_id`
//   sensor                   -> `codigo_metrica` diz QUAL grandeza o sensor mede
//   leitura_sensor           -> formato longo: uma linha por medicao, na coluna
//                               `valor`. Nao existem colunas `temperatura`,
//                               `umidade_solo` nem `umidade_ar` nessa tabela.
//   v_ultima_leitura_sensor  -> ultima leitura de cada sensor (distinct on)
//   regra_alerta             -> limiares por metrica (valor_minimo/valor_maximo)

// 1. Credenciais apenas por variavel de ambiente. Nunca embutir chave no codigo:
//    o arquivo vai para o Git e a chave de servico ignora o RLS do Supabase.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
console.error(
"Configuracao ausente: defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env antes de rodar a IA preditiva.",
);
process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
// Script de linha de comando: nao precisa manter sessao nem renovar token.
auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * @param {string} descricao - Nome da tabela/view consultada, para a mensagem de erro
 * @param {Function} construirQuery - Funcao que devolve a query do supabase-js
 */
async function consultar(descricao, construirQuery) {
const { data, error } = await construirQuery();
if (error) {
throw new Error(`Falha ao consultar ${descricao}: ${error.message}`);
}
return data || [];
}

/**
 * Busca em paralelo tudo que a analise precisa.
 * As consultas sao independentes entre si, por isso Promise.all: um `await`
 * atras do outro multiplicaria a latencia de rede por cinco.
 */
async function obterCenarioDeCampo() {
const [talhoes, dispositivos, sensores, ultimasLeituras, regras, ciclos] =
await Promise.all([
    consultar("talhao", () =>
    supabase
        .from("talhao")
        .select("id, codigo, nome, temperatura_maxima")
        .is("arquivado_em", null)
        .order("codigo"),
    ),

    consultar("dispositivo", () =>
    supabase
        .from("dispositivo")
        .select("id, id_externo, talhao_id, status"),
    ),

    consultar("sensor", () =>
    supabase
        .from("sensor")
        .select("id, dispositivo_id, codigo_metrica, unidade, status")
        .eq("status", "ativo"),
    ),

    // A view ja resolve "a ultima leitura de cada sensor" dentro do banco.
    // Consultar leitura_sensor direto varreria todas as particoes mensais.
    consultar("v_ultima_leitura_sensor", () =>
    supabase
        .from("v_ultima_leitura_sensor")
        .select("sensor_id, valor, unidade, qualidade, coletado_em"),
    ),

    // Limiares por metrica cadastrados pela organizacao (umidade, etc.).
    // Usa select('*') de proposito: a tabela divergiu entre o repositorio
    // (schema.sql -> valor_minimo/valor_maximo) e o banco publicado
    // (operador/limite). Enquanto a divergencia nao for reconciliada por
    // migracao, pedir coluna pelo nome derruba o script com 42703.
    consultar("regra_alerta", () =>
    supabase.from("regra_alerta").select("*").eq("habilitado", true),
    ),

    // Quais talhoes tem cultura plantada AGORA. O teto de temperatura
    // pertence a planta, nao a terra: encerrado o ciclo, o nucleo para de
    // julgar aquele talhao em vez de compara-lo com o limite da cultura
    // anterior, ja colhida.
    consultar("ciclo_cultura", () =>
    supabase
        .from("ciclo_cultura")
        .select("id, talhao_id, status")
        .eq("status", "ativo"),
    ),
]);

return { talhoes, dispositivos, sensores, ultimasLeituras, regras, ciclos };
}

async function executarIaPreditiva() {
console.log("Iniciando analise preditiva de dados Agronomicos ...");

// Uma unica ida ao banco, em paralelo. O erro sobe para quem chamou decidir
// o que fazer, em vez de ser engolido e virar `null` silencioso.
const cenario = await obterCenarioDeCampo();
console.log(
`Talhoes ativos: ${cenario.talhoes.length} | ` +
    `sensores ativos: ${cenario.sensores.length} | ` +
    `ultimas leituras recebidas: ${cenario.ultimasLeituras.length}`,
);

if (cenario.talhoes.length === 0) {
console.warn("Nenhum talhao ativo cadastrado. Nada a analisar.");
return [];
}
const resultados=diagnosticarTalhoes(cenario);



console.log("\n--- RESULTADO DA ANÁLISE PREDITIVA ---");
for (const resultado of resultados) {
const { temperatura, umidade_solo: umidadeSolo } = resultado.dados;
console.log(
    `[${resultado.talhao}] ${resultado.status}: ${resultado.mensagem}`,
);
console.log(
    `   Temp: ${temperatura ?? "--"}°C | Umidade solo: ${umidadeSolo ?? "--"}% | ` +
    `Limiares: ${resultado.limiares.temperaturaMaxima}°C / ${resultado.limiares.umidadeSoloMinima}%` +
    `${resultado.limiares.temperaturaMaximaCadastrada ? "" : " (temp. em fallback)"}`,
);
}
console.log("-------------------------------------\n");

const emAlerta = resultados.filter((resultado) => resultado.alerta);
console.log(`Talhoes em alerta: ${emAlerta.length} de ${resultados.length}`);

return resultados;
}

/**
 * Modo de teste do algoritmo, sem depender do banco: node predador.js --simular
 * Antes, a simulacao entrava automaticamente quando a tabela vinha vazia, o que
 * escondia falta de telemetria real atras de um diagnostico inventado.
 */
function simularAnalise() {
console.log(
"Banco nao consultado. Simulando leitura de teste para validar o modelo...",
);
const leituraSimulada = {
temperatura: 34.5,
umidadeSolo: 32.0, // Exemplo de estresse hídrico
umidadeAr: null,
coletadoEm: new Date().toISOString(),
suspeita: false,
};
const diagnostico = analisarRiscoDinamico(leituraSimulada, {
temperaturaMaxima: LIMIARES_PADRAO.temperaturaMaxima,
umidadeSoloMinima: LIMIARES_PADRAO.umidadeSoloMinima,
});

console.log("\n--- RESULTADO DA ANÁLISE PREDITIVA (SIMULADA) ---");
console.log(`Status: ${diagnostico.status}`);
console.log(`Mensagem: ${diagnostico.mensagem}`);
console.log(
`Dados analisados: Temp: ${diagnostico.dados.temperatura}°C | Umidade: ${diagnostico.dados.umidade_solo}%`,
);
console.log("-------------------------------------------------\n");

return diagnostico;
}

// Executa so quando chamado direto pelo terminal; como modulo, apenas exporta.
if (require.main === module) {
if (process.argv.includes("--simular")) {
simularAnalise();
} else {
executarIaPreditiva().catch((erro) => {
    console.error("⚠️ Falha na analise preditiva:", erro.message);
    // Codigo de saida != 0 para o agendador (cron / Task Scheduler) notar a falha.
    process.exitCode = 1;
});
}
}

module.exports = {
executarIaPreditiva,
obterCenarioDeCampo,

};
