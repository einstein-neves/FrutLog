document.addEventListener('DOMContentLoaded', () => {
  const svg = document.getElementById('camada-talhoes');
  if (!svg) return;
  const map = svg.parentElement;
  let editing = false, drawing = false, saving = false, features = [], selected = '', points = [], drag = null, removed = [];
  window.FrutLogEditorAdmin = { ativo: () => editing };
  const toolbar = document.createElement('div');
  toolbar.className = 'admin-map-tools';
  map.before(toolbar);
  const message = document.createElement('p');
  message.className = 'mensagem-feedback';
  message.setAttribute('aria-live', 'polite');
  toolbar.after(message);
  const say = (text, error = false) => { message.textContent = text; message.classList.toggle('erro', error); };
  const buttons = {};
  function button(key, label, handler) {
    const element = document.createElement('button');
    element.type = 'button'; element.className = 'btn-filtro'; element.textContent = label;
    element.addEventListener('click', handler); toolbar.append(element); buttons[key] = element;
    return element;
  }
  const select = document.createElement('select');
  select.className = 'campo-formulario'; select.setAttribute('aria-label', 'Talhão para editar');
  const area = document.createElement('input');
  area.type = 'number'; area.min = '0.01'; area.step = '0.01'; area.className = 'campo-formulario';
  area.placeholder = 'Área (há)'; area.setAttribute('aria-label', 'Área do talhão em hectares');
  const current = () => features.find(f => f.properties.codigo === selected);
  const clone = value => JSON.parse(JSON.stringify(value));
  function sync() {
    buttons.edit.textContent = editing ? 'Editando talhões' : 'Editar Talhões';
    Object.entries(buttons).forEach(([key, element]) => { element.disabled = saving || (key !== 'edit' && !editing); });
    buttons.edit.disabled = editing || saving;
    buttons.finish.hidden = !drawing; buttons.finish.disabled = saving || points.length < 3;
    select.disabled = !editing || saving || drawing; area.disabled = !editing || saving || drawing;
    buttons.save.disabled = !editing || saving || drawing;
    map.classList.toggle('admin-map-editing', editing);
  }
  function refreshSelect() {
    select.replaceChildren();
    features.forEach(feature => { const option = document.createElement('option'); option.value = feature.properties.codigo; option.textContent = `Talhão ${option.value}`; select.append(option); });
    select.value = selected; area.value = current()?.properties.area_hectares || '';
  }
  function render() {
    FrutLogMapaTalhoes.renderizarMapaTalhoes(svg, features, {
      selectedCode: selected,
      onSelect: feature => { if (drawing || drag) return; selected = feature.properties.codigo; refreshSelect(); render(); },
    });
    if (drawing && points.length) {
      const line = document.createElementNS(svg.namespaceURI, 'polyline');
      line.setAttribute('points', points.map(p => p.join(',')).join(' '));
      line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#26734d'); line.setAttribute('stroke-width', '2'); line.style.pointerEvents = 'none'; svg.append(line);
    }
    if (!drawing && current()) FrutLogTalhoes.obterPontos(current()).forEach((point, index) => {
      const circle = document.createElementNS(svg.namespaceURI, 'circle');
      circle.setAttribute('cx', point[0]); circle.setAttribute('cy', point[1]); circle.setAttribute('r', '6');
      circle.classList.add('admin-map-vertex');
      circle.addEventListener('pointerdown', event => { if (saving) return; event.preventDefault(); event.stopPropagation(); drag = index; });
      svg.append(circle);
    });
    sync();
  }
  button('edit', 'Editar Talhões', async () => {
    buttons.edit.disabled = true;
    try {
      features = clone(await FrutLogMapaTalhoes.carregarMapaTalhoes('admin'));
      removed = [];
      selected = features[0]?.properties.codigo || ''; editing = true;
      refreshSelect(); render(); say('Selecione um talhão e arraste seus pontos. Use Criar para desenhar um novo limite.');
    } catch (error) { say(error.message, true); sync(); }
  });
  toolbar.append(select, area);
  select.addEventListener('change', () => { selected = select.value; refreshSelect(); render(); });
  area.addEventListener('change', () => {
    if (!current() || !Number.isFinite(Number(area.value)) || Number(area.value) <= 0) return;
    current().properties.area_hectares = Number(area.value); current().properties.area = `${area.value} hectares`;
  });
  // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: mensagem do novo modo de um clique
  button('create', 'Criar', () => { drawing = true; points = []; render(); say('Clique no mapa para criar o talhão. Depois arraste os 8 pontos para ajustar a forma.'); });
  // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: criacao virou funcao, para o clique no mapa chamar direto
  function concluirDesenho() {
    if (points.length < 3) return;
    let index = 1; while (features.some(f => f.properties.codigo === `T${index}`)) index++;
    selected = `T${index}`; features.push(FrutLogTalhoes.criarFeature(selected, points)); drawing = false; points = [];
    refreshSelect(); render(); area.focus(); say('Informe a área em hectares do novo talhão antes de salvar.');
  }
  button('finish', 'Concluir desenho', concluirDesenho);
  // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  button('save', 'Salvar', async () => {
    if (features.some(f => !Number.isFinite(Number(f.properties.area_hectares)) || Number(f.properties.area_hectares) <= 0 || FrutLogTalhoes.obterPontos(f).length < 3)) {
      say('Todos os talhões precisam de área positiva e limites com pelo menos três pontos.', true); return;
    }
    saving = true; sync();
    try {
      // A remoção só sai do mapa persistido depois que esta gravação for aceita pelo banco.
      const quantidadeArquivada = removed.length;
      const response = await FrutLog.apiFetch('/talhoes/geometrias', { method: 'PUT', body: JSON.stringify({ talhoes: features, removidos: removed }) });
      FrutLogTalhoes.carregarDoServidor(response.talhoes || []);
      editing = false; drawing = false; drag = null; removed = []; sync(); renderizarMapaAdmin();
      FrutLog.notificarAtualizacaoTalhoes(); window.dispatchEvent(new Event('frutlog:talhoes-atualizados'));
      say(quantidadeArquivada
        ? `Alterações salvas. ${quantidadeArquivada} talhão(ões) removido(s) do mapa e arquivado(s) para preservar o histórico.`
        : 'Formas e áreas salvas no banco.');
    } catch (error) { say(error.message, true); }
    finally { saving = false; sync(); }
  });
  button('delete', 'Excluir talhão', () => {
    const feature = current();
    if (!feature) return;
    if (features.length <= 1) { say('A fazenda precisa manter pelo menos um talhão.', true); return; }
    if (!window.confirm(`Excluir o talhão ${selected}? Essa alteração será aplicada ao banco ao clicar em Salvar.`)) return;
    if (!removed.includes(selected)) removed.push(selected);
    features = features.filter(item => item.properties.codigo !== selected);
    selected = features[0]?.properties.codigo || '';
    refreshSelect(); render(); say('Talhão removido da edição. Clique em Salvar para confirmar.');
  });
  button('cancel', 'Cancelar', () => { editing = false; drawing = false; drag = null; removed = []; sync(); renderizarMapaAdmin(); say('Edição cancelada.'); });
    // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: um clique cria um retangulo de 8 pontos
  // Monta um retangulo em volta do ponto clicado: 4 cantos + o meio de cada lado,
  // para o talhao novo ja nascer facil de moldar. Mesmo comportamento do painel do engenheiro.
  function retanguloComOitoPontos(centro, largura = 90, altura = 70) {
    const limitar = (valor, maximo) => Math.min(Math.max(valor, 0), maximo);
    const esquerda = limitar(centro[0] - largura / 2, 500);
    const direita = limitar(centro[0] + largura / 2, 500);
    const topo = limitar(centro[1] - altura / 2, 400);
    const base = limitar(centro[1] + altura / 2, 400);
    const meioX = (esquerda + direita) / 2;
    const meioY = (topo + base) / 2;

    return [
      [esquerda, topo], [meioX, topo], [direita, topo], [direita, meioY],
      [direita, base], [meioX, base], [esquerda, base], [esquerda, meioY],
    ];
  }
  // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  function point(event) {
    const rectangle = svg.getBoundingClientRect();
    return [Math.max(0, Math.min(500, (event.clientX - rectangle.left) * 500 / rectangle.width)), Math.max(0, Math.min(400, (event.clientY - rectangle.top) * 400 / rectangle.height))];
  }
   // INICIO HILCCER ROCHA DE ARAUJO MELO ALTERACAO: um clique cria o talhao pronto
  svg.addEventListener('click', event => {
    if (!editing || !drawing || saving) return;
    points = retanguloComOitoPontos(point(event));
    concluirDesenho();
  });
  // FIM HILCCER ROCHA DE ARAUJO MELO ALTERACAO
  window.addEventListener('pointermove', event => {
    if (!editing || drag === null || saving || !current()) return;
    const vertices = FrutLogTalhoes.obterPontos(current()); vertices[drag] = point(event);
    current().geometry.coordinates = [FrutLogTalhoes.fecharAnel(vertices)]; render();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('pointercancel', () => { drag = null; });
  sync();
});
