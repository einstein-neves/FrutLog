-- Execute schema.sql e as migracoes antes deste script.
-- Gere um hash compativel com a API usando:
--   npm.cmd run password-hash -- "senha-temporaria-de-8-a-10"
-- Substitua o valor abaixo pelo hash impresso. Nunca grave a senha em texto puro.
begin;

alter table public.usuario
  add column if not exists senha_temporaria boolean not null default false,
  add column if not exists profissao varchar(160) not null default '';

do $$
declare
  v_senha_hash_admin text := '12345678';
  v_organizacao_id uuid;
begin
  if to_regclass('public.organizacao') is null or to_regclass('public.usuario') is null then
    raise exception 'Execute supabase/schema.sql antes de reparar o administrador.';
  end if;

  if v_senha_hash_admin !~ '^pbkdf2\$210000\$[a-f0-9]{32}\$[a-f0-9]{64}$' then
    raise exception 'Substitua o hash de exemplo por um hash PBKDF2 valido gerado pelo projeto.';
  end if;

  select id
    into v_organizacao_id
    from public.organizacao
   order by criado_em
   limit 1;

  if v_organizacao_id is null then
    insert into public.organizacao (nome)
    values ('FrutLog')
    returning id into v_organizacao_id;
  end if;

  if not exists (
    select 1
      from public.fazenda
     where public.fazenda.organizacao_id = v_organizacao_id
  ) then
    insert into public.fazenda (organizacao_id, nome)
    values (v_organizacao_id, 'Fazenda Principal');
  end if;

  insert into public.usuario (
    organizacao_id,
    matricula,
    nome_completo,
    cargo,
    perfil,
    status,
    senha_hash,
    senha_temporaria
  )
  values (
    v_organizacao_id,
    'admin',
    'Administrador Master',
    'Administrador Master',
    'administrador',
    'ativo',
    v_senha_hash_admin,
    true
  )
  on conflict (matricula) do update
    set nome_completo = excluded.nome_completo,
        cargo = excluded.cargo,
        perfil = excluded.perfil,
        status = excluded.status,
        senha_hash = excluded.senha_hash,
        senha_temporaria = true;
end;
$$;

notify pgrst, 'reload schema';

commit;
