/* =========================================================
   FRUTLOG - ASSISTENTE COM CONTEXTO OPERACIONAL
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const botao = document.getElementById("chatbot");
  const painel = document.getElementById("painel-chatbot");
  const botaoFechar = document.getElementById("fechar-chatbot");
  const formulario = document.getElementById("form-chatbot");
  const campoPergunta = document.getElementById("pergunta-chatbot");
  const mensagens = document.getElementById("mensagens-chatbot");
  if (!botao || !painel || !formulario || !campoPergunta || !mensagens) return;

  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function adicionarMensagem(texto, tipo = "") {
    const mensagem = document.createElement("p");
    mensagem.className = `mensagem-chatbot ${tipo}`.trim();
    mensagem.textContent = texto;
    mensagens.appendChild(mensagem);
    mensagens.scrollTop = mensagens.scrollHeight;
  }

  function responder(pergunta, contexto) {
    if (!Array.isArray(contexto?.sensores) || !Array.isArray(contexto?.ocorrencias)) {
      throw new Error("A API retornou um contexto operacional invalido.");
    }
    const texto = normalizar(pergunta);
    if (/\bsensor(es)?\b|\bleitura(s)?\b|\btelemetria\b/.test(texto)) {
      if (!contexto.sensores.length) return "Nenhum sensor foi encontrado no cadastro operacional.";
      return `Status dos sensores:\n${contexto.sensores.slice(0, 8).map((sensor) =>
        `${sensor.sensor} (${sensor.talhao || "sem talhao"}, ${sensor.metrica}): ${sensor.status}; leitura ${sensor.leitura}.`
      ).join("\n")}`;
    }

    if (/\bocorrencia(s)?\b|\bproblema(s)?\b|\bevento(s)?\b/.test(texto)) {
      if (!contexto.ocorrencias.length) return "Nao ha ocorrencias recentes registradas.";
      return `Ocorrencias recentes:\n${contexto.ocorrencias.slice(0, 8).map((item) =>
        `${item.data ? new Date(item.data).toLocaleString("pt-BR") : "Data indisponivel"} - Talhao ${item.talhao || "--"}: ${item.tipo}${item.observacao ? ` (${item.observacao})` : ""}.`
      ).join("\n")}`;
    }

    return `Consultei os dados atuais da fazenda (${new Date(contexto.consultado_em).toLocaleString("pt-BR")}): ${contexto.ocorrencias.length} ocorrencia(s) recente(s) e ${contexto.sensores.length} sensor(es) cadastrado(s). Pergunte por "ocorrencias" ou "status dos sensores" para ver detalhes.`;
  }

  function alternar(aberto) {
    painel.hidden = !aberto;
    botao.setAttribute("aria-expanded", String(aberto));
    if (aberto) campoPergunta.focus();
  }

  botao.addEventListener("click", () => alternar(painel.hidden));
  botaoFechar?.addEventListener("click", () => alternar(false));

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const pergunta = campoPergunta.value.trim();
    if (!pergunta) return;

    adicionarMensagem(pergunta, "pergunta");
    campoPergunta.value = "";
    campoPergunta.disabled = true;
    const enviar = formulario.querySelector('[type="submit"]');
    if (enviar) enviar.disabled = true;
    try {
      const contexto = await FrutLog.apiFetch("/chatbot/contexto");
      adicionarMensagem(responder(pergunta, contexto));
    } catch (erro) {
      adicionarMensagem(`Nao foi possivel consultar o contexto da fazenda: ${erro.message}`);
    } finally {
      campoPergunta.disabled = false;
      if (enviar) enviar.disabled = false;
      campoPergunta.focus();
    }
  });
});
