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
  const novaConversa = document.getElementById("nova-conversa-chatbot");
  const criarConversa = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let conversationId = criarConversa();
  let enviando = false;
  const sessao = FrutLog.obterSessao();
  if (!sessao?.id) return;
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() {}, setItem() { throw new Error(); } }; }
  const historico = FrutLogHistorico.criarHistorico(storage, `${sessao.id}:${sessao.perfil}`);
  const abrirHistorico = document.getElementById("abrir-historico-chatbot");
  const painelHistorico = document.getElementById("historico-chatbot");
  const listaHistorico = document.getElementById("lista-historico-chatbot");
  const avisoHistorico = document.getElementById("aviso-historico-chatbot");
  const tituloAtual = document.getElementById("conversa-atual-chatbot");
  const busca = document.getElementById("buscar-conversa-chatbot");
  const voltarConversa = document.getElementById("voltar-conversa-chatbot");

  function alternarHistorico(aberto) {
    painelHistorico.hidden = !aberto;
    abrirHistorico.setAttribute("aria-expanded", String(aberto));
    mensagens.hidden = aberto;
    formulario.hidden = aberto;
    tituloAtual.hidden = aberto;
    painel.querySelector(".rodape-chatbot").hidden = aberto;
    if (aberto) renderizarHistorico();
    if (aberto) busca.focus();
  }
  function registrar(texto, tipo, links = []) {
    if (!historico.registrar(conversationId, texto, tipo, links)) {
      avisoHistorico.hidden = false;
      avisoHistorico.textContent = "Não foi possível salvar o histórico neste navegador. A conversa continua disponível enquanto esta página estiver aberta.";
    }
    tituloAtual.textContent = historico.listar().find((c) => c.id === conversationId)?.titulo || "Nova conversa";
  }
  function renderizarHistorico() {
    listaHistorico.replaceChildren();
    const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
    const conversas = historico.listar().filter((c) => c.titulo.toLocaleLowerCase("pt-BR").includes(termo));
    if (!conversas.length) {
      const vazio = document.createElement("p");
      vazio.textContent = termo ? "Nenhuma conversa encontrada. Tente outro assunto." : "Você ainda não tem conversas salvas. Clique em Nova conversa e envie sua primeira pergunta.";
      listaHistorico.append(vazio);
    }
    for (const conversa of conversas) {
      const linha = document.createElement("div");
      linha.className = "item-historico-chatbot";
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.className = "abrir-conversa-chatbot";
      abrir.setAttribute("aria-current", String(conversa.id === conversationId));
      const titulo = document.createElement("strong");
      titulo.textContent = conversa.titulo;
      const data = document.createElement("small");
      const quando = new Date(conversa.atualizadoEm);
      const hoje = quando.toDateString() === new Date().toDateString();
      data.textContent = `${conversa.id === conversationId ? "Conversa atual · " : ""}${hoje ? "Hoje" : quando.toLocaleDateString("pt-BR")} às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      abrir.append(titulo, data);
      const previa = document.createElement("span");
      previa.className = "previa-conversa-chatbot";
      previa.textContent = conversa.mensagens.at(-1)?.texto.slice(0, 100) || "";
      abrir.append(previa);
      abrir.disabled = enviando;
      abrir.addEventListener("click", () => {
        if (enviando) return;
        conversationId = conversa.id;
        tituloAtual.textContent = conversa.titulo;
        mensagens.replaceChildren();
        for (const m of conversa.mensagens) adicionarMensagem(m.texto, m.tipo, Array.isArray(m.links) ? m.links : []);
        campoPergunta.value = "";
        alternarHistorico(false);
        campoPergunta.focus();
      });
      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "excluir-conversa-chatbot";
      excluir.textContent = "Excluir";
      excluir.setAttribute("aria-label", `Excluir conversa: ${conversa.titulo}`);
      excluir.disabled = enviando;
      excluir.addEventListener("click", () => {
        if (enviando || !window.confirm("Excluir esta conversa do histórico?")) return;
        if (!historico.excluir(conversa.id)) {
          avisoHistorico.hidden = false;
          avisoHistorico.textContent = "Não foi possível excluir a conversa do armazenamento do navegador.";
        }
        if (conversationId === conversa.id) novaConversa.click();
        renderizarHistorico();
      });
      linha.append(abrir, excluir);
      listaHistorico.append(linha);
    }
  }
  abrirHistorico?.addEventListener("click", () => alternarHistorico(painelHistorico.hidden));
  busca.addEventListener("input", renderizarHistorico);
  voltarConversa.addEventListener("click", () => { alternarHistorico(false); campoPergunta.focus(); });

  novaConversa?.addEventListener("click", () => {
    if (enviando) return;
    conversationId = criarConversa();
    tituloAtual.textContent = "Nova conversa";
    busca.value = "";
    mensagens.replaceChildren();
    adicionarMensagem(
      "Nova conversa iniciada. Sobre qual talhão, sensor ou assunto você quer perguntar?",
    );
    campoPergunta.focus();
    campoPergunta.value = "";
    alternarHistorico(false);
  });

  function adicionarTextoFormatado(destino, texto) {
    const linhas = String(texto || "").split("\n");
    linhas.forEach((linha, indice) => {
      if (indice) destino.appendChild(document.createElement("br"));
      const partes = linha.split(/(\*\*[^*]+\*\*)/g);
      partes.forEach((parte) => {
        if (parte.startsWith("**") && parte.endsWith("**")) {
          const destaque = document.createElement("strong");
          destaque.textContent = parte.slice(2, -2);
          destino.appendChild(destaque);
        } else {
          destino.appendChild(document.createTextNode(parte));
        }
      });
    });
  }

  function rolarParaFim() {
    mensagens.scrollTop = mensagens.scrollHeight;
  }

  function adicionarMensagem(texto, tipo = "resposta", links = []) {
    const mensagem = document.createElement("article");
    mensagem.className = `mensagem-chatbot ${tipo}`;
    const autor = document.createElement("span");
    autor.className = "autor-mensagem";
    autor.textContent = tipo === "pergunta" ? "Você" : "FrutLog";
    const conteudo = document.createElement("div");
    conteudo.className = "conteudo-mensagem";
    adicionarTextoFormatado(conteudo, texto);
    mensagem.append(autor, conteudo);
    for (const item of links) {
      if (
        typeof item?.href !== "string" ||
        !/^(admin|eng|tec)\.html#[a-z0-9-]+$/.test(item.href)
      )
        continue;
      const url = new URL(item.href, window.location.href);
      const paginas = {
        admin: "admin.html",
        engenheiro: "eng.html",
        tecnico: "tec.html",
      };
      if (
        url.pathname.split("/").pop() !== paginas[FrutLog.obterSessao()?.perfil]
      )
        continue;
      const link = document.createElement("a");
      link.href = item.href;
      link.className = "link-tutorial-chatbot";
      link.textContent = item.label || "Abrir seção";
      link.addEventListener("click", (evento) => {
        if (url.pathname !== window.location.pathname) return;
        const menu = [...document.querySelectorAll(".menu a[href]")].find(
          (a) => a.hash === url.hash,
        );
        if (!menu) return;
        evento.preventDefault();
        menu.click();
        alternar(false);
        document
          .getElementById(url.hash.slice(1))
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      mensagem.append(link);
    }
    mensagens.appendChild(mensagem);
    rolarParaFim();
  }

  function indicadorDigitando() {
    const indicador = document.createElement("div");
    indicador.className = "chatbot-digitando";
    indicador.setAttribute("aria-label", "Assistente analisando dados");
    indicador.innerHTML = "<span></span><span></span><span></span>";
    mensagens.appendChild(indicador);
    rolarParaFim();
    return indicador;
  }

  function alternar(aberto) {
    painel.hidden = !aberto;
    botao.setAttribute("aria-expanded", String(aberto));
    botao.classList.toggle("chatbot-aberto", aberto);
    if (aberto) campoPergunta.focus();
  }

  botao.addEventListener("click", () => alternar(painel.hidden));
  botaoFechar?.addEventListener("click", () => alternar(false));
  document.querySelectorAll(".sugestao-chatbot").forEach((sugestao) => {
    sugestao.addEventListener("click", () => {
      campoPergunta.value = sugestao.textContent;
      formulario.requestSubmit();
    });
  });

  campoPergunta.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      formulario.requestSubmit();
    }
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const pergunta = campoPergunta.value.trim();
    if (!pergunta || enviando) return;
    enviando = true;
    alternarHistorico(false);
    abrirHistorico.disabled = true;
    if (novaConversa) novaConversa.disabled = true;

    adicionarMensagem(pergunta, "pergunta");
    registrar(pergunta, "pergunta");
    campoPergunta.value = "";
    campoPergunta.disabled = true;
    const enviar = formulario.querySelector('[type="submit"]');
    if (enviar) enviar.disabled = true;
    const digitando = indicadorDigitando();
    try {
      const resultado = await FrutLog.apiFetch("/chatbot/perguntar", {
        method: "POST",
        body: JSON.stringify({ pergunta, conversationId }),
      });
      adicionarMensagem(resultado.resposta, "resposta", resultado.links || []);
      registrar(resultado.resposta, "resposta", resultado.links || []);
    } catch (erro) {
      adicionarMensagem(`Não foi possível responder agora: ${erro.message}`);
    } finally {
      enviando = false;
      abrirHistorico.disabled = false;
      if (novaConversa) novaConversa.disabled = false;
      digitando.remove();
      campoPergunta.disabled = false;
      if (enviar) enviar.disabled = false;
      campoPergunta.focus();
    }
  });
});
