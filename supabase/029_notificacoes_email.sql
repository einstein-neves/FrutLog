-- Aplicar uma vez no SQL Editor antes de publicar o cadastro com e-mail.
-- Eventos sao registrados na mesma transacao da operacao; SMTP fica no worker.
begin;

alter table public.usuario add column if not exists email varchar(254);
alter table public.usuario drop constraint if exists usuario_email_valido;
alter table public.usuario add constraint usuario_email_valido check (
  email is null or (length(email) between 3 and 254 and email !~ '[[:space:],;<>]' and email ~ '^[^@]+@[^@]+[.][^@]+$')
);

create table if not exists public.email_fila (
  id uuid primary key default gen_random_uuid(),
  evento_chave uuid not null,
  organizacao_id uuid not null references public.organizacao(id) on delete cascade,
  usuario_id uuid references public.usuario(id) on delete set null,
  destinatario varchar(254) not null,
  tipo text not null check (tipo in ('conta_criada','email_cadastrado','senha_alterada','senha_redefinida','relatorio_enviado','relatorio_status','alerta_aberto','alerta_resolvido')),
  registro_id uuid not null,
  dados jsonb not null default '{}',
  status text not null default 'pendente' check (status in ('pendente','processando','enviado','falhou','incerto','descartado')),
  tentativas integer not null default 0,
  reserva uuid,
  reservado_em timestamptz,
  enviado_em timestamptz,
  erro_codigo text,
  criado_em timestamptz not null default now(),
  unique(evento_chave, destinatario)
);
create index if not exists email_fila_pendentes_idx on public.email_fila(criado_em) where status = 'pendente';
alter table public.email_fila enable row level security;
revoke all on table public.email_fila from public, anon, authenticated;
grant select, insert, update, delete on public.email_fila to service_role;

create or replace function public.email_criar_evento(
  p_org uuid, p_tipo text, p_registro uuid, p_dados jsonb,
  p_usuario uuid default null, p_perfis text[] default null
) returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_evento uuid := gen_random_uuid();
begin
  if p_org is null then return; end if;
  insert into public.email_fila(evento_chave, organizacao_id, usuario_id, destinatario, tipo, registro_id, dados)
  select v_evento, p_org, u.id, lower(btrim(u.email)), p_tipo, p_registro, p_dados
  from public.usuario u
  where u.organizacao_id = p_org and u.status = 'ativo' and nullif(btrim(u.email), '') is not null
    and ((p_usuario is not null and u.id = p_usuario)
      or (p_usuario is null and p_perfis is not null and u.perfil::text = any(p_perfis)))
  order by u.id
  on conflict(evento_chave, destinatario) do nothing;
end;
$$;

create or replace function public.email_evento_usuario()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_tipo text;
begin
  if tg_op = 'INSERT' then v_tipo := 'conta_criada';
  elsif new.senha_hash is distinct from old.senha_hash then
    v_tipo := case when new.senha_temporaria then 'senha_redefinida' else 'senha_alterada' end;
  elsif new.email is distinct from old.email and new.email is not null then v_tipo := 'email_cadastrado';
  else return new;
  end if;
  perform public.email_criar_evento(new.organizacao_id, v_tipo, new.id,
    jsonb_build_object('matricula', new.matricula), new.id);
  return new;
end;
$$;
drop trigger if exists trg_email_usuario on public.usuario;
create trigger trg_email_usuario after insert or update on public.usuario for each row execute function public.email_evento_usuario();

create or replace function public.email_evento_relatorio()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_org uuid;
begin
  select organizacao_id into v_org from public.usuario where id = new.usuario_id;
  if tg_op = 'INSERT' then
    perform public.email_criar_evento(v_org, 'relatorio_enviado', new.id,
      jsonb_build_object('data', new.data_relatorio), null, array['admin','administrador','engenheiro']);
  elsif new.status is distinct from old.status then
    perform public.email_criar_evento(v_org, 'relatorio_status', new.id,
      jsonb_build_object('data', new.data_relatorio, 'status', new.status), new.usuario_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_email_relatorio on public.relatorio_campo_diario;
create trigger trg_email_relatorio after insert or update on public.relatorio_campo_diario for each row execute function public.email_evento_relatorio();

create or replace function public.email_evento_alerta()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_org uuid; v_codigo text; v_tipo text;
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'aberto' then return new; end if;
    v_tipo := 'alerta_aberto';
  elsif new.status is distinct from old.status and new.status::text = 'resolvido' then
    v_tipo := 'alerta_resolvido';
  else return new;
  end if;
  select f.organizacao_id, t.codigo into v_org, v_codigo
  from public.talhao t join public.fazenda f on f.id = t.fazenda_id where t.id = new.talhao_id;
  perform public.email_criar_evento(v_org, v_tipo, new.id,
    jsonb_build_object('talhao', v_codigo, 'severidade', new.severidade, 'titulo', left(new.titulo, 255)),
    null, array['admin','administrador','engenheiro','tecnico']);
  return new;
end;
$$;
drop trigger if exists trg_email_alerta on public.alerta;
create trigger trg_email_alerta after insert or update on public.alerta for each row execute function public.email_evento_alerta();

-- Uma reserva por chamada; trabalhadores concorrentes nao selecionam a mesma linha.
create or replace function public.email_reservar()
returns setof public.email_fila language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- Falha entre SMTP e confirmacao nao pode resultar em repeticao automatica.
  update public.email_fila set status = 'incerto', erro_codigo = 'RESERVA_EXPIRADA'
    where status = 'processando' and reservado_em < now() - interval '5 minutes';
  return query
  with proxima as (
    select id from public.email_fila where status = 'pendente' order by criado_em, id
    for update skip locked limit 1
  )
  update public.email_fila f set status = 'processando', reserva = gen_random_uuid(), reservado_em = now(), tentativas = tentativas + 1
  from proxima where f.id = proxima.id returning f.*;
end;
$$;

create or replace function public.email_finalizar(p_id uuid, p_reserva uuid, p_status text, p_erro text default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_quantidade integer;
begin
  if p_status not in ('enviado','falhou','incerto','descartado') then raise exception 'Status de email invalido'; end if;
  update public.email_fila set status = p_status,
    enviado_em = case when p_status = 'enviado' then now() else null end,
    erro_codigo = left(p_erro, 80)
    where id = p_id and reserva = p_reserva and status = 'processando';
  get diagnostics v_quantidade = row_count;
  return v_quantidade = 1;
end;
$$;

revoke all on function public.email_criar_evento(uuid,text,uuid,jsonb,uuid,text[]) from public,anon,authenticated;
revoke all on function public.email_evento_usuario() from public,anon,authenticated;
revoke all on function public.email_evento_relatorio() from public,anon,authenticated;
revoke all on function public.email_evento_alerta() from public,anon,authenticated;
revoke all on function public.email_reservar() from public,anon,authenticated;
revoke all on function public.email_finalizar(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.email_reservar() to service_role;
grant execute on function public.email_finalizar(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
