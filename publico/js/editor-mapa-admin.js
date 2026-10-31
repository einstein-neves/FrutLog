/* =========================================================
   FRUTLOG - EDITOR DE MAPA ADMIN
   Os botões agora são definidos exclusivamente no HTML.
   O JavaScript gerencia apenas os eventos e a persistência.

   Barra de ferramentas padronizada com o painel do Engenheiro: apenas
   "Editar talhão", "Criar", "Salvar" e "Excluir". Recarregar mapa, Dividir,
   Cancelar, o campo "Área do talhão (ha)" e o botão "Aplicar área" foram
   removidos; a área em hectares passou a sair da própria forma desenhada
   (FrutLogTalhoes.recalcularAreaAutomatica).
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const svg = document.getElementById("camada-talhoes");
  if (!svg) return;
  const mapaContainer = svg.parentElement;

  let modoEdicao = false;
  let modoCriacao = false;
  let salvando = false;
  let features = [];
  let talhaoSelecionado = "";
  let pontosCriacao = [];
  let verticeArrastado = null;
  let talhaoArrastado = null;
  let codigosRemovidos = [];
  // Forma do talhão antes do arraste, para recalcular a área ao soltar o ponto.
  let pontosAntesDoArraste = null;

  window.FrutLogEditorAdmin = { ativo: () => modoEdicao };

  const btnEditar = document.getElementById("btn-editar-talhoes");
  const btnCriar = document.getElementById("btn-criar-talhao");
  const btnExcluir = document.getElementById("btn-excluir-talhao");
  const btnSalvar = document.getElementById("btn-salvar-talhao");
  const mensagem = document.getElementById("mensagem-edicao-talhao");

  function say(texto, erro = false) {
    if (mensagem) {
      mensagem.textContent = texto;
      mensagem.className = `mensagem-feedback ${erro ? "erro" : "sucesso"}`;
    }
    // Erro vira toast; os avisos de progresso ficam só na linha de mensagem.
    if (erro) FrutLogFeedback.toast(texto, "erro");
  }

  function clone(val) {
    return JSON.parse(JSON.stringify(val));
  }

  function current() {
    return features.find((f) => f.properties.codigo === talhaoSelecionado);
  }

  /**
   * Sincroniza os 4 botões da barra do mapa com o estado atual da edição.
   *
   * Criar, Salvar e Excluir só ficam ativos dentro do modo de edição e nunca
   * durante um salvamento; "Editar talhão" alterna o próprio rótulo.
   * @returns {void}
   */
  function sync() {
    if (btnEditar) {
      btnEditar.textContent = modoEdicao ? "Encerrar edição" : "Editar talhão";
      btnEditar.classList.toggle("active", modoEdicao);
      btnEditar.disabled = salvando;
    }

    [btnCriar, btnExcluir, btnSalvar].forEach((btn) => {
      if (btn) btn.disabled = salvando || !modoEdicao;
    });

    if (btnCriar) btnCriar.classList.toggle("active", modoCriacao);

    if (mapaContainer) {
      mapaContainer.classList.toggle("admin-map-editing", modoEdicao);
      mapaContainer.classList.toggle("modo-edicao", modoEdicao);
    }
  }

  /**
   * Garante uma área positiva em hectares na feature do talhão.
   *
   * Sem o campo manual da barra de ferramentas, a área vem da forma desenhada:
   * o cálculo fica em FrutLogTalhoes, compartilhado com o painel do Engenheiro,
   * para que os dois cheguem ao mesmo número. O fallback de 10 ha só existe
   * para talhão legado sem geometria utilizável, porque PUT /talhoes/geometrias
   * e POST /plantios recusam área nula.
   * @param {object} feature - Feature GeoJSON do talhão (alterada no lugar).
   * @returns {number} Área em hectares com 2 casas decimais.
   */
  function obterAreaHectares(feature) {
    if (!feature) return 10.0;
    if (!feature.properties) feature.properties = {};

    let valor = feature.properties.area_hectares;
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      const parsed = Number(String(feature.properties.area || "").replace(/[^\d,.-]/g, "").replace(",", "."));
      valor = Number.isFinite(parsed) && parsed > 0
        ? parsed
        : FrutLogTalhoes.recalcularAreaAutomatica(feature) ?? 10.0;
    }

    const finalNum = Number(Number(valor).toFixed(2));
    feature.properties.area_hectares = finalNum;
    feature.properties.area = `${finalNum} hectares`;
    return finalNum;
  }

  /**
   * Atualiza a área do talhão selecionado depois de arrastar pontos ou movê-lo.
   *
   * Faz o papel do antigo par "Área do talhão (ha)" + "Aplicar área": a área
   * acompanha a forma na mesma proporção, de modo que um talhão já medido em
   * campo não perca o valor real por causa de um ajuste fino no desenho.
   * @param {Array<Array<number>>} pontosAnteriores - Vértices antes do arraste.
   * @returns {void}
   */
  function recalcularAreaTalhaoEditado(pontosAnteriores) {
    const feature = current();
    if (!feature) return;

    const area = FrutLogTalhoes.recalcularAreaAutomatica(feature, pontosAnteriores);
    if (area === null) return;

    const elArea = document.getElementById("talhao-area");
    if (elArea) elArea.textContent = feature.properties.area;
  }

  function sincronizarBotoesTalhao() {
    const container = document.getElementById("botoes-talhao");
    if (!container) return;
    container.querySelectorAll(".btn-talhao").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.talhao === talhaoSelecionado || btn.dataset.talhaoAdmin === talhaoSelecionado);
    });
  }

  function render() {
    FrutLogMapaTalhoes.renderizarMapaTalhoes(svg, features, {
      selectedCode: talhaoSelecionado,
      onSelect: (feature) => {
        if (modoCriacao || salvando) return;
        talhaoSelecionado = feature.properties.codigo;
        sincronizarBotoesTalhao();
        if (typeof selecionarTalhaoAdmin === "function") {
          selecionarTalhaoAdmin(talhaoSelecionado);
        }
        render();
      },
      onPolygon: (poligono, feature) => {
        const codigo = feature.properties.codigo;
        poligono.addEventListener("pointerdown", (evento) => {
          if (!modoEdicao || modoCriacao || salvando || codigo !== talhaoSelecionado) return;
          evento.preventDefault();
          talhaoArrastado = {
            codigo,
            origem: obterPontoSvg(evento),
            moveu: false,
          };
        });
      },
    });

    if (modoCriacao && pontosCriacao.length > 0) {
      const rascunho = document.createElementNS(svg.namespaceURI, "polyline");
      rascunho.setAttribute("points", pontosCriacao.map((p) => p.join(",")).join(" "));
      rascunho.setAttribute("fill", "rgba(123, 31, 162, 0.18)");
      rascunho.setAttribute("stroke", "#26734d");
      rascunho.setAttribute("stroke-width", "2");
      rascunho.style.pointerEvents = "none";
      svg.appendChild(rascunho);
    }

    if (modoEdicao && current()) {
      FrutLogTalhoes.obterPontos(current()).forEach((point, index) => {
        const circle = document.createElementNS(svg.namespaceURI, "circle");
        circle.setAttribute("cx", point[0]);
        circle.setAttribute("cy", point[1]);
        circle.setAttribute("r", "6");
        circle.classList.add("admin-map-vertex", "ponto-arrastavel");
        circle.addEventListener("pointerdown", (event) => {
          if (salvando) return;
          event.preventDefault();
          event.stopPropagation();
          verticeArrastado = index;
        });
        svg.appendChild(circle);
      });
    }

    sincronizarBotoesTalhao();
    sync();
  }

  function retanguloComOitoPontos(centro, largura = 90, altura = 70) {
    const limitar = (valor, maximo) => Math.min(Math.max(valor, 0), maximo);
    const esquerda = limitar(centro[0] - largura / 2, 500);
    const direita = limitar(centro[0] + largura / 2, 500);
    const topo = limitar(centro[1] - altura / 2, 400);
    const base = limitar(centro[1] + altura / 2, 400);
    const meioX = Math.round((esquerda + direita) / 2);
    const meioY = Math.round((topo + base) / 2);

    return [
      [Math.round(esquerda), Math.round(topo)],
      [meioX, Math.round(topo)],
      [Math.round(direita), Math.round(topo)],
      [Math.round(direita), meioY],
      [Math.round(direita), Math.round(base)],
      [meioX, Math.round(base)],
      [Math.round(esquerda), Math.round(base)],
      [Math.round(esquerda), meioY],
    ];
  }

  function obterPontoSvg(event) {
    const rectangle = svg.getBoundingClientRect();
    return [
      Math.max(0, Math.min(500, Math.round(((event.clientX - rectangle.left) * 500) / rectangle.width))),
      Math.max(0, Math.min(400, Math.round(((event.clientY - rectangle.top) * 400) / rectangle.height))),
    ];
  }

  // Um código já usado por talhão arquivado continua ocupado no banco e faria o
  // salvamento do mapa inteiro falhar, por isso ele também é pulado aqui.
  function codigoIndisponivel(codigo) {
    return features.some((f) => f.properties.codigo === codigo)
      || FrutLogMapaTalhoes.codigoArquivado(codigo);
  }

  /**
   * Fecha o desenho em andamento e cria o talhão no rascunho do mapa.
   *
   * A área em hectares sai da forma desenhada, no lugar do campo manual que
   * existia na barra de ferramentas.
   * @returns {void}
   */
  function concluirDesenho() {
    if (pontosCriacao.length < 3) return;
    let index = 1;
    while (codigoIndisponivel(`T${index}`)) index++;
    talhaoSelecionado = `T${index}`;

    const novaFeature = FrutLogTalhoes.criarFeature(talhaoSelecionado, pontosCriacao);
    const areaCalculada = obterAreaHectares(novaFeature);
    features.push(novaFeature);

    modoCriacao = false;
    pontosCriacao = [];
    render();
    if (typeof selecionarTalhaoAdmin === "function") {
      selecionarTalhaoAdmin(talhaoSelecionado);
    }
    say(`Talhão ${talhaoSelecionado} criado com ${areaCalculada} hectares calculados pela forma. Arraste os 8 pontos para ajustar e clique em Salvar.`);
  }

  // Binds aos 4 botões da barra padronizada já presentes no HTML.
  // "Editar talhão" entra na edição relendo o servidor e, ao sair, descarta o
  // rascunho não salvo — papel que antes era do botão "Cancelar".
  btnEditar?.addEventListener("click", async () => {
    if (modoEdicao) {
      modoEdicao = false;
      modoCriacao = false;
      verticeArrastado = null;
      talhaoArrastado = null;
      codigosRemovidos = [];
      sync();
      if (typeof renderizarMapaAdmin === "function") renderizarMapaAdmin();
      say("Modo de edição encerrado. As alterações não salvas foram descartadas.");
      return;
    }

    btnEditar.disabled = true;
    try {
      features = clone(await FrutLogMapaTalhoes.carregarMapaTalhoes("admin"));
      codigosRemovidos = [];
      talhaoSelecionado = features[0]?.properties.codigo || "";
      modoEdicao = true;
      modoCriacao = false;
      render();
      say("Selecione um talhão e arraste seus pontos; a área em hectares é recalculada sozinha. Use Criar para um novo talhão ou Salvar para confirmar.");
    } catch (error) {
      say(error.message, true);
      sync();
    }
  });

  btnCriar?.addEventListener("click", () => {
    if (!modoEdicao) return;
    modoCriacao = true;
    pontosCriacao = [];
    render();
    say("Clique no mapa para criar o talhão com 8 pontos de ajuste. Depois arraste os pontos para moldar a forma.");
  });

  /**
   * Persiste geometrias e áreas do mapa no banco (botão "Salvar").
   *
   * ATENÇÃO (API): PUT /talhoes/geometrias grava o rascunho inteiro e devolve a
   * versão oficial; códigos removidos viram histórico arquivado. A rota recusa
   * talhão sem área positiva, por isso a normalização antes do envio.
   * @returns {Promise<void>}
   */
  btnSalvar?.addEventListener("click", async () => {
    // Normaliza e garante área válida em hectares para todos os talhões
    features.forEach((f) => {
      obterAreaHectares(f);
    });

    for (const f of features) {
      const codigo = f.properties.codigo;
      const pts = FrutLogTalhoes.obterPontos(f);
      if (pts.length < 3) {
        say(`O talhão ${codigo} precisa ter limites com pelo menos 3 pontos desenhados no mapa.`, true);
        talhaoSelecionado = codigo;
        render();
        return;
      }
      const areaHectares = Number(f.properties.area_hectares);
      if (!Number.isFinite(areaHectares) || areaHectares <= 0) {
        say(`Não foi possível calcular a área do talhão ${codigo}. Redesenhe seus limites no mapa.`, true);
        talhaoSelecionado = codigo;
        render();
        return;
      }
    }

    salvando = true;
    sync();
    say("Salvando alterações de talhões no banco de dados...");

    try {
      const quantidadeArquivada = codigosRemovidos.length;
      const response = await FrutLog.apiFetch("/talhoes/geometrias", {
        method: "PUT",
        body: JSON.stringify({ talhoes: features, removidos: codigosRemovidos }),
      });

      // Os removidos acabaram de virar histórico: seus códigos seguem ocupados.
      FrutLogMapaTalhoes.adicionarCodigosArquivados(codigosRemovidos);
      FrutLogTalhoes.carregarDoServidor(response.talhoes || []);
      modoEdicao = false;
      modoCriacao = false;
      verticeArrastado = null;
      talhaoArrastado = null;
      codigosRemovidos = [];

      sync();
      if (typeof renderizarMapaAdmin === "function") renderizarMapaAdmin();

      FrutLog.notificarAtualizacaoTalhoes();
      window.dispatchEvent(new Event("frutlog:talhoes-atualizados"));

      say(
        quantidadeArquivada
          ? `Alterações salvas. ${quantidadeArquivada} talhão(ões) removido(s) do mapa e preservado(s) no histórico.`
          : "Formas e áreas dos talhões salvas com sucesso no banco de dados."
      );
    } catch (error) {
      say(error.message, true);
    } finally {
      salvando = false;
      sync();
    }
  });

  /**
   * Remove o talhão selecionado do rascunho do mapa (botão "Excluir").
   *
   * ATENÇÃO (banco): nada sai do Supabase aqui; a remoção só é aplicada no
   * PUT /talhoes/geometrias do botão Salvar, que arquiva o código do talhão.
   * @returns {void}
   */
  btnExcluir?.addEventListener("click", () => {
    const feature = current();
    if (!feature) return;
    if (features.length <= 1) {
      say("A fazenda precisa manter pelo menos um talhão.", true);
      return;
    }
    if (!window.confirm(`Excluir o talhão ${talhaoSelecionado}? Essa alteração será aplicada ao banco ao clicar em Salvar.`)) {
      return;
    }
    if (!codigosRemovidos.includes(talhaoSelecionado)) codigosRemovidos.push(talhaoSelecionado);
    features = features.filter((item) => item.properties.codigo !== talhaoSelecionado);
    talhaoSelecionado = features[0]?.properties.codigo || "";
    render();
    if (typeof selecionarTalhaoAdmin === "function") {
      selecionarTalhaoAdmin(talhaoSelecionado);
    }
    say("Talhão removido da edição. Clique em Salvar para confirmar no banco.");
  });

  // Clique no mapa: cria talhão retangular de 8 pontos com 1 clique
  svg.addEventListener("click", (event) => {
    if (!modoEdicao || !modoCriacao || salvando) return;
    pontosCriacao = retanguloComOitoPontos(obterPontoSvg(event));
    concluirDesenho();
  });

  window.addEventListener("pointermove", (event) => {
    if (!modoEdicao || salvando || !current()) return;

    // Primeira mexida do arraste: guarda a forma para recalcular a área depois.
    if ((verticeArrastado !== null || talhaoArrastado !== null) && !pontosAntesDoArraste) {
      pontosAntesDoArraste = FrutLogTalhoes.obterPontos(current()).map((p) => [...p]);
    }

    if (verticeArrastado !== null) {
      const vertices = FrutLogTalhoes.obterPontos(current());
      vertices[verticeArrastado] = obterPontoSvg(event);
      current().geometry.coordinates = [FrutLogTalhoes.fecharAnel(vertices)];
      render();
    } else if (talhaoArrastado !== null) {
      const destino = obterPontoSvg(event);
      const dx = destino[0] - talhaoArrastado.origem[0];
      const dy = destino[1] - talhaoArrastado.origem[1];
      if (dx !== 0 || dy !== 0) {
        const vertices = FrutLogTalhoes.obterPontos(current()).map((p) => [
          Math.max(0, Math.min(500, p[0] + dx)),
          Math.max(0, Math.min(400, p[1] + dy)),
        ]);
        current().geometry.coordinates = [FrutLogTalhoes.fecharAnel(vertices)];
        talhaoArrastado.origem = destino;
        talhaoArrastado.moveu = true;
        render();
      }
    }
  });

  window.addEventListener("pointerup", () => {
    // Soltou o ponto: a área em hectares acompanha a nova forma do talhão.
    if (pontosAntesDoArraste) recalcularAreaTalhaoEditado(pontosAntesDoArraste);
    pontosAntesDoArraste = null;
    verticeArrastado = null;
    talhaoArrastado = null;
  });

  window.addEventListener("pointercancel", () => {
    pontosAntesDoArraste = null;
    verticeArrastado = null;
    talhaoArrastado = null;
  });

  // Atualiza quando o painel geral de admin carrega talhões
  window.addEventListener("frutlog:talhoes-atualizados", () => {
    if (modoEdicao) return;
    features = clone(FrutLogTalhoes.obterTalhoes());
    if (!features.some((f) => f.properties.codigo === talhaoSelecionado)) {
      talhaoSelecionado = features[0]?.properties.codigo || "";
    }
  });

  sync();
});
