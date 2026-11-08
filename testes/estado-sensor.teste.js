const assert = require("node:assert/strict");
const { LIMITE_DADOS_RECENTES_MS, dadosRecentes, estadoSensor } = require("../src/operacao/estado-sensor");

const agora = Date.parse("2026-11-02T18:00:00.000Z");
const timestamp = (idade) => new Date(agora - idade).toISOString();
const verificar = (nome, callback) => {
  callback();
  console.log(`PASSOU  ${nome}`);
};

verificar("limite de cinco minutos ainda é dado recente", () => {
  assert.equal(LIMITE_DADOS_RECENTES_MS, 5 * 60 * 1000);
  assert.equal(dadosRecentes(timestamp(LIMITE_DADOS_RECENTES_MS), agora), true);
});

verificar("leitura mais antiga que cinco minutos fica desatualizada", () => {
  assert.equal(dadosRecentes(timestamp(LIMITE_DADOS_RECENTES_MS + 1), agora), false);
});

verificar("leitura ausente ou inválida nunca é recente", () => {
  assert.equal(dadosRecentes(null, agora), false);
  assert.equal(dadosRecentes("data inválida", agora), false);
});

verificar("pequena diferença futura de relógio é tolerada", () => {
  assert.equal(dadosRecentes(timestamp(-30_000), agora), true);
  assert.equal(dadosRecentes(timestamp(-60_001), agora), false);
});

verificar("dispositivo com sinal recente fica online", () => {
  assert.equal(estadoSensor({
    statusSensor: "ativo",
    statusDispositivo: "online",
    ultimaComunicacao: timestamp(60_000),
    agora
  }), "Online");
});

verificar("última comunicação antiga não fica como online", () => {
  assert.equal(estadoSensor({
    statusSensor: "ativo",
    statusDispositivo: "online",
    ultimaComunicacao: timestamp(LIMITE_DADOS_RECENTES_MS + 1),
    agora
  }), "Dados desatualizados");
});

verificar("sem sinal, manutenção e dispositivo offline são estados explícitos", () => {
  const comum = { statusSensor: "ativo", ultimaComunicacao: timestamp(0), agora };
  assert.equal(estadoSensor({ ...comum, statusDispositivo: "online", ultimaComunicacao: null }), "Sem comunicação");
  assert.equal(estadoSensor({ ...comum, statusDispositivo: "manutencao" }), "Manutencao");
  assert.equal(estadoSensor({ ...comum, statusDispositivo: "offline" }), "Offline");
});

verificar("sensor inativo não aparece online mesmo com sinal recente", () => {
  assert.equal(estadoSensor({
    statusSensor: "inativo",
    statusDispositivo: "online",
    ultimaComunicacao: timestamp(0),
    agora
  }), "Inativo");
});
