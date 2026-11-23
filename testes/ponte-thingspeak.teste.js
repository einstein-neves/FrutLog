/* =========================================================================
   Testes da traducao da ponte IoT
   =========================================================================
   traduzir() e aparelhoFalhou() sao puras: entra uma linha do ThingSpeak,
   sai o que seria enviado. Nada de rede, banco ou .env.

     node testes/ponte-thingspeak.teste.js

   O caso que da nome a este arquivo e o do DHT quebrado. Vale repetir por
   que ele importa: um sensor com defeito publica 0 °C, e 0 °C passa em
   qualquer validacao de "e um numero?". Sem o filtro, o talhao apareceria
   como NORMAL com leitura fresca -- o defeito escondido atras de um dado
   que parece bom. Com o filtro, cai em SEM_DADOS, que e a verdade.
   ========================================================================= */

const { traduzir, aparelhoFalhou, cursorFinal } = require("../src/iot/ponte-thingspeak.js");

// Mapa como buscarCatalogo()/montarMapa() produzem a partir do cadastro.
const MAPA = [
  { campo: "field1", tipo: "temperatura", unidade: "°C", dispositivo: "ESP-A1", talhao: "A1" },
  { campo: "field2", tipo: "umidadeAr", unidade: "%", dispositivo: "AR-A1", talhao: "A1" },
];

const leitura = (f1, f2) => ({ entry_id: 1, created_at: "2026-11-02T10:00:00Z", field1: f1, field2: f2 });

const casos = [
  {
    nome: "leitura boa gera as duas medicoes",
    entrada: leitura("33.6", "59.3"),
    medicoes: 2,
    confere: (m) => m[0].valor === 33.6 && m[1].valor === 59.3 && m[0].talhao === "A1",
  },
  {
    // A assinatura real do canal: 1217 leituras boas trazem as duas, 6 falhas
    // nao trazem nenhuma, e nunca houve uma sem a outra.
    nome: "DHT falhou (0 e vazio) -> descarta a leitura INTEIRA",
    entrada: leitura("0", null),
    medicoes: 0,
    confere: () => aparelhoFalhou(leitura("0", null)).falhou === true,
  },
  {
    nome: "leitura parcial (temp ok, umidade vazia) -> descarta tudo",
    entrada: leitura("33.6", null),
    medicoes: 0,
  },
  {
    nome: "leitura parcial ao contrario (umidade ok, temp vazia) -> descarta tudo",
    entrada: leitura(null, "59.3"),
    medicoes: 0,
  },
  {
    nome: "campos vazios dos dois lados -> descarta",
    entrada: leitura("", ""),
    medicoes: 0,
  },
  {
    // ESCOLHA DELIBERADA, e ela tem preco.
    //
    // O DHT11 mede de 0 a 50 °C: zero e o PISO da faixa dele, ou seja, e o
    // valor que ele devolve quando nao consegue medir. Num pomar em
    // Pernambuco, 0 °C e defeito, nao friagem. Entao zero no campo de
    // temperatura conta como ausencia -- e como e o mesmo chip que mede as
    // duas grandezas, a umidade que veio junto tambem nao merece confianca.
    //
    // O preco: uma temperatura real de 0 °C seria descartada. Aceitavel aqui,
    // porque nessa lavoura 0 °C significa que a cultura ja se perdeu, e
    // SEM_DADOS e mais honesto que um "NORMAL" vindo de sensor quebrado.
    //
    // Em outro clima essa troca se inverte. Se o FrutLog for usado no Sul,
    // esta regra precisa de revisao -- e por isso ela esta escrita aqui, e
    // nao escondida dentro de um `if`.
    nome: "0 °C mesmo com umidade valida e descartado (piso do DHT11)",
    entrada: leitura("0", "59.3"),
    medicoes: 0,
    confere: () => aparelhoFalhou(leitura("0", "59.3")).falhou === true,
  },
  {
    nome: "virgula decimal e aceita",
    entrada: leitura("33,6", "59,3"),
    medicoes: 2,
    confere: (m) => m[0].valor === 33.6,
  },
  {
    nome: "texto no lugar do numero nao vira medicao",
    entrada: leitura("quente", "59.3"),
    medicoes: 1,
    confere: (m) => m[0].tipo === "umidadeAr",
  },
  {
    nome: "horario enviado e o do ThingSpeak, nao o de agora",
    entrada: leitura("33.6", "59.3"),
    medicoes: 2,
    confere: (m) => m[0].timestamp === "2026-11-02T10:00:00Z",
  },
  {
    nome: "mapa vazio (nenhum sensor cadastrado) nao gera medicao",
    entrada: leitura("33.6", "59.3"),
    mapa: [],
    medicoes: 0,
  },
];

// -------------------------------------------------------------------------
// Ate onde o cursor pode avancar
// -------------------------------------------------------------------------
// O cursor guarda ate onde a ponte ja importou. Se ele passar por cima de uma
// leitura recusada, aquela leitura nunca mais e pedida -- some em silencio,
// sem erro, sem log, sem ninguem notar. Dai o cuidado com estes casos.
const casosCursor = [
  { nome: "tudo aceito -> cursor vai ate a ultima", r: [{ entry_id: 10, ok: true }, { entry_id: 11, ok: true }], inicial: 9, espera: 11 },
  {
    // O BUG. Antes o cursor terminava em 12, pulando a 10 para sempre.
    nome: "recusada no MEIO -> cursor para ANTES dela",
    r: [{ entry_id: 10, ok: false }, { entry_id: 11, ok: true }, { entry_id: 12, ok: true }],
    inicial: 9,
    espera: 9,
  },
  { nome: "recusada no fim -> cursor para antes dela", r: [{ entry_id: 10, ok: true }, { entry_id: 11, ok: false }], inicial: 9, espera: 10 },
  { nome: "primeira recusada -> cursor nao sai do lugar", r: [{ entry_id: 10, ok: false }], inicial: 9, espera: 9 },
  { nome: "lote vazio -> cursor nao muda", r: [], inicial: 42, espera: 42 },
  {
    // Descarte por aparelho conta como resolvido: insistir traria o mesmo
    // lixo, e travar aqui pararia a importacao na primeira falha do DHT.
    nome: "descarte no meio nao trava o cursor",
    r: [{ entry_id: 10, ok: true }, { entry_id: 11, ok: true }, { entry_id: 12, ok: true }],
    inicial: 9,
    espera: 12,
  },
];

let falhasCursor = 0;
for (const caso of casosCursor) {
  const veio = cursorFinal(caso.r, caso.inicial);
  if (veio === caso.espera) {
    console.log(`PASSOU  ${caso.nome}`);
  } else {
    falhasCursor++;
    console.log(`FALHOU  ${caso.nome}`);
    console.log(`        esperava cursor ${caso.espera}, veio ${veio}`);
  }
}

let falhas = falhasCursor;
for (const caso of casos) {
  const m = traduzir(caso.entrada, caso.mapa || MAPA);
  const contagemOk = m.length === caso.medicoes;
  const detalheOk = caso.confere ? caso.confere(m) : true;

  if (contagemOk && detalheOk) {
    console.log(`PASSOU  ${caso.nome}`);
  } else {
    falhas++;
    console.log(`FALHOU  ${caso.nome}`);
    if (!contagemOk) console.log(`        esperava ${caso.medicoes} medicao(oes), veio ${m.length}`);
    if (!detalheOk) console.log(`        conteudo nao bateu: ${JSON.stringify(m)}`);
  }
}

const total = casos.length + casosCursor.length;
console.log(`\n${total - falhas}/${total} passaram`);
process.exitCode = falhas ? 1 : 0;
