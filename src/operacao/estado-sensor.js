const LIMITE_DADOS_RECENTES_MS = 5 * 60 * 1000;

function dadosRecentes(em, agora = Date.now()) {
  if (!em) return false;
  const instante = Date.parse(em);
  if (!Number.isFinite(instante)) return false;
  const idade = agora - instante;
  return idade >= -60_000 && idade <= LIMITE_DADOS_RECENTES_MS;
}

function estadoSensor({ statusSensor, statusDispositivo, ultimaComunicacao, agora = Date.now() }) {
  if (statusSensor !== "ativo") return "Inativo";

  const estadoDispositivo = String(statusDispositivo || "").toLowerCase();
  if (!statusDispositivo || estadoDispositivo === "desativado") return "Desativado";
  if (estadoDispositivo === "manutencao") return "Manutencao";
  if (estadoDispositivo === "offline") return "Offline";
  if (!ultimaComunicacao) return "Sem comunicação";
  if (!dadosRecentes(ultimaComunicacao, agora)) return "Dados desatualizados";
  return "Online";
}

module.exports = { LIMITE_DADOS_RECENTES_MS, dadosRecentes, estadoSensor };
