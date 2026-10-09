/* =========================================================
   FRUTLOG - CARREGAMENTO E RENDERIZACAO COMPARTILHADOS DO MAPA
   ========================================================= */

const FrutLogMapaTalhoes = (() => {
  const PERFIS = {
    admin: ["admin", "administrador"],
    engenheiro: ["engenheiro"],
    tecnico: ["tecnico"],
  };

  function normalizarStatus(status) {
    const normalizado = String(status || "normal")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");

    return [
      "normal",
      "atencao",
      "critico",
      "sem-leitura",
      "sem-sensor",
      "sem-comunicacao",
      "sensor-inativo",
      "manutencao",
    ].includes(normalizado)
      ? normalizado
      : "sem-leitura";
  }

  async function carregarMapaTalhoes(perfil) {
    const sessao = FrutLog.obterSessao();
    const perfisPermitidos = PERFIS[perfil];
    if (!sessao || !perfisPermitidos?.includes(sessao.perfil)) {
      throw new Error(`Sessao invalida para carregar o mapa do perfil ${perfil}.`);
    }

    const resposta = await FrutLog.apiFetch("/talhoes");
    if (!Array.isArray(resposta?.talhoes)) {
      throw new Error("A API retornou uma lista de talhoes invalida.");
    }
    return FrutLogTalhoes.carregarDoServidor(resposta.talhoes);
  }

  function renderizarMapaTalhoes(svg, features, opcoes = {}) {
    if (!svg) return 0;

    svg.replaceChildren();
    let renderizados = 0;

    for (const feature of features || []) {
      const pontos = FrutLogTalhoes.obterPontos(feature);
      if (pontos.length < 3) continue;

      const codigo = feature.properties.codigo;
      const poligono = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poligono.setAttribute("points", pontos.map((ponto) => ponto.join(",")).join(" "));
      poligono.dataset.talhao = codigo;
      poligono.classList.add(
        "talhao-mapa",
        `status-${normalizarStatus(opcoes.statusFor?.(feature) ?? feature.properties.status)}`
      );
      poligono.classList.toggle("selecionado", codigo === opcoes.selectedCode);
      poligono.setAttribute("tabindex", "0");
      poligono.setAttribute("role", "button");
      poligono.setAttribute("aria-label", `Talhao ${codigo}`);

      const selecionar = (evento) => opcoes.onSelect?.(feature, evento, poligono);
      poligono.addEventListener("click", selecionar);
      poligono.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        evento.preventDefault();
        selecionar(evento);
      });
      svg.appendChild(poligono);
      opcoes.onPolygon?.(poligono, feature);
      renderizados += 1;
    }

    return renderizados;
  }

  return { carregarMapaTalhoes, renderizarMapaTalhoes };
})();
