-- ==============================================================================
-- FrutLog — Migração 006: Particionamento Dinâmico de Telemetria (leitura_sensor)
-- ==============================================================================
-- Objetivo:
-- 1. Assegurar que a tabela leitura_sensor esteja particionada por range de coletado_em.
-- 2. Garantir a existência da partição padrão (leitura_sensor_padrao) para contingência.
-- 3. Criar rotinas dinâmicas (PL/pgSQL) para provisionar partições mensais automaticamente.
-- 4. Pré-gerar as partições para o mês anterior, corrente e os próximos 12 meses.
-- 5. Configurar rotina agendada (pg_cron) se a extensão estiver habilitada.
-- ==============================================================================

begin;

-- 1. Se leitura_sensor não existir como tabela particionada, cria ou converte
do $$
begin
  -- Caso leitura_sensor não exista:
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'leitura_sensor') then
    create table public.leitura_sensor (
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
  end if;
end $$;

-- 2. Assegurar existência da partição padrão
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'leitura_sensor_padrao') then
    create table public.leitura_sensor_padrao
      partition of public.leitura_sensor default;
  end if;
end $$;

-- 3. Função para criação dinâmica de partição mensal sob demanda
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

    -- Concede permissões na partição recém-criada
    execute format('grant select, insert, update, delete on public.%I to service_role', nome_particao);
    return 'Partição ' || nome_particao || ' criada com sucesso.';
  else
    return 'Partição ' || nome_particao || ' já existe.';
  end if;
end;
$$;

-- 4. Função para gerar em lote as partições dos próximos N meses
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

-- 5. Executa a criação inicial das partições (-1 a +12 meses a partir da data atual)
select * from public.gerar_particoes_telemetria(12);

-- 6. Agendamento automático mensal no pg_cron (se disponível no Supabase)
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
