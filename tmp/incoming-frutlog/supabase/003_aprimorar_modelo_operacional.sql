-- FrutLog | Integridade e desempenho do modelo operacional em public
-- Execute depois de 002_mover_frutlog_para_public.sql.
-- Não remove nem altera as tabelas legadas pluralizadas usadas pela API atual.

begin;

-- As tabelas vieram de um schema privado e não herdaram privilégios REST.
-- A API usa exclusivamente service_role no servidor; anon e authenticated não
-- recebem acesso direto (e continuam sujeitos ao RLS).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Índices para os filtros usados pelos painéis, alertas e manutenção IoT.
create index if not exists dispositivo_talhao_status_idx
  on public.dispositivo (talhao_id, status, ultimo_sinal_em desc nulls last);
create index if not exists sensor_dispositivo_metrica_idx
  on public.sensor (dispositivo_id, codigo_metrica) where status = 'ativo';
create index if not exists regra_alerta_org_metrica_idx
  on public.regra_alerta (organizacao_id, codigo_metrica) where habilitado;
create index if not exists alerta_sensor_status_idx
  on public.alerta (sensor_id, status, aberto_em desc);
create index if not exists ciclo_cultura_talhao_status_idx
  on public.ciclo_cultura (talhao_id, status, plantado_em desc);

-- Evita regras de alerta duplicadas para a mesma métrica e organização.
create unique index if not exists regra_alerta_unica_idx
  on public.regra_alerta (organizacao_id, nome);

-- Impede que uma leitura referencie um sensor de outro dispositivo. A FK comum
-- não consegue validar essa relação composta sozinha.
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

-- Restringe valores de identificação vazios, sem bloquear dados opcionais.
-- PostgreSQL não oferece ADD CONSTRAINT IF NOT EXISTS; por isso a checagem é
-- feita no catálogo para que esta migração seja segura de executar novamente.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizacao_nome_nao_vazio' and conrelid = 'public.organizacao'::regclass) then
    alter table public.organizacao add constraint organizacao_nome_nao_vazio check (length(btrim(nome)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fazenda_nome_nao_vazio' and conrelid = 'public.fazenda'::regclass) then
    alter table public.fazenda add constraint fazenda_nome_nao_vazio check (length(btrim(nome)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'talhao_codigo_nao_vazio' and conrelid = 'public.talhao'::regclass) then
    alter table public.talhao add constraint talhao_codigo_nao_vazio check (length(btrim(codigo)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dispositivo_externo_nao_vazio' and conrelid = 'public.dispositivo'::regclass) then
    alter table public.dispositivo add constraint dispositivo_externo_nao_vazio check (length(btrim(id_externo)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sensor_metrica_nao_vazia' and conrelid = 'public.sensor'::regclass) then
    alter table public.sensor add constraint sensor_metrica_nao_vazia check (length(btrim(codigo_metrica)) > 0 and length(btrim(unidade)) > 0) not valid;
  end if;
end $$;

-- NOT VALID evita falha se existirem registros históricos inconsistentes.
-- Após corrigir os registros antigos, valide as constraints explicitamente:
-- alter table public.organizacao validate constraint organizacao_nome_nao_vazio;
-- alter table public.fazenda validate constraint fazenda_nome_nao_vazio;
-- alter table public.talhao validate constraint talhao_codigo_nao_vazio;
-- alter table public.dispositivo validate constraint dispositivo_externo_nao_vazio;
-- alter table public.sensor validate constraint sensor_metrica_nao_vazia;

commit;
