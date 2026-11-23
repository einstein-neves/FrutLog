/* =========================================================================
   Testes da regra agronomica do Predador
   =========================================================================
   O nucleo nao tem `require` nenhum e nao fala com banco: entra um cenario,
   sai um diagnostico. Entao o teste roda em qualquer maquina, offline, em
   menos de um segundo.

     node testes/predador-nucleo.teste.js

   Cada caso aqui corresponde a uma decisao que ja custou discussao. Se um
   deles falhar, a regra mudou -- confira se foi de proposito antes de
   "consertar o teste".
   ========================================================================= */

const { diagnosticarTalhoes } = require("../src/ia/predador-nucleo.js");

const agora = () => new Date().toISOString();

/** Monta um cenario minimo com um talhao, um sensor e uma leitura. */
function cenario({ tetoTemp = 30, temperatura = null, umidadeSolo = null, ciclos = [{ talhao_id: "t1", status: "ativo" }], idade = 0 }) {
  const sensores = [];
  const leituras = [];
  const coletado = new Date(Date.now() - idade * 60000).toISOString();

  if (temperatura !== null) {
    sensores.push({ id: "s-temp", dispositivo_id: "d1", codigo_metrica: "temperatura", status: "ativo" });
    leituras.push({ sensor_id: "s-temp", valor: temperatura, coletado_em: coletado });
  }
  if (umidadeSolo !== null) {
    sensores.push({ id: "s-solo", dispositivo_id: "d1", codigo_metrica: "umidadeSolo", status: "ativo" });
    leituras.push({ sensor_id: "s-solo", valor: umidadeSolo, coletado_em: coletado });
  }

  return {
    talhoes: [{ id: "t1", codigo: "T4", nome: "Talhao 4", temperatura_maxima: tetoTemp }],
    dispositivos: [{ id: "d1", id_externo: "esp32", talhao_id: "t1", status: "online" }],
    sensores,
    ultimasLeituras: leituras,
    regras: [],
    ciclos,
  };
}

const casos = [
  // --- a regra agronomica -------------------------------------------------
  { nome: "dentro da faixa -> NORMAL", entrada: { temperatura: 20 }, status: "NORMAL", motivo: null, alerta: false },
  { nome: "acima do teto -> ATENCAO e toca a sirene", entrada: { temperatura: 35 }, status: "ATENCAO", motivo: "TEMPERATURA_ACIMA", alerta: true },
  { nome: "a 1 grau do teto -> ATENCAO sem sirene (aviso previo)", entrada: { temperatura: 29 }, status: "ATENCAO", motivo: "TEMPERATURA_PROXIMA", alerta: false },
  { nome: "solo seco sozinho -> ATENCAO", entrada: { temperatura: 20, umidadeSolo: 10 }, status: "ATENCAO", motivo: "SOLO_SECO", alerta: true },
  { nome: "calor + solo seco -> ALERTA_CRITICO", entrada: { temperatura: 35, umidadeSolo: 10 }, status: "ALERTA_CRITICO", motivo: "ESTRESSE_HIDRICO", alerta: true },

  // --- a ordem do else-if -------------------------------------------------
  // 35 com teto 30 satisfaz TAMBEM a condicao de "se aproximando" (>= 27).
  // Se a proximidade nao fosse o ultimo ramo, quem ja estourou o teto seria
  // diagnosticado como "chegando perto" -- e o alerta nunca dispararia.
  { nome: "quem estourou o teto NAO e diagnosticado como 'se aproximando'", entrada: { temperatura: 35 }, motivo: "TEMPERATURA_ACIMA" },

  // --- ausencia de dado ---------------------------------------------------
  { nome: "sem leitura nenhuma -> SEM_DADOS", entrada: {}, status: "SEM_DADOS", alerta: false },
  { nome: "leitura velha (3h) e descartada -> SEM_DADOS", entrada: { temperatura: 35, idade: 180 }, status: "SEM_DADOS", alerta: false },

  // --- o ciclo manda ------------------------------------------------------
  { nome: "sem ciclo ativo -> nao julga", entrada: { temperatura: 35, ciclos: [] }, status: "SEM_CICLO", alerta: false },
  { nome: "ciclo encerrado -> nao julga", entrada: { temperatura: 35, ciclos: [{ talhao_id: "t1", status: "encerrado" }] }, status: "SEM_CICLO", alerta: false },
  { nome: "sem ciclo nao mostra temperatura", entrada: { temperatura: 35, ciclos: [] }, temperaturaExibida: null },
];

let falhas = 0;
for (const caso of casos) {
  const [r] = diagnosticarTalhoes(cenario(caso.entrada));
  const erros = [];

  if (caso.status !== undefined && r.status !== caso.status) erros.push(`status: esperado ${caso.status}, veio ${r.status}`);
  if (caso.motivo !== undefined && r.motivo !== caso.motivo) erros.push(`motivo: esperado ${caso.motivo}, veio ${r.motivo}`);
  if (caso.alerta !== undefined && r.alerta !== caso.alerta) erros.push(`alerta: esperado ${caso.alerta}, veio ${r.alerta}`);
  if (caso.temperaturaExibida !== undefined && (r.dados.temperatura ?? null) !== caso.temperaturaExibida) {
    erros.push(`dados.temperatura: esperado ${caso.temperaturaExibida}, veio ${r.dados.temperatura}`);
  }

  if (erros.length) {
    falhas++;
    console.log(`FALHOU  ${caso.nome}`);
    erros.forEach((e) => console.log(`        ${e}`));
  } else {
    console.log(`PASSOU  ${caso.nome}`);
  }
}

console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
process.exitCode = falhas ? 1 : 0;
