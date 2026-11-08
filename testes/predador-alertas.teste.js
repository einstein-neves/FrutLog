/* =========================================================================
   Testes da camada de alertas do Predador
   =========================================================================
   Roda sem banco, sem rede e sem .env: planejarAlertas() e pura, entao o
   teste e so "entra isto, tem que sair aquilo".

     node testes/predador-alertas.teste.js

   Sai com codigo 1 se algo falhar, para poder entrar em CI um dia.
   ========================================================================= */

const { planejarAlertas } = require("../src/ia/predador-alertas.js");

const AGORA = "2026-11-02T03:00:00.000Z";

// Atalhos para os diagnosticos que o nucleo produz.
const critico = (talhao) => ({ talhao_id: talhao, status: "ALERTA_CRITICO", alerta: true, severidade: "critica", motivo: "ESTRESSE_HIDRICO", mensagem: "Estresse hídrico! Irrigação imediata!" });
const quente = (talhao, t = 35) => ({ talhao_id: talhao, status: "ATENCAO", alerta: true, severidade: "alta", motivo: "TEMPERATURA_ACIMA", mensagem: `Temperatura atual (${t}°C) ultrapassou o teto.` });
const proximo = (talhao) => ({ talhao_id: talhao, status: "ATENCAO", alerta: false, severidade: "media", motivo: "TEMPERATURA_PROXIMA", mensagem: "Se aproximando do teto." });
const normal = (talhao) => ({ talhao_id: talhao, status: "NORMAL", alerta: false, severidade: null, motivo: null, mensagem: "Dentro da faixa." });
const mudo = (talhao) => ({ talhao_id: talhao, status: "SEM_DADOS", alerta: false, severidade: null, motivo: null, mensagem: "Sem leitura recente." });
const colhido = (talhao) => ({ talhao_id: talhao, status: "SEM_CICLO", alerta: false, severidade: null, motivo: null, mensagem: "Sem cultura plantada." });

const abertoDeCalor = (talhao, id = "a1") => ({ id, talhao_id: talhao, titulo: "Temperatura acima do limite", status: "aberto" });
const abertoCritico = (talhao, id = "a2") => ({ id, talhao_id: talhao, titulo: "Estresse hídrico", status: "aberto" });

const casos = [
  {
    nome: "problema novo abre alerta",
    diagnosticos: [quente("T4")],
    alertasAbertos: [],
    espera: { abrir: 1, fechar: 0, manter: 0 },
    confere: (p) => p.abrir[0].severidade === "alta" && p.abrir[0].status === "aberto",
  },
  {
    nome: "MESMO problema na rodada seguinte NAO abre outro",
    diagnosticos: [quente("T4", 36)],
    alertasAbertos: [abertoDeCalor("T4")],
    espera: { abrir: 0, fechar: 0, manter: 1 },
    // A mensagem e atualizada: a temperatura de agora vale mais que a antiga.
    confere: (p) => p.manter[0].mensagem.includes("36"),
  },
  {
    nome: "aviso previo (amarelo) nao vira alerta registrado",
    diagnosticos: [proximo("T4")],
    alertasAbertos: [],
    espera: { abrir: 0, fechar: 0, manter: 0 },
  },
  {
    nome: "voltou ao normal -> fecha o alerta",
    diagnosticos: [normal("T4")],
    alertasAbertos: [abertoDeCalor("T4")],
    espera: { abrir: 0, fechar: 1, manter: 0 },
    confere: (p) => p.fechar[0].status === "resolvido" && p.fechar[0].fechado_em === AGORA,
  },
  {
    nome: "talhao colhido -> fecha o alerta",
    diagnosticos: [colhido("T4")],
    alertasAbertos: [abertoDeCalor("T4")],
    espera: { abrir: 0, fechar: 1, manter: 0 },
  },
  {
    // O caso que mais importa: sensor mudo NAO e prova de que o problema
    // passou. Pode ser o proprio calor que derrubou o aparelho.
    nome: "sensor emudeceu -> alerta CONTINUA aberto",
    diagnosticos: [mudo("T4")],
    alertasAbertos: [abertoDeCalor("T4")],
    espera: { abrir: 0, fechar: 0, manter: 0 },
  },
  {
    nome: "dois problemas no mesmo talhao sao dois alertas",
    diagnosticos: [critico("T4")],
    alertasAbertos: [abertoDeCalor("T4")],
    // O critico e novo; o de calor nao foi mais diagnosticado, entao fecha.
    espera: { abrir: 1, fechar: 1, manter: 0 },
    confere: (p) => p.abrir[0].titulo === "Estresse hídrico" && p.fechar[0].id === "a1",
  },
  {
    // T9 nao foi avaliado nesta rodada (talhao arquivado, por exemplo). O
    // Predador nao viu aquele talhao, entao nao tem o que afirmar sobre ele.
    nome: "alerta de talhao NAO avaliado fica como esta",
    diagnosticos: [normal("T4")],
    alertasAbertos: [abertoCritico("T9", "outro")],
    espera: { abrir: 0, fechar: 0, manter: 0 },
  },
  {
    // Caso real que apareceu no banco antes da primeira execucao: a RPC
    // registrar_ocorrencia_com_alerta abre alerta quando um tecnico relata
    // algo em campo. Se o Predador fechasse isso, a IA estaria resolvendo
    // sozinha um problema relatado por uma pessoa.
    nome: "alerta de OUTRO dono (ocorrencia de campo) nao e tocado",
    diagnosticos: [normal("T4")],
    alertasAbertos: [{ id: "humano", talhao_id: "T4", titulo: "Ocorrencia de campo: Falta de agua", status: "aberto" }],
    espera: { abrir: 0, fechar: 0, manter: 0 },
  },
  {
    nome: "alerta de outro dono nao impede o Predador de abrir o seu",
    diagnosticos: [quente("T4")],
    alertasAbertos: [{ id: "humano", talhao_id: "T4", titulo: "Ocorrencia de campo: Falta de agua", status: "aberto" }],
    espera: { abrir: 1, fechar: 0, manter: 0 },
    confere: (p) => p.abrir[0].titulo === "Temperatura acima do limite",
  },
  {
    nome: "entrada vazia nao quebra",
    diagnosticos: [],
    alertasAbertos: [],
    espera: { abrir: 0, fechar: 0, manter: 0 },
  },
];

let falhas = 0;
for (const caso of casos) {
  const plano = planejarAlertas({ diagnosticos: caso.diagnosticos, alertasAbertos: caso.alertasAbertos, agora: AGORA });
  const contagemOk =
    plano.abrir.length === caso.espera.abrir &&
    plano.fechar.length === caso.espera.fechar &&
    plano.manter.length === caso.espera.manter;
  const detalheOk = caso.confere ? caso.confere(plano) : true;

  if (contagemOk && detalheOk) {
    console.log(`PASSOU  ${caso.nome}`);
  } else {
    falhas++;
    console.log(`FALHOU  ${caso.nome}`);
    if (!contagemOk) {
      console.log(`        esperado abrir=${caso.espera.abrir} fechar=${caso.espera.fechar} manter=${caso.espera.manter}`);
      console.log(`        veio     abrir=${plano.abrir.length} fechar=${plano.fechar.length} manter=${plano.manter.length}`);
    }
    if (!detalheOk) console.log(`        o conteudo do plano nao bateu: ${JSON.stringify(plano)}`);
  }
}

console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
process.exitCode = falhas ? 1 : 0;
