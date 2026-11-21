-- OTP de login por e-mail. Aplicar apos 029_notificacoes_email.sql.
begin;

create table if not exists public.desafio_login_otp (
  id uuid primary key,
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  codigo_hash text not null check (codigo_hash ~ '^[a-f0-9]{64}$'),
  credencial_hash text not null check (credencial_hash ~ '^[a-f0-9]{64}$'),
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas between 0 and 5),
  criado_em timestamptz not null default now()
);
create index if not exists desafio_login_otp_expira_idx on public.desafio_login_otp(expira_em);
alter table public.desafio_login_otp enable row level security;
revoke all on table public.desafio_login_otp from public, anon, authenticated;
grant select, insert, update, delete on table public.desafio_login_otp to service_role;

drop function if exists public.consumir_desafio_login_otp(uuid,text);
create function public.consumir_desafio_login_otp(p_id uuid, p_codigo_hash text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_desafio public.desafio_login_otp%rowtype;
begin
  select * into v_desafio from public.desafio_login_otp where id = p_id for update;
  if not found then return null; end if;
  if v_desafio.expira_em <= now() or v_desafio.tentativas >= 5 then
    delete from public.desafio_login_otp where id = p_id;
    return null;
  end if;
  if p_codigo_hash is distinct from v_desafio.codigo_hash then
    update public.desafio_login_otp set tentativas = tentativas + 1 where id = p_id;
    return null;
  end if;
  delete from public.desafio_login_otp where id = p_id;
  return jsonb_build_object('usuario_id', v_desafio.usuario_id, 'credencial_hash', v_desafio.credencial_hash);
end;
$$;
revoke all on function public.consumir_desafio_login_otp(uuid,text) from public, anon, authenticated;
grant execute on function public.consumir_desafio_login_otp(uuid,text) to service_role;

commit;
