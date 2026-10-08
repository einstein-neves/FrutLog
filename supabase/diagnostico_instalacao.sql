-- Diagnostico somente de leitura: nao altera tabelas nem registros.
-- Execute no SQL Editor do Supabase antes de qualquer limpeza de dados.

with colunas_esperadas (tabela, coluna, tipo) as (
  values
    ('usuario', 'id', 'obrigatoria'),
    ('usuario', 'organizacao_id', 'obrigatoria'),
    ('usuario', 'matricula', 'obrigatoria'),
    ('usuario', 'nome_completo', 'obrigatoria'),
    ('usuario', 'perfil', 'obrigatoria'),
    ('usuario', 'cargo', 'obrigatoria'),
    ('usuario', 'status', 'obrigatoria'),
    ('usuario', 'senha_hash', 'obrigatoria'),
    ('usuario', 'senha_temporaria', 'obrigatoria'),
    ('usuario', 'profissao', 'obrigatoria'),
    ('dispositivo', 'organizacao_id', 'obrigatoria'),
    ('dispositivo', 'talhao_id', 'obrigatoria'),
    ('dispositivo', 'id_externo', 'obrigatoria'),
    ('dispositivo', 'status', 'obrigatoria'),
    ('sensor', 'dispositivo_id', 'obrigatoria'),
    ('sensor', 'id_externo', 'obrigatoria'),
    ('sensor', 'codigo_metrica', 'obrigatoria'),
    ('sensor', 'unidade', 'obrigatoria'),
    ('sensor', 'status', 'obrigatoria'),
    ('leitura_sensor', 'sensor_id', 'obrigatoria'),
    ('leitura_sensor', 'dispositivo_id', 'obrigatoria'),
    ('leitura_sensor', 'coletado_em', 'obrigatoria'),
    ('leitura_sensor', 'valor', 'obrigatoria'),
    ('talhao', 'id', 'obrigatoria'),
    ('talhao', 'fazenda_id', 'obrigatoria'),
    ('talhao', 'codigo', 'obrigatoria'),
    ('talhao', 'area_hectares', 'obrigatoria'),
    ('talhao', 'coordenadas', 'obrigatoria'),
    ('ciclo_cultura', 'talhao_id', 'obrigatoria'),
    ('ciclo_cultura', 'cultivar_id', 'obrigatoria'),
    ('ciclo_cultura', 'plantado_em', 'obrigatoria'),
    ('ciclo_cultura', 'previsao_colheita', 'obrigatoria'),
    ('ciclo_cultura', 'area_plantada_hectares', 'obrigatoria'),
    ('ciclo_cultura', 'solo', 'obrigatoria'),
    ('ciclo_cultura', 'usuario_id', 'obrigatoria'),
    ('colheita', 'id', 'obrigatoria'),
    ('colheita', 'talhao_id', 'obrigatoria'),
    ('colheita', 'colhido_em', 'obrigatoria'),
    ('colheita', 'quantidade', 'obrigatoria'),
    ('colheita', 'unidade', 'obrigatoria'),
    ('colheita', 'ano', 'obrigatoria'),
    ('colheita', 'ciclo_cultura_id', 'obrigatoria'),
    ('colheita', 'registrado_por', 'obrigatoria'),
    ('colheita', 'crop_cycle_id', 'legada_opcional'),
    ('inspecao', 'talhao_id', 'obrigatoria'),
    ('inspecao', 'usuario_id', 'obrigatoria'),
    ('inspecao', 'sensor_id', 'obrigatoria'),
    ('inspecao', 'status', 'obrigatoria'),
    ('cultura', 'nome_comum', 'obrigatoria'),
    ('cultivar', 'id', 'obrigatoria'),
    ('cultivar', 'cultura_id', 'obrigatoria'),
    ('cultivar', 'nome', 'obrigatoria')
)
select
  e.tabela,
  e.coluna,
  case
    when c.column_name is null and e.tipo = 'legada_opcional' then 'AUSENTE (OK)'
    when c.column_name is null then 'FALTA'
    when e.tipo = 'legada_opcional' then 'PRESENTE (LEGADA)'
    else 'PRESENTE'
  end as resultado,
  c.data_type,
  c.is_nullable,
  c.column_default
from colunas_esperadas e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.tabela
 and c.column_name = e.coluna
order by e.tabela, e.coluna;

-- Verifique obrigatoriedades e chaves estrangeiras das tabelas operacionais.
select
  c.table_name as tabela,
  c.column_name as coluna,
  c.is_nullable,
  c.column_default,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('usuario', 'talhao', 'ciclo_cultura', 'colheita', 'inspecao')
  and c.is_nullable = 'NO'
  and c.column_default is null
order by c.table_name, c.ordinal_position;

select
  tc.table_name as tabela,
  tc.constraint_name as restricao,
  tc.constraint_type as tipo,
  pg_get_constraintdef(pc.oid) as definicao
from information_schema.table_constraints tc
join pg_class t
  on t.relname = tc.table_name
join pg_namespace ns
  on ns.oid = t.relnamespace
 and ns.nspname = tc.constraint_schema
join pg_constraint pc
  on pc.conname = tc.constraint_name
 and pc.conrelid = t.oid
where tc.constraint_schema = 'public'
  and tc.table_name in ('usuario', 'talhao', 'ciclo_cultura', 'colheita', 'inspecao', 'sensor', 'leitura_sensor')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- Funcoes e views que as rotas atuais precisam encontrar no schema public.
with objetos (nome, tipo) as (
  values
    ('proxima_matricula_funcionario', 'funcao'),
    ('salvar_geometrias_talhoes', 'funcao'),
    ('registrar_ocorrencia_com_alerta', 'funcao'),
    ('v_ultima_leitura_sensor', 'view'),
    ('v_telemetria_diaria_talhao', 'view')
)
select
  o.nome,
  o.tipo,
  case
    when o.tipo = 'funcao' and exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = o.nome
    ) then 'PRESENTE'
    when o.tipo = 'view' and to_regclass(format('public.%I', o.nome)) is not null then 'PRESENTE'
    else 'FALTA'
  end as resultado
from objetos o
order by o.tipo, o.nome;

-- Inventario de culturas, variedades, plantios e colheitas: sem hashes/senhas.
select 'cultura' as tipo, c.id::text as id, c.nome_comum as nome,
       null::text as talhao, null::text as status, to_jsonb(c)->>'criado_em' as data
from public.cultura c
union all
select 'cultivar', cv.id::text, cv.nome, c.nome_comum, null::text, to_jsonb(cv)->>'criado_em'
from public.cultivar cv
join public.cultura c on c.id = cv.cultura_id
union all
select
  'plantio',
  cc.id::text,
  cv.nome,
  t.codigo,
  coalesce(to_jsonb(cc)->>'status', '(sem status)'),
  coalesce(to_jsonb(cc)->>'plantado_em', '(sem data)')
from public.ciclo_cultura cc
join public.cultivar cv on cv.id = cc.cultivar_id
join public.talhao t on t.id = cc.talhao_id
order by tipo, nome, talhao;

select
  (select count(*) from public.usuario) as usuarios,
  (select count(*) from public.talhao) as talhoes,
  (select count(*) from public.sensor) as sensores,
  (select count(*) from public.cultura) as culturas,
  (select count(*) from public.cultivar) as cultivares,
  (select count(*) from public.ciclo_cultura) as plantios,
  (select count(*) from public.colheita) as colheitas,
  (select count(*) from public.talhao where coordenadas is not null) as talhoes_com_geometria,
  (select count(*) from public.talhao where coordenadas is null) as talhoes_sem_geometria;
