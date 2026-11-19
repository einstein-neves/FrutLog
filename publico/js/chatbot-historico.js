(function (root) {
  function criarHistorico(storage, usuario) {
    const chave = `frutlog_chatbot_v1:${encodeURIComponent(usuario)}`;
    let conversas = [];
    try {
      const dados = JSON.parse(storage.getItem(chave) || "[]");
      if (Array.isArray(dados)) conversas = dados.filter((c) =>
        c && typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(c.id) &&
        typeof c.titulo === "string" && Number.isFinite(c.atualizadoEm) && Array.isArray(c.mensagens)
      ).slice(0, 30).map((c) => ({ ...c, mensagens: c.mensagens.filter((m) =>
        m && ["pergunta", "resposta"].includes(m.tipo) && typeof m.texto === "string"
      ).slice(-100) }));
    } catch { /* Armazenamento indisponivel ou historico invalido. */ }
    function salvar() {
      try { storage.setItem(chave, JSON.stringify(conversas)); return true; }
      catch { return false; }
    }
    return {
      listar: () => conversas.map((c) => ({ ...c, mensagens: c.mensagens.slice() })),
      registrar(id, texto, tipo, links = []) {
        let conversa = conversas.find((c) => c.id === id);
        if (!conversa) {
          conversa = { id, titulo: texto.slice(0, 70), atualizadoEm: Date.now(), mensagens: [] };
          conversas.unshift(conversa);
        }
        conversa.mensagens.push({ texto: texto.slice(0, 20000), tipo, links });
        conversa.mensagens = conversa.mensagens.slice(-100);
        conversa.atualizadoEm = Date.now();
        conversas = [conversa, ...conversas.filter((c) => c.id !== id)].slice(0, 30);
        return salvar();
      },
      excluir(id) { conversas = conversas.filter((c) => c.id !== id); return salvar(); },
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { criarHistorico };
  else root.FrutLogHistorico = { criarHistorico };
})(globalThis);
