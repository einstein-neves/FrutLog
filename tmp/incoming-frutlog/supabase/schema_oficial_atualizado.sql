-- ==============================================================================
-- FrutLog — Esquema Oficial Consolidado (Modelo Operacional Singular)
-- ==============================================================================
-- Modelo definitivo para instalacoes novas: tabelas, status, views, RPCs,
-- relatorios e politicas de acesso usados pela API Node.js.
-- As migracoes numeradas permanecem como historico/atualizacao de instalacoes existentes.
-- Execute este arquivo integralmente no SQL Editor de um projeto Supabase novo.
-- ==============================================================================

begin;

-- 1. Extensões
create extension if not exists "pgcrypto";

-- 2. Tipos e Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'perfil_usuario') then
    create type perfil_usuario as enum ('engenheiro', 'tecnico', 'administrador', 'admin');
  else
    begin
      alter type perfil_usuario add value if not exists 'admin';
    exception when others then null;
    end;
    begin
      alter type perfil_usuario add value if not exists 'administrador';
    exception when others then null;
    end;
  end if;
  if not exists (select 1 from pg_type where typname = 'status_registro') then
    create type status_registro as enum ('ativo', 'inativo');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_dispositivo') then
    create type status_dispositivo as enum ('online', 'offline', 'manutencao', 'desativado');
  end if;
  if not exists (select 1 from pg_type where typname = 'qualidade_leitura') then
    create type qualidade_leitura as enum ('boa', 'suspeita', 'invalida');
  end if;
  if not exists (select 1 from pg_type where typname = 'severidade_alerta') then
    create type severidade_alerta as enum ('baixa', 'media', 'alta', 'critica');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_alerta') then
    create type status_alerta as enum ('aberto', 'em_analise', 'resolvido', 'ignorado');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_inspecao') then
    create type status_inspecao as enum ('normal', 'atencao', 'critico');
  end if;
  if not exists (select 1 from pg_type where typname = 'unidade_colheita') then
    create type unidade_colheita as enum ('kg', 't', 'cx', 'sc');
  end if;
end $$;

-- 3. Funções utilitárias
create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- 4. Tabelas do Modelo Singular Operacional

-- 4.1 Organização
create table if not exists public.organizacao (
  id uuid primary key default gen_random_uuid(),
  nome varchar(255) not null constraint organizacao_nome_nao_vazio check (length(btrim(nome)) > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4.2 Usuário
create table if not exists public.usuario (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacao(id) on delete cascade,
  matricula varchar(40) unique not null constraint usuario_matricula_nao_vazia check (length(btrim(matricula)) > 0),
  nome_completo varchar(255) not null constraint usuario_nome_nao_vazio check (length(btrim(nome_completo)) > 0),
  cargo varchar(160) not null default '',
  profissao varchar(160) not null default '',
  perfil public.perfil_usuario not null,
  status public.status_registro not null default 'ativo',
  senha_hash text not null,
  senha_temporaria boolean not null default false,
  firebase_uid varchar(128),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4.3 Fazenda
create table if not exists public.fazenda (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacao(id) on delete cascade,
  nome varchar(255) not null constraint fazenda_nome_nao_vazio check (length(btrim(nome)) > 0),
  area_hectares numeric(10,2) not null default 0 check (area_hectares >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4.4 Cultura & Cultivar
create table if not exists public.cultura (
  id uuid primary key default gen_random_uuid(),
  nome_comum varchar(120) unique not null constraint cultura_nome_nao_vazio check (length(btrim(nome_comum)) > 0),
  criado_em timestamptz not null default now()
);

create table if not exists public.cultivar (
  id uuid primary key default gen_random_uuid(),
  cultura_id uuid not null references public.cultura(id) on delete cascade,
  nome varchar(160) not null constraint cultivar_nome_nao_vazio check (length(btrim(nome)) > 0),
  criado_em timestamptz not null default now(),
  constraint cultivar_unica_por_cultura unique (cultura_id, nome)
);

-- 4.5 Talhão
create table if not exists public.talhao (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazenda(id) on delete cascade,
  codigo varchar(40) not null constraint talhao_codigo_nao_vazio check (length(btrim(codigo)) > 0),
  nome varchar(255) not null default '',
  area_hectares numeric(10,2) not null check (area_hectares > 0),
  coordenadas jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint talhao_codigo_unico_por_fazenda unique (fazenda_id, codigo)
);

-- 4.6 Ciclo de Cultura (Plantios)
create table if not exists public.ciclo_cultura (
  id uuid primary key default gen_random_uuid(),
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  cultivar_id uuid not null references public.cultivar(id) on delete restrict,
  plantado_em date not null,
  previsao_colheita date not null,
  area_plantada_hectares numeric(10,2) not null check (area_plantada_hectares > 0),
  solo varchar(120) not null default '',
  status varchar(40) not null default 'ativo',
  usuario_id uuid references public.usuario(id) on delete set null,
  encerrado_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4.7 Dispositivo IoT
create table if not exists public.dispositivo (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacao(id) on delete cascade,
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  id_externo varchar(80) not null constraint dispositivo_externo_nao_vazio check (length(btrim(id_externo)) > 0),
  status public.status_dispositivo not null default 'online',
  instalado_em timestamptz not null default now(),
  ultimo_sinal_em timestamptz,
  constraint dispositivo_unico_por_org unique (organizacao_id, id_externo)
);

-- 4.8 Sensor
create table if not exists public.sensor (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.dispositivo(id) on delete cascade,
  id_externo varchar(80) not null,
  codigo_metrica varchar(60) not null,
  unidade varchar(20) not null,
  status varchar(40) not null default 'ativo',
  criado_em timestamptz not null default now(),
  constraint sensor_metrica_nao_vazia check (length(btrim(codigo_metrica)) > 0 and length(btrim(unidade)) > 0),
  constraint sensor_unico_por_dispositivo unique (dispositivo_id, id_externo)
);

-- 4.9 Leitura de Sensor (Telemetria IoT Particionada por Mês)
create table if not exists public.leitura_sensor (
  id bigint generated always as identity,
  sensor_id uuid not null references public.sensor(id) on delete cascade,
  dispositivo_id uuid not null references public.dispositivo(id) on delete cascade,
  coletado_em timestamptz not null default now(),
  valor numeric not null,
  unidade varchar(20),
  qualidade public.qualidade_leitura not null default 'boa',
  carga_bruta jsonb,
  criado_em timestamptz not null default now(),
  constraint pk_leitura_sensor primary key (id, coletado_em)
) partition by range (coletado_em);

-- Partição padrão de contingência (garante que nenhuma leitura seja rejeitada)
create table if not exists public.leitura_sensor_padrao
  partition of public.leitura_sensor default;

-- 4.10 Inspeção de Campo
create table if not exists public.inspecao (
  id uuid primary key default gen_random_uuid(),
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  usuario_id uuid references public.usuario(id) on delete set null,
  sensor_id uuid references public.sensor(id) on delete set null,
  inspecionado_em timestamptz not null default now(),
  status public.status_inspecao not null default 'normal',
  descricao_problema text,
  observacoes text,
  criado_em timestamptz not null default now()
);

-- 4.11 Ocorrência de Campo
create table if not exists public.ocorrencia (
  id uuid primary key default gen_random_uuid(),
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  usuario_id uuid references public.usuario(id) on delete set null,
  tipo varchar(120) not null,
  observacao text,
  registrado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

-- 4.12 Problema em Sensor
create table if not exists public.problema_sensor (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid references public.sensor(id) on delete set null,
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  usuario_id uuid references public.usuario(id) on delete set null,
  data date not null default current_date,
  problema text not null,
  observacao text,
  criado_em timestamptz not null default now()
);

-- 4.13 Regras de Alerta e Alertas
create table if not exists public.regra_alerta (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacao(id) on delete cascade,
  nome varchar(160) not null,
  codigo_metrica varchar(60) not null,
  valor_minimo numeric,
  valor_maximo numeric,
  severidade public.severidade_alerta not null default 'media',
  habilitado boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint regra_alerta_unica_idx unique (organizacao_id, nome)
);

create table if not exists public.alerta (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid references public.sensor(id) on delete cascade,
  talhao_id uuid references public.talhao(id) on delete cascade,
  regra_alerta_id uuid references public.regra_alerta(id) on delete set null,
  severidade public.severidade_alerta not null default 'media',
  status public.status_alerta not null default 'aberto',
  titulo varchar(255) not null,
  mensagem text not null,
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);

-- 4.14 Colheita
create table if not exists public.colheita (
  id uuid primary key default gen_random_uuid(),
  ciclo_cultura_id uuid references public.ciclo_cultura(id) on delete set null,
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  colhido_em date not null default current_date,
  quantidade numeric(12,2) not null check (quantidade >= 0),
  unidade public.unidade_colheita not null default 't',
  ano integer not null,
  registrado_por uuid references public.usuario(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- 4.15 Evento de Auditoria
create table if not exists public.evento_auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.usuario(id) on delete set null,
  acao varchar(120) not null,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

-- 4.16 Relatorio diario de campo (painel do Tecnico e Engenharia)
create table if not exists public.relatorio_campo_diario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuario(id) on delete set null,
  tecnico_nome varchar(255) not null,
  data_relatorio date not null,
  conteudo text not null constraint relatorio_conteudo_nao_vazio
    check (length(btrim(conteudo)) > 0 and length(conteudo) <= 6000),
  status varchar(20) not null default 'enviado'
    constraint relatorio_status_valido check (status in ('enviado', 'em_analise', 'concluido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint relatorio_unico_por_tecnico_dia unique (usuario_id, data_relatorio)
);

create index if not exists relatorio_campo_diario_data_idx
  on public.relatorio_campo_diario (data_relatorio desc, criado_em desc);

-- Matrículas sequenciais para cadastro de funcionários pelo painel Admin.
create sequence if not exists public.usuario_matricula_seq;

do $$
declare
  proxima_matricula bigint;
begin
  select greatest(coalesce(max(matricula::bigint), 4000) + 1, 4001)
    into proxima_matricula
    from public.usuario
   where matricula ~ '^[0-9]{1,18}$';

  perform setval('public.usuario_matricula_seq', proxima_matricula, false);
end;
$$;

create or replace function public.proxima_matricula_funcionario()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select nextval('public.usuario_matricula_seq')::text;
$$;

revoke all on function public.proxima_matricula_funcionario() from public;
grant execute on function public.proxima_matricula_funcionario() to service_role;

-- Geometrias atualizadas pelo Engenheiro e compartilhadas pelos tres paineis.
create or replace function public.salvar_geometrias_talhoes(
  p_fazenda_id uuid,
  p_features jsonb,
  p_removidos text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_codigo text;
  v_nome_talhao text;
  v_area_hectares numeric;
  v_coordenadas jsonb;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_fazenda_id is null or coalesce(jsonb_typeof(p_features), '') <> 'array' then
    return jsonb_build_object('erro', 'Dados de geometria invalidos.');
  end if;

  if not exists (select 1 from public.fazenda where id = p_fazenda_id) then
    return jsonb_build_object('erro', 'Fazenda nao encontrada.');
  end if;

  foreach v_codigo in array coalesce(p_removidos, '{}') loop
    if exists (
      select 1
        from public.talhao t
       where t.fazenda_id = p_fazenda_id
         and t.codigo = v_codigo
         and (
           exists (select 1 from public.ciclo_cultura c where c.talhao_id = t.id)
           or exists (select 1 from public.inspecao i where i.talhao_id = t.id)
           or exists (select 1 from public.ocorrencia o where o.talhao_id = t.id)
           or exists (select 1 from public.dispositivo d where d.talhao_id = t.id)
           or exists (select 1 from public.problema_sensor p where p.talhao_id = t.id)
           or exists (select 1 from public.alerta a where a.talhao_id = t.id)
         )
    ) then
      return jsonb_build_object('erro', format('O talhao %s possui historico ou sensores associados e nao pode ser removido.', v_codigo));
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_features) loop
    v_codigo := btrim(v_item #>> '{properties,codigo}');
    v_nome_talhao := coalesce(nullif(btrim(v_item #>> '{properties,nome}'), ''), v_codigo);
    v_area_hectares := coalesce(
      nullif(v_item #>> '{properties,area_hectares}', '')::numeric,
      nullif(replace(regexp_replace(coalesce(v_item #>> '{properties,area}', ''), '[^0-9,.]', '', 'g'), ',', '.'), '')::numeric
    );
    v_coordenadas := v_item #> '{geometry,coordinates,0}';

    if v_codigo is null or v_codigo = '' or length(v_codigo) > 40
       or v_area_hectares is null or v_area_hectares <= 0
       or v_coordenadas is null or jsonb_typeof(v_coordenadas) <> 'array' then
      return jsonb_build_object('erro', 'Codigo, area ou coordenadas de talhao invalidos.');
    end if;

    insert into public.talhao (fazenda_id, codigo, nome, area_hectares, coordenadas)
    values (p_fazenda_id, v_codigo, v_nome_talhao, v_area_hectares, v_coordenadas)
    on conflict (fazenda_id, codigo) do update
      set nome = excluded.nome,
          area_hectares = excluded.area_hectares,
          coordenadas = excluded.coordenadas,
          atualizado_em = now();
  end loop;

  if cardinality(coalesce(p_removidos, '{}')) > 0 then
    delete from public.talhao as t
     where t.fazenda_id = p_fazenda_id
       and t.codigo = any(p_removidos);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'codigo', t.codigo,
    'nome', t.nome,
    'area_hectares', t.area_hectares,
    'coordenadas', t.coordenadas
  ) order by t.codigo), '[]'::jsonb)
    into v_resultado
    from public.talhao as t
   where t.fazenda_id = p_fazenda_id;

  return v_resultado;
end;
$$;

revoke all on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) from public;
grant execute on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) to service_role;

create or replace function public.registrar_ocorrencia_com_alerta(
  p_talhao_id uuid,
  p_usuario_id uuid,
  p_talhao_codigo text,
  p_tipo text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ocorrencia_criada public.ocorrencia;
  alerta_criado public.alerta;
  severidade_alerta public.severidade_alerta;
begin
  if p_talhao_id is null or p_usuario_id is null
     or length(btrim(coalesce(p_tipo, ''))) = 0 then
    raise exception 'Dados de ocorrencia invalidos.';
  end if;

  insert into public.ocorrencia (talhao_id, usuario_id, tipo, observacao)
  values (p_talhao_id, p_usuario_id, btrim(p_tipo), nullif(btrim(p_observacao), ''))
  returning * into ocorrencia_criada;

  severidade_alerta := case
    when lower(p_tipo) like '%praga%'
      or lower(p_tipo) like '%doenca%'
      or lower(p_tipo) like '%sensor%'
      or lower(p_tipo) like '%agua%'
      then 'alta'::public.severidade_alerta
    else 'media'::public.severidade_alerta
  end;

  insert into public.alerta (talhao_id, severidade, status, titulo, mensagem)
  values (
    p_talhao_id,
    severidade_alerta,
    'aberto',
    left('Ocorrencia de campo: ' || btrim(p_tipo), 255),
    'Talhao ' || btrim(p_talhao_codigo) || ': ' ||
      coalesce(nullif(btrim(p_observacao), ''), btrim(p_tipo))
  )
  returning * into alerta_criado;

  return jsonb_build_object('ocorrencia', to_jsonb(ocorrencia_criada), 'alerta', to_jsonb(alerta_criado));
end;
$$;

create or replace function public.registrar_problema_sensor_com_alerta(
  p_sensor_id uuid,
  p_talhao_id uuid,
  p_usuario_id uuid,
  p_talhao_codigo text,
  p_sensor_codigo text,
  p_data date,
  p_problema text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  problema_criado public.problema_sensor;
  alerta_criado public.alerta;
begin
  if p_talhao_id is null or p_usuario_id is null or p_data is null
     or length(btrim(coalesce(p_problema, ''))) = 0 then
    raise exception 'Dados de problema de sensor invalidos.';
  end if;
  if p_sensor_id is not null and not exists (
    select 1
    from public.sensor s
    join public.dispositivo d on d.id = s.dispositivo_id
    where s.id = p_sensor_id and d.talhao_id = p_talhao_id
  ) then
    raise exception 'O sensor nao pertence ao talhao informado.';
  end if;

  insert into public.problema_sensor
    (sensor_id, talhao_id, usuario_id, data, problema, observacao)
  values
    (p_sensor_id, p_talhao_id, p_usuario_id, p_data, btrim(p_problema), nullif(btrim(p_observacao), ''))
  returning * into problema_criado;

  insert into public.alerta (sensor_id, talhao_id, severidade, status, titulo, mensagem)
  values (
    p_sensor_id,
    p_talhao_id,
    'alta',
    'aberto',
    left('Problema no sensor ' || btrim(coalesce(p_sensor_codigo, 'nao cadastrado')), 255),
    'Talhao ' || btrim(p_talhao_codigo) || ': ' ||
      coalesce(nullif(btrim(p_observacao), ''), btrim(p_problema))
  )
  returning * into alerta_criado;

  return jsonb_build_object('problema', to_jsonb(problema_criado), 'alerta', to_jsonb(alerta_criado));
end;
$$;

revoke all on function public.registrar_ocorrencia_com_alerta(uuid, uuid, text, text, text) from public;
revoke all on function public.registrar_problema_sensor_com_alerta(uuid, uuid, uuid, text, text, date, text, text) from public;
grant execute on function public.registrar_ocorrencia_com_alerta(uuid, uuid, text, text, text) to service_role;
grant execute on function public.registrar_problema_sensor_com_alerta(uuid, uuid, uuid, text, text, date, text, text) to service_role;

-- 5. Triggers de Consistência e Atualização
create or replace function public.validar_dispositivo_da_leitura()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.sensor s
    where s.id = new.sensor_id
      and s.dispositivo_id = new.dispositivo_id
  ) then
    raise exception 'sensor_id % não pertence ao dispositivo_id %', new.sensor_id, new.dispositivo_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists leitura_sensor_dispositivo_consistente on public.leitura_sensor;
create trigger leitura_sensor_dispositivo_consistente
  before insert or update of sensor_id, dispositivo_id
  on public.leitura_sensor
  for each row execute function public.validar_dispositivo_da_leitura();

-- 5.2 Rotina Dinâmica de Particionamento de Telemetria
create or replace function public.garantir_particao_leitura(data_alvo timestamptz)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio_mes timestamptz;
  fim_mes timestamptz;
  nome_particao text;
  query_ddl text;
begin
  inicio_mes := date_trunc('month', data_alvo);
  fim_mes := inicio_mes + interval '1 month';
  nome_particao := 'leitura_sensor_' || to_char(inicio_mes, 'YYYY_MM');

  -- Verifica se a partição já existe no schema public
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = nome_particao
  ) then
    query_ddl := format(
      'create table if not exists public.%I partition of public.leitura_sensor for values from (%L) to (%L)',
      nome_particao, inicio_mes, fim_mes
    );
    execute query_ddl;

    -- Concede permissões na partição criada
    execute format('grant select, insert, update, delete on public.%I to service_role', nome_particao);
    return 'Partição ' || nome_particao || ' criada com sucesso.';
  else
    return 'Partição ' || nome_particao || ' já existe.';
  end if;
end;
$$;

create or replace function public.gerar_particoes_telemetria(meses_futuros int default 12)
returns table(particao text, resultado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
  data_mes timestamptz;
  res text;
  nome text;
begin
  -- Cria partição para o mês anterior (contingência de telemetria com atraso)
  -- e para os meses correntes e futuros solicitados
  for i in -1..meses_futuros loop
    data_mes := date_trunc('month', now()) + (i || ' month')::interval;
    nome := 'leitura_sensor_' || to_char(data_mes, 'YYYY_MM');
    res := public.garantir_particao_leitura(data_mes);
    particao := nome;
    resultado := res;
    return next;
  end loop;
end;
$$;

-- Triggers de timestamp
drop trigger if exists trg_usuario_atualizado on public.usuario;
create trigger trg_usuario_atualizado before update on public.usuario
  for each row execute function public.definir_atualizado_em();

drop trigger if exists trg_organizacao_atualizada on public.organizacao;
create trigger trg_organizacao_atualizada before update on public.organizacao
  for each row execute function public.definir_atualizado_em();

drop trigger if exists trg_fazenda_atualizada on public.fazenda;
create trigger trg_fazenda_atualizada before update on public.fazenda
  for each row execute function public.definir_atualizado_em();

drop trigger if exists trg_talhao_atualizado on public.talhao;
create trigger trg_talhao_atualizado before update on public.talhao
  for each row execute function public.definir_atualizado_em();

drop trigger if exists trg_ciclo_cultura_atualizado on public.ciclo_cultura;
create trigger trg_ciclo_cultura_atualizado before update on public.ciclo_cultura
  for each row execute function public.definir_atualizado_em();

-- 6. Índices de Desempenho
create index if not exists leitura_sensor_busca_idx on public.leitura_sensor (sensor_id, coletado_em desc);
create index if not exists leitura_sensor_dispositivo_idx on public.leitura_sensor (dispositivo_id, coletado_em desc);
create index if not exists dispositivo_talhao_status_idx on public.dispositivo (talhao_id, status, ultimo_sinal_em desc nulls last);
create index if not exists sensor_dispositivo_metrica_idx on public.sensor (dispositivo_id, codigo_metrica) where status = 'ativo';
create index if not exists regra_alerta_org_metrica_idx on public.regra_alerta (organizacao_id, codigo_metrica) where habilitado;
create index if not exists alerta_sensor_status_idx on public.alerta (sensor_id, status, aberto_em desc);
create index if not exists ciclo_cultura_talhao_status_idx on public.ciclo_cultura (talhao_id, status, plantado_em desc);
create index if not exists inspecao_talhao_data_idx on public.inspecao (talhao_id, inspecionado_em desc);
create index if not exists ocorrencia_talhao_idx on public.ocorrencia (talhao_id, registrado_em desc);
create index if not exists problema_sensor_idx on public.problema_sensor (talhao_id, data desc);

-- 7. Views da API e dos Painéis
create or replace view public.v_ultima_leitura_sensor as
select distinct on (sensor_id)
  sensor_id,
  dispositivo_id,
  valor,
  unidade,
  qualidade,
  coletado_em
from public.leitura_sensor
order by sensor_id, coletado_em desc;

create or replace view public.v_telemetria_diaria_talhao as
select
  d.talhao_id,
  s.codigo_metrica,
  date_trunc('day', ls.coletado_em)::date as dia,
  round(avg(ls.valor)::numeric, 2) as valor_medio,
  min(ls.valor) as valor_minimo,
  max(ls.valor) as valor_maximo,
  count(*) as leituras_contabilizadas
from public.leitura_sensor ls
join public.sensor s on s.id = ls.sensor_id
join public.dispositivo d on d.id = ls.dispositivo_id
group by d.talhao_id, s.codigo_metrica, date_trunc('day', ls.coletado_em)::date;

-- 8. Permissões de Acesso e Row Level Security (RLS)
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter table public.organizacao enable row level security;
alter table public.usuario enable row level security;
alter table public.fazenda enable row level security;
alter table public.talhao enable row level security;
alter table public.cultura enable row level security;
alter table public.cultivar enable row level security;
alter table public.ciclo_cultura enable row level security;
alter table public.dispositivo enable row level security;
alter table public.sensor enable row level security;
alter table public.leitura_sensor enable row level security;
alter table public.inspecao enable row level security;
alter table public.ocorrencia enable row level security;
alter table public.problema_sensor enable row level security;
alter table public.regra_alerta enable row level security;
alter table public.alerta enable row level security;
alter table public.colheita enable row level security;
alter table public.evento_auditoria enable row level security;
alter table public.relatorio_campo_diario enable row level security;

-- Dados operacionais nao sao semeados; apenas registros reais devem ser cadastrados.

-- 9.1 Pré-geração de Partições de Telemetria (mês anterior, corrente e 12 meses futuros)
select * from public.gerar_particoes_telemetria(12);

-- 9.2 Agendamento Automático via pg_cron (se a extensão estiver disponível)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('criar-particoes-mensais-frutlog');
    perform cron.schedule('criar-particoes-mensais-frutlog', '0 0 1 * *', 'select public.gerar_particoes_telemetria(6);');
  end if;
exception when others then
  null;
end $$;

notify pgrst, 'reload schema';

commit;
