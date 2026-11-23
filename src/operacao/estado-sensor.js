const LIMITE_DADOS_RECENTES_MS = 5 * 60 * 1000;

function dadosRecentes(em, agora = Date.now()) {
  if (!em) return false;
  const instante = Date.parse(em);
  if (!Number.isFinite(instante)) return false;
  const idade = agora - instante;
  return idade >= -60_000 && idade <= LIMITE_DADOS_RECENTES_MS;
}

function estadoSensor(opcoes) {
  const { statusSensor, statusDispositivo, ultimaComunicacao, agora = Date.now() } = opcoes;
  if (statusSensor !== "ativo") return "Inativo";

  const estadoDispositivo = String(statusDispositivo || "").toLowerCase();
  if (!statusDispositivo || estadoDispositivo === "desativado") return "Desativado";
  if (estadoDispositivo === "manutencao") return "Manutencao";
  if (estadoDispositivo === "offline") return "Offline";
  if (!ultimaComunicacao) return "Sem comunicação";
  if (!dadosRecentes(ultimaComunicacao, agora)) return "Dados desatualizados";
  if ("ultimaLeitura" in opcoes) {
    if (!opcoes.ultimaLeitura) return "Sem leitura";
    if (opcoes.valor === null || opcoes.valor === undefined || !Number.isFinite(Number(opcoes.valor)) || ["invalida","erro"].includes(opcoes.qualidade)) return "Falha de medicao";
    if (!dadosRecentes(opcoes.ultimaLeitura, agora)) return "Leitura desatualizada";
  }
  return "Online";
}

module.exports = { LIMITE_DADOS_RECENTES_MS, dadosRecentes, estadoSensor };
