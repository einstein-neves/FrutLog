const fs = require("fs");
const path = require("path");
const { normalize } = require("./query");
const ignored = new Set([
  "como",
  "onde",
  "para",
  "qual",
  "quais",
  "uma",
  "sobre",
  "dos",
  "das",
  "que",
  "esta",
  "esse",
]);
const aliases = {
  offline: "sensor comunicacao sinal",
  desconectado: "sensor comunicacao sinal",
  irrigacao: "umidade solo",
  funcionarios: "usuario perfil equipe",
  safra: "plantio colheita",
  cadastrar: "cadastro",
};
function relevantKnowledge(question) {
  const content = fs.readFileSync(
    path.join(__dirname, "../../documentacao/assistente-frutlog.md"),
    "utf8",
  );
  const normalized = normalize(question);
  const expanded =
    normalized +
    " " +
    Object.entries(aliases)
      .filter(([term]) => normalized.includes(term))
      .map(([, words]) => words)
      .join(" ");
  const terms = [
    ...new Set(
      expanded
        .split(/[^a-z0-9]+/)
        .filter((s) => s.length >= 3 && !ignored.has(s)),
    ),
  ];
  return content
    .split(/\n(?=## )/)
    .map((section, index) => ({
      section,
      index,
      score: terms.reduce(
        (score, term) => score + (normalize(section).includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter((s) => s.score > 0 || s.index === 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map((s) => s.section)
    .join("\n\n")
    .slice(0, 7000);
}
module.exports = { relevantKnowledge };
