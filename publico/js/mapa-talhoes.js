/* =========================================================
   FRUTLOG - CARREGAMENTO E RENDERIZACAO COMPARTILHADOS DO MAPA
   ========================================================= */

const FrutLogMapaTalhoes = (() => {
  const PERFIS = {
    admin: ["admin", "administrador"],
    engenheiro: ["engenheiro"],
    tecnico: ["tecnico"],
  };

  // Codigos de talhoes arquivados: saem do mapa, mas continuam ocupados no banco.
  // Guardamos aqui para o editor nunca reaproveitar um deles ao criar ou dividir.
  let codigosArquivados = new Set();

  function registrarCodigosArquivados(codigos) {
    codigosArquivados = new Set(
      (Array.isArray(codigos) ? codigos : [])
        .map((codigo) => String(codigo || "").trim())
        .filter(Boolean)
    );
    return codigosArquivados;
  }

  function adicionarCodigosArquivados(codigos) {
    (Array.isArray(codigos) ? codigos : [])
      .map((codigo) => String(codigo || "").trim())
      .filter(Boolean)
      .forEach((codigo) => codigosArquivados.add(codigo));
    return codigosArquivados;
  }

  function codigoArquivado(codigo) {
    return codigosArquivados.has(String(codigo || "").trim());
  }

  function listarCodigosArquivados() {
    return [...codigosArquivados];
  }

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
      throw new Error(`Sessão inválida para carregar o mapa do perfil ${perfil}.`);
    }

    const resposta = await FrutLog.apiFetch("/talhoes");
    if (!Array.isArray(resposta?.talhoes)) {
      throw new Error("A API retornou uma lista de talhões inválida.");
    }
    registrarCodigosArquivados(resposta.codigos_arquivados);
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
      poligono.setAttribute("aria-label", `Talhão ${codigo}`);

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

  return {
    carregarMapaTalhoes,
    renderizarMapaTalhoes,
    registrarCodigosArquivados,
    adicionarCodigosArquivados,
    listarCodigosArquivados,
    codigoArquivado,
  };
})();
