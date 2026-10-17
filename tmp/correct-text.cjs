const fs = require('fs'), path = require('path');
const acorn = require('./text-review/node_modules/acorn');
const words = {
  administracao:'administração', agronomo:'agrônomo', agricola:'agrícola', tecnicos:'técnicos', tecnico:'técnico',
  funcionarios:'funcionários', funcionario:'funcionário', matriculas:'matrículas', matricula:'matrícula',
  talhoes:'talhões', talhao:'talhão', area:'área', areas:'áreas', acoes:'ações', acao:'ação',
  metrica:'métrica', metricas:'métricas', media:'média', medias:'médias', minimo:'mínimo', maximo:'máximo',
  minimos:'mínimos', maximos:'máximos', situacao:'situação', previsao:'previsão', producao:'produção',
  inspecao:'inspeção', inspecoes:'inspeções', ocorrencia:'ocorrência', ocorrencias:'ocorrências',
  relatorio:'relatório', relatorios:'relatórios', diario:'diário', diarios:'diários', diaria:'diária', diarias:'diárias',
  historico:'histórico', historicos:'históricos', edicao:'edição', divisao:'divisão', divisoes:'divisões',
  selecao:'seleção', operacao:'operação', observacao:'observação', observacoes:'observações', descricao:'descrição',
  nao:'não', ja:'já', sera:'será', serao:'serão', devera:'deverá', possivel:'possível', disponivel:'disponível',
  disponiveis:'disponíveis', indisponivel:'indisponível', invalido:'inválido', invalida:'inválida', invalidos:'inválidos', invalidas:'inválidas',
  obrigatorio:'obrigatório', obrigatoria:'obrigatória', necessario:'necessário', necessaria:'necessária',
  provisoria:'provisória', provisoriamente:'provisoriamente', automatica:'automática', automatico:'automático',
  configuracao:'configuração', configuracoes:'configurações', conexao:'conexão', conexoes:'conexões',
  sessao:'sessão', permissoes:'permissões', permissao:'permissão', autenticacao:'autenticação',
  usuario:'usuário', usuarios:'usuários', senha:'senha', tambem:'também', apos:'após', ate:'até',
  sincronizacao:'sincronização', recuperacao:'recuperação', exclusao:'exclusão', versao:'versão',
  voce:'você', saude:'saúde', agua:'água', doencas:'doenças', proximo:'próximo', tres:'três',
  geometrica:'geométrica', visao:'visão', recomendacao:'recomendação', recomendacoes:'recomendações',
  validacao:'validação', periodo:'período', periodos:'períodos', ultimas:'últimas', ultima:'última', ultimo:'último', ultimos:'últimos',
  numerico:'numérico', numericos:'numéricos', numero:'número', numeros:'números', responsavel:'responsável',
  critico:'crítico', critica:'crítica', atencao:'atenção', manutencao:'manutenção', comunicacao:'comunicação',
  ha:'há', servico:'serviço', servicos:'serviços', plantacao:'plantação', plantacoes:'plantações',
  metodo:'método', pagina:'página', paginas:'páginas', especie:'espécie', especies:'espécies', fertilizacao:'fertilização',
};
function correct(text) {
  return text.replace(/\b[A-Za-z]+\b/g, (word, offset) => {
    if (/[._/\-]/.test(text[offset - 1] || '') || /[_/\-]/.test(text[offset + word.length] || '')) return word;
    const result = words[word.toLowerCase()];
    if (!result) return word;
    if (word === word.toUpperCase()) return result.toUpperCase();
    return word[0] === word[0].toUpperCase() ? result[0].toUpperCase()+result.slice(1) : result;
  }).replace(/\b(não|já) esta\b/g, '$1 está').replace(/\bestao\b/g, 'estão');
}
function html(text) {
  // Preserve implicit option values when changing their visible labels.
  text = text.replace(/<option\b([^>]*)>([^<]*)<\/option>/g, (all, attrs, label) => {
    const changed = correct(label);
    return changed !== label && !/\bvalue\s*=/.test(attrs)
      ? `<option${attrs} value="${label.replace(/"/g, '&quot;')}">${changed}</option>` : all;
  });
  return text.split(/(<!--[\s\S]*?-->|<[^>]*>)/g).map(part => {
    if (part.startsWith('<!--')) return part;
    if (part.startsWith('<')) return part.replace(/\b(placeholder|title|alt|aria-label)=("[^"]*"|'[^']*')/g, (_, attr, value) => `${attr}=${correct(value)}`);
    return correct(part);
  }).join('');
}
const files = fs.readdirSync('.').filter(f=>f.endsWith('.html'));
files.push(...fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f), 'api/[...route].js', 'server.js');
fs.mkdirSync('tmp/orthography-backup', {recursive:true});
let changed = 0;
for (const file of files) {
  const baseline = path.join('tmp/orthography-backup',file);
  const source = fs.readFileSync(fs.existsSync(baseline) ? baseline : file,'utf8'); let output = source;
  if(file.endsWith('.html')) output = html(source);
  else {
    const replacements = [];
    for (const token of acorn.tokenizer(source,{ecmaVersion:'latest',allowHashBang:true})) {
      if (token.type.label !== 'string') continue;
      const raw = source.slice(token.start,token.end);
      if (/[?=&]/.test(raw) && !/[<>]/.test(raw) && !/\s/.test(raw)) continue;
      if (!/\s/.test(raw) || /^(?:['"])[.#\[]/.test(raw)) continue;
      const next = /<\/?[a-z]/i.test(raw) ? html(raw) : correct(raw);
      if(next!==raw) replacements.push([token.start,token.end,next]);
    }
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'TemplateLiteral') {
        let raw = source.slice(node.start + 1, node.end - 1);
        if (!/\s/.test(raw) && /[?=&/]/.test(raw) && !/[<>]/.test(raw)) return;
        const expressions = node.expressions.map(expression => source.slice(expression.start,expression.end));
        for (let i = node.expressions.length - 1; i >= 0; i--) {
          const expression = node.expressions[i];
          const start = expression.start - node.start - 3, end = expression.end - node.start;
          raw = raw.slice(0,start) + `__EXPR${i}__` + raw.slice(end);
        }
        let next = /<\/?[a-z]/i.test(raw) ? html(raw) : correct(raw);
        expressions.forEach((expression,index) => { next = next.replaceAll(`__EXPR${index}__`, '${'+expression+'}'); });
        if(next!==source.slice(node.start+1,node.end-1)) replacements.push([node.start+1,node.end-1,next]);
        return;
      }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
    }
    walk(acorn.parse(source,{ecmaVersion:'latest',allowHashBang:true}));
    replacements.sort((a,b)=>a[0]-b[0]);
    for(const [start,end,next] of replacements.reverse()) output = output.slice(0,start)+next+output.slice(end);
  }
  if(output!==source) {
    const backup = path.join('tmp/orthography-backup',file); fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,source);
    fs.writeFileSync(file,output);console.log(file);changed++;
  }
}
console.log(`Files corrected: ${changed}`);
