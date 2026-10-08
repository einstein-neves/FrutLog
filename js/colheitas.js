document.addEventListener("DOMContentLoaded", async () => {
  const formularios = [...document.querySelectorAll("[data-form-colheita]")];
  if (!formularios.length) return;

  const exibirMensagem = (formulario, texto, tipo = "") => {
    const mensagem = formulario.querySelector("[data-mensagem-colheita]");
    if (mensagem) {
      mensagem.textContent = texto;
      mensagem.className = `mensagem-feedback ${tipo}`.trim();
    }
  };

  const optionsTalhoes = async () => {
    const resposta = await FrutLog.apiFetch("/talhoes");
    return (resposta.talhoes || []).map((talhao) => {
      const codigo = String(talhao.codigo);
      const seguro = codigo.replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[caractere]);
      return `<option value="${seguro}">${seguro}</option>`;
    }).join("");
  };

  let opcoes;
  try {
    opcoes = await optionsTalhoes();
  } catch (erro) {
    formularios.forEach((formulario) => {
      formulario.elements.talhao.innerHTML = '<option value="">Falha ao carregar talhoes</option>';
      exibirMensagem(formulario, erro.message, "erro");
    });
    return;
  }

  for (const formulario of formularios) {
    const selectTalhao = formulario.elements.talhao;
    selectTalhao.innerHTML = '<option value="">Selecione o talhao</option>' + opcoes;

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const botao = formulario.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        const dados = Object.fromEntries(new FormData(formulario));
        const resposta = await FrutLog.apiFetch("/colheitas", {
          method: "POST",
          body: JSON.stringify(dados),
        });
        exibirMensagem(
          formulario,
          `Colheita registrada: ${resposta.colheita.quantidade} ${resposta.colheita.unidade} em ${resposta.colheita.ano}.`,
          "sucesso"
        );
        formulario.reset();
        window.dispatchEvent(new CustomEvent("frutlog:colheitas-atualizadas"));
      } catch (erro) {
        exibirMensagem(formulario, erro.message, "erro");
      } finally {
        botao.disabled = false;
      }
    });
  }
});
