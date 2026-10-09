document.addEventListener('DOMContentLoaded', () => {
  const svg = document.getElementById('mapa-talhoes-admin');
  if (!svg) return;
  const map = svg.parentElement;
  let editing = false, drawing = false, saving = false, features = [], selected = '', points = [], drag = null;
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
  button('create', 'Criar', () => { drawing = true; points = []; render(); say('Marque pelo menos três pontos no mapa e clique em Concluir desenho.'); });
  button('finish', 'Concluir desenho', () => {
    if (points.length < 3) return;
    let index = 1; while (features.some(f => f.properties.codigo === `T${index}`)) index++;
    selected = `T${index}`; features.push(FrutLogTalhoes.criarFeature(selected, points)); drawing = false; points = [];
    refreshSelect(); render(); area.focus(); say('Informe a área em hectares do novo talhão antes de salvar.');
  });
  button('save', 'Salvar', async () => {
    if (features.some(f => !Number.isFinite(Number(f.properties.area_hectares)) || Number(f.properties.area_hectares) <= 0 || FrutLogTalhoes.obterPontos(f).length < 3)) {
      say('Todos os talhões precisam de área positiva e limites com pelo menos três pontos.', true); return;
    }
    saving = true; sync();
    try {
      const response = await FrutLog.apiFetch('/talhoes/geometrias', { method: 'PUT', body: JSON.stringify({ talhoes: features, removidos: [] }) });
      FrutLogTalhoes.carregarDoServidor(response.talhoes || []);
      editing = false; drawing = false; drag = null; sync(); renderizarMapaAdmin();
      FrutLog.notificarAtualizacaoTalhoes(); window.dispatchEvent(new Event('frutlog:talhoes-atualizados'));
      say('Formas e áreas salvas no banco.');
    } catch (error) { say(error.message, true); }
    finally { saving = false; sync(); }
  });
  button('cancel', 'Cancelar', () => { editing = false; drawing = false; drag = null; sync(); renderizarMapaAdmin(); say('Edição cancelada.'); });
  function point(event) {
    const rectangle = svg.getBoundingClientRect();
    return [Math.max(0, Math.min(500, (event.clientX - rectangle.left) * 500 / rectangle.width)), Math.max(0, Math.min(400, (event.clientY - rectangle.top) * 400 / rectangle.height))];
  }
  svg.addEventListener('click', event => { if (!editing || !drawing || saving) return; points.push(point(event)); render(); });
  window.addEventListener('pointermove', event => {
    if (!editing || drag === null || saving || !current()) return;
    const vertices = FrutLogTalhoes.obterPontos(current()); vertices[drag] = point(event);
    current().geometry.coordinates = [FrutLogTalhoes.fecharAnel(vertices)]; render();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('pointercancel', () => { drag = null; });
  sync();
});
