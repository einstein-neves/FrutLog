-- FrutLog | Migração segura do schema frutlog para public
--
-- Objetivo: mover o modelo operacional já existente SEM recriar tabelas e
-- SEM apagar dados. Execute uma única vez no Supabase SQL Editor.
--
-- Antes de executar:
--   1. Faça um backup do banco no Supabase.
--   2. Não execute supabase/schema.sql novamente: ele é o modelo legado
--      simplificado usado pelo backend atual.
--   3. Este script não remove as tabelas legadas pluralizadas em public
--      (usuarios, talhoes, sensores etc.), pois isso quebraria o backend
--      atual. Elas devem ser retiradas somente depois da adaptação da API.

begin;

-- Tipos usados pelas tabelas operacionais. A checagem permite repetir a
-- migração sem falhar caso uma etapa já tenha sido concluída.
do $$
declare
  item text;
begin
  foreach item in array array[
    'perfil_usuario', 'status_registro', 'status_dispositivo',
    'qualidade_leitura', 'severidade_alerta', 'status_alerta',
    'status_inspecao', 'unidade_colheita'
  ] loop
    if exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'frutlog' and t.typname = item
    ) and not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = item
    ) then
      execute format('alter type frutlog.%I set schema public', item);
    end if;
  end loop;
end $$;

-- Tabelas e partições. ALTER ... SET SCHEMA preserva registros, índices,
-- constraints, triggers, permissões e relacionamentos por chave estrangeira.
do $$
declare
  item text;
begin
  foreach item in array array[
    'organizacao', 'usuario', 'fazenda', 'talhao', 'cultura', 'cultivar',
    'ciclo_cultura', 'dispositivo', 'sensor', 'leitura_sensor',
    'leitura_sensor_2026_09', 'leitura_sensor_padrao', 'inspecao',
    'regra_alerta', 'alerta', 'colheita', 'evento_auditoria'
  ] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'frutlog' and c.relname = item and c.relkind in ('r', 'p')
    ) and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = item
    ) then
      execute format('alter table frutlog.%I set schema public', item);
    end if;
  end loop;
end $$;

-- Função de atualização e views dos painéis.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'frutlog' and p.proname = 'definir_atualizado_em'
  ) and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'definir_atualizado_em'
  ) then
    alter function frutlog.definir_atualizado_em() set schema public;
  end if;
end $$;

do $$
declare
  item text;
begin
  foreach item in array array['v_ultima_leitura_sensor', 'v_telemetria_diaria_talhao'] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'frutlog' and c.relname = item and c.relkind = 'v'
    ) and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = item
    ) then
      execute format('alter view frutlog.%I set schema public', item);
    end if;
  end loop;
end $$;

-- Bloqueia acesso direto por anon/authenticated. A service-role usada somente
-- pelo backend continua funcionando; políticas por organização podem ser
-- adicionadas quando o frontend autenticar pelo Supabase Auth.
alter table if exists public.organizacao enable row level security;
alter table if exists public.usuario enable row level security;
alter table if exists public.fazenda enable row level security;
alter table if exists public.talhao enable row level security;
alter table if exists public.cultura enable row level security;
alter table if exists public.cultivar enable row level security;
alter table if exists public.ciclo_cultura enable row level security;
alter table if exists public.dispositivo enable row level security;
alter table if exists public.sensor enable row level security;
alter table if exists public.leitura_sensor enable row level security;
alter table if exists public.inspecao enable row level security;
alter table if exists public.regra_alerta enable row level security;
alter table if exists public.alerta enable row level security;
alter table if exists public.colheita enable row level security;
alter table if exists public.evento_auditoria enable row level security;

commit;

-- Validação pós-migração (deve retornar 17 tabelas no schema public):
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
