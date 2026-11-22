-- Aplicar apos 031_totp_idor.sql.
begin;

alter table public.desafio_login_otp drop constraint if exists desafio_login_otp_modo_check;
alter table public.desafio_login_otp add constraint desafio_login_otp_modo_check
  check (modo in ('setup', 'login', 'reset'));

-- A troca do segredo e de todos os codigos ocorre na mesma transacao.
create or replace function public.substituir_autenticador(
  p_usuario_id uuid, p_senha_hash text, p_segredo_anterior text,
  p_novo_segredo text, p_passo bigint, p_codigos text[]
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_usuario public.usuario%rowtype;
begin
  select * into v_usuario from public.usuario where id = p_usuario_id for update;
  if not found then return false; end if;
  if v_usuario.status <> 'ativo'
     or v_usuario.senha_hash is distinct from p_senha_hash
     or v_usuario.totp_secret_ciphertext is distinct from p_segredo_anterior then
    return false;
  end if;
  if p_novo_segredo is null or p_passo is null or p_passo < 0
     or cardinality(p_codigos) is distinct from 10 then
    raise exception 'Configuracao do autenticador invalida';
  end if;
  update public.usuario set totp_secret_ciphertext = p_novo_segredo,
    totp_ativado_em = now(), totp_ultimo_passo = p_passo where id = p_usuario_id;
  delete from public.usuario_codigo_recuperacao where usuario_id = p_usuario_id;
  insert into public.usuario_codigo_recuperacao(usuario_id, codigo_hash)
    select p_usuario_id, codigo from unnest(p_codigos) as codigo;
  delete from public.desafio_login_otp where usuario_id = p_usuario_id;
  return true;
end;
$$;
revoke all on function public.substituir_autenticador(uuid,text,text,text,bigint,text[]) from public, anon, authenticated;
grant execute on function public.substituir_autenticador(uuid,text,text,text,bigint,text[]) to service_role;

notify pgrst, 'reload schema';
commit;
