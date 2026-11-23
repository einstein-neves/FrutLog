-- Aplique apos 033_login_2fa_email.sql. Nao confirma e-mails antigos automaticamente.
begin;
alter table public.usuario
  add column if not exists email_verificado_em timestamptz,
  add column if not exists sessao_versao bigint not null default 0;

create or replace function public.usuario_proteger_identidade() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.email is distinct from old.email then new.email_verificado_em := null; end if;
  if new.email is distinct from old.email or new.senha_hash is distinct from old.senha_hash
     or new.totp_secret_ciphertext is distinct from old.totp_secret_ciphertext then
    new.sessao_versao := greatest(new.sessao_versao, old.sessao_versao + 1);
  end if;
  return new;
end; $$;
drop trigger if exists usuario_proteger_identidade on public.usuario;
create trigger usuario_proteger_identidade before update on public.usuario
for each row execute function public.usuario_proteger_identidade();

alter table public.desafio_login_otp drop constraint if exists desafio_login_otp_modo_check;
alter table public.desafio_login_otp add constraint desafio_login_otp_modo_check
  check (modo in ('setup','login','reset','email','verificar_email'));

create table if not exists public.conta_desafio (
  id uuid primary key, usuario_id uuid not null references public.usuario(id) on delete cascade,
  acao text not null check (acao in ('email','sessoes','recuperacao','autenticador')),
  codigo_hash text not null check(codigo_hash ~ '^[a-f0-9]{64}$'),
  credencial_hash text not null, expira_em timestamptz not null,
  tentativas smallint not null default 0, criado_em timestamptz not null default now()
);

create or replace function public.login_reservar_reenvio(p_anterior uuid,p_novo uuid,p_codigo text,p_credencial text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare d public.desafio_login_otp%rowtype;
begin
  select * into d from public.desafio_login_otp where id=p_anterior for update;
  if not found then return false; end if;
  if d.modo not in ('email','verificar_email') or d.expira_em<=now() or d.tentativas>=5
     or d.criado_em > now()-interval '60 seconds' or d.credencial_hash is distinct from p_credencial then return false; end if;
  insert into public.desafio_login_otp(id,usuario_id,modo,codigo_hash,credencial_hash,expira_em)
    values(p_novo,d.usuario_id,d.modo,p_codigo,p_credencial,now()+interval '5 minutes');
  delete from public.desafio_login_otp where id=p_anterior;
  return true;
end; $$;
create index if not exists conta_desafio_usuario_idx on public.conta_desafio(usuario_id, criado_em);
alter table public.conta_desafio enable row level security;
revoke all on public.conta_desafio from public, anon, authenticated;
grant select, insert, update, delete on public.conta_desafio to service_role;

create or replace function public.conta_criar_desafio(p_id uuid, p_usuario uuid, p_acao text, p_codigo text, p_credencial text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform 1 from public.usuario where id = p_usuario and status = 'ativo' for update;
  if not found then return false; end if;
  if exists(select 1 from public.conta_desafio where usuario_id = p_usuario and criado_em > now() - interval '60 seconds') then return false; end if;
  delete from public.conta_desafio where usuario_id = p_usuario;
  insert into public.conta_desafio(id,usuario_id,acao,codigo_hash,credencial_hash,expira_em)
    values(p_id,p_usuario,p_acao,p_codigo,p_credencial,now()+interval '5 minutes');
  return true;
end; $$;

create or replace function public.conta_consumir_desafio(p_id uuid, p_usuario uuid, p_codigo text, p_credencial text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare d public.conta_desafio%rowtype;
begin
  select * into d from public.conta_desafio where id=p_id and usuario_id=p_usuario for update;
  if not found then return null; end if;
  if d.expira_em <= now() or d.tentativas >= 5 or d.credencial_hash is distinct from p_credencial then
    delete from public.conta_desafio where id=p_id; return null;
  end if;
  if d.codigo_hash is distinct from p_codigo then
    update public.conta_desafio set tentativas=tentativas+1 where id=p_id; return null;
  end if;
  delete from public.conta_desafio where id=p_id;
  return jsonb_build_object('acao',d.acao);
end; $$;

create or replace function public.conta_confirmar_email(p_usuario uuid,p_email text,p_senha text,p_versao bigint)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  update public.usuario set email_verificado_em=now() where id=p_usuario and status='ativo'
    and email=p_email and senha_hash=p_senha and sessao_versao=p_versao;
  get diagnostics n=row_count; return n=1;
end; $$;

create or replace function public.conta_revogar_sessoes(p_usuario uuid,p_versao bigint)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  update public.usuario set sessao_versao=sessao_versao+1 where id=p_usuario and status='ativo' and sessao_versao=p_versao;
  get diagnostics n=row_count;
  if n=1 then delete from public.desafio_login_otp where usuario_id=p_usuario; end if;
  return n=1;
end; $$;

create or replace function public.configurar_autenticador_seguro(
  p_usuario_id uuid,p_senha_hash text,p_segredo_anterior text,p_novo_segredo text,p_passo bigint,p_codigos text[],p_email text,p_versao bigint
) returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare u public.usuario%rowtype;
begin
  select * into u from public.usuario where id=p_usuario_id for update;
  if not found then return false; end if;
  if u.email_verificado_em is null or u.email is distinct from p_email or u.sessao_versao <> p_versao then return false; end if;
  return public.substituir_autenticador(p_usuario_id,p_senha_hash,p_segredo_anterior,p_novo_segredo,p_passo,p_codigos);
end; $$;

create or replace function public.conta_renovar_codigos(p_usuario uuid,p_senha text,p_versao bigint,p_email text,p_codigos text[])
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare u public.usuario%rowtype;
begin
  select * into u from public.usuario where id=p_usuario for update;
  if not found then return false; end if;
  if u.status <> 'ativo' or u.senha_hash is distinct from p_senha or u.sessao_versao <> p_versao
    or u.email is distinct from p_email or u.email_verificado_em is null then return false; end if;
  if cardinality(p_codigos) is distinct from 10 then raise exception 'Codigos invalidos'; end if;
  delete from public.usuario_codigo_recuperacao where usuario_id=p_usuario;
  insert into public.usuario_codigo_recuperacao(usuario_id,codigo_hash) select p_usuario,c from unnest(p_codigos) c;
  update public.usuario set sessao_versao=sessao_versao+1 where id=p_usuario;
  delete from public.desafio_login_otp where usuario_id=p_usuario;
  return true;
end; $$;

create table if not exists public.email_entrega (
  id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuario(id) on delete set null,
  organizacao_id uuid not null references public.organizacao(id), tipo text not null,
  status text not null default 'pendente' check(status in ('pendente','aceito','falhou','incerto','reenviando','reenviado')),
  erro_codigo text, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists email_entrega_org_idx on public.email_entrega(organizacao_id,criado_em desc);
alter table public.email_entrega enable row level security;
revoke all on public.email_entrega from public, anon, authenticated;
grant select,insert,update on public.email_entrega to service_role;

create or replace function public.email_reservar_reenvio(p_id uuid,p_org uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.email_entrega%rowtype;
begin
  update public.email_entrega set status='reenviando',atualizado_em=now()
    where id=p_id and organizacao_id=p_org and tipo='boas_vindas' and status='falhou'
    and atualizado_em < now()-interval '60 seconds' returning * into e;
  if not found then return null; end if;
  return to_jsonb(e);
end; $$;

create table if not exists public.auditoria_evento (
  id uuid primary key default gen_random_uuid(), organizacao_id uuid not null references public.organizacao(id),
  ator_usuario_id uuid references public.usuario(id) on delete set null,
  metodo text not null, recurso text not null, resultado integer not null,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_evento_org_idx on public.auditoria_evento(organizacao_id,criado_em desc);
alter table public.auditoria_evento enable row level security;
revoke all on public.auditoria_evento from public,anon,authenticated;
grant select,insert on public.auditoria_evento to service_role;

revoke all on function public.conta_criar_desafio(uuid,uuid,text,text,text),
  public.conta_consumir_desafio(uuid,uuid,text,text), public.conta_confirmar_email(uuid,text,text,bigint),
  public.conta_revogar_sessoes(uuid,bigint),public.conta_renovar_codigos(uuid,text,bigint,text,text[]),
  public.email_reservar_reenvio(uuid,uuid),public.usuario_proteger_identidade() from public,anon,authenticated;
revoke all on function public.login_reservar_reenvio(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.login_reservar_reenvio(uuid,uuid,text,text) to service_role;
revoke all on function public.configurar_autenticador_seguro(uuid,text,text,text,bigint,text[],text,bigint) from public,anon,authenticated;
grant execute on function public.configurar_autenticador_seguro(uuid,text,text,text,bigint,text[],text,bigint) to service_role;
grant execute on function public.conta_criar_desafio(uuid,uuid,text,text,text),
  public.conta_consumir_desafio(uuid,uuid,text,text), public.conta_confirmar_email(uuid,text,text,bigint),
  public.conta_revogar_sessoes(uuid,bigint),public.conta_renovar_codigos(uuid,text,bigint,text,text[]),
  public.email_reservar_reenvio(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
