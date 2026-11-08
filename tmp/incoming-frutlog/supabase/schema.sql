-- ==============================================================================
-- FrutLog — Esquema de Banco de Dados Unificado (Modelo Operacional Singular)
-- ==============================================================================
-- Este arquivo cria o esquema operacional base sem dados de exemplo.
-- Recursos incrementais da API sao instalados pelas migracoes numeradas.
-- Execute este script integralmente no SQL Editor do seu projeto Supabase.
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

commit;
