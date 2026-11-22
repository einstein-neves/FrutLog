-- TOTP por aplicativo autenticador e propriedade individual de dispositivos.
-- Aplicar apos as migracoes 029 e 030.
begin;

alter table public.usuario
  add column if not exists totp_secret_ciphertext text,
  add column if not exists totp_ativado_em timestamptz,
  add column if not exists totp_ultimo_passo bigint not null default -1;

alter table public.dispositivo
  add column if not exists responsavel_usuario_id uuid references public.usuario(id) on delete set null;
create index if not exists dispositivo_responsavel_idx on public.dispositivo(responsavel_usuario_id);

alter table public.desafio_login_otp
  alter column codigo_hash drop not null,
  add column if not exists modo text not null default 'login' check (modo in ('setup','login')),
  add column if not exists totp_secret_ciphertext text;
update public.desafio_login_otp set codigo_hash = null;

create table if not exists public.usuario_codigo_recuperacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  codigo_hash text not null check (codigo_hash ~ '^[a-f0-9]{64}$'),
  criado_em timestamptz not null default now(),
  unique(usuario_id, codigo_hash)
);
create index if not exists usuario_codigo_recuperacao_usuario_idx on public.usuario_codigo_recuperacao(usuario_id);
alter table public.usuario_codigo_recuperacao enable row level security;
revoke all on table public.usuario_codigo_recuperacao from public, anon, authenticated;
grant select, insert, delete on table public.usuario_codigo_recuperacao to service_role;

drop function if exists public.consumir_desafio_login_otp(uuid,text);
create function public.consumir_desafio_login_otp(p_id uuid, p_codigo_valido boolean, p_credencial_hash text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_desafio public.desafio_login_otp%rowtype;
begin
  select * into v_desafio from public.desafio_login_otp where id = p_id for update;
  if not found then return null; end if;
  if v_desafio.expira_em <= now() or v_desafio.tentativas >= 5 or
     p_credencial_hash is distinct from v_desafio.credencial_hash then
    delete from public.desafio_login_otp where id = p_id;
    return null;
  end if;
  if not coalesce(p_codigo_valido, false) then
    update public.desafio_login_otp set tentativas = tentativas + 1 where id = p_id;
    return null;
  end if;
  delete from public.desafio_login_otp where id = p_id;
  return jsonb_build_object('usuario_id', v_desafio.usuario_id, 'modo', v_desafio.modo,
    'totp_secret_ciphertext', v_desafio.totp_secret_ciphertext);
end;
$$;
revoke all on function public.consumir_desafio_login_otp(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.consumir_desafio_login_otp(uuid,boolean,text) to service_role;

create or replace function public.consumir_codigo_recuperacao(p_usuario_id uuid, p_codigo_hash text)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  delete from public.usuario_codigo_recuperacao
   where usuario_id = p_usuario_id and codigo_hash = p_codigo_hash
   returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.consumir_codigo_recuperacao(uuid,text) from public, anon, authenticated;
grant execute on function public.consumir_codigo_recuperacao(uuid,text) to service_role;

create or replace view public.v_telemetria_diaria_talhao as
select
  d.talhao_id,
  s.codigo_metrica,
  date_trunc('day', ls.coletado_em)::date as dia,
  round(avg(ls.valor)::numeric, 2) as valor_medio,
  min(ls.valor) as valor_minimo,
  max(ls.valor) as valor_maximo,
  count(*) as leituras_contabilizadas,
  d.id as dispositivo_id
from public.leitura_sensor ls
join public.sensor s on s.id = ls.sensor_id
join public.dispositivo d on d.id = ls.dispositivo_id
group by d.talhao_id, s.codigo_metrica, date_trunc('day', ls.coletado_em)::date, d.id;

commit;
