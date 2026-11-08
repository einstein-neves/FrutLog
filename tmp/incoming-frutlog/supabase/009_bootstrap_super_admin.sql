begin;

create or replace function public.provisionar_super_admin_inicial(
  p_nome_organizacao text,
  p_nome_fazenda text,
  p_senha_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organizacao_id uuid;
  fazenda_id uuid;
  usuario_id uuid;
begin
  if length(btrim(coalesce(p_nome_organizacao, ''))) = 0
     or length(btrim(coalesce(p_nome_fazenda, ''))) = 0
     or coalesce(p_senha_hash, '') !~ '^pbkdf2\$[0-9]+\$[a-f0-9]{32,64}\$[a-f0-9]{64}$' then
    raise exception 'Dados de provisionamento invalidos.';
  end if;

  lock table public.usuario in exclusive mode;
  if exists (select 1 from public.usuario) then
    raise exception 'Ja existem usuarios; o bootstrap inicial foi desabilitado.';
  end if;

  insert into public.organizacao (nome)
  values (btrim(p_nome_organizacao))
  returning id into organizacao_id;

  insert into public.fazenda (organizacao_id, nome)
  values (organizacao_id, btrim(p_nome_fazenda))
  returning id into fazenda_id;

  insert into public.usuario
    (organizacao_id, matricula, nome_completo, cargo, perfil, status, senha_hash, senha_temporaria)
  values
    (organizacao_id, 'admin', 'Administrador Master', 'Administrador Master',
     'administrador', 'ativo', p_senha_hash, true)
  returning id into usuario_id;

  return jsonb_build_object(
    'organizacao_id', organizacao_id,
    'fazenda_id', fazenda_id,
    'usuario_id', usuario_id,
    'matricula', 'admin'
  );
end;
$$;

revoke all on function public.provisionar_super_admin_inicial(text, text, text) from public;
grant execute on function public.provisionar_super_admin_inicial(text, text, text) to service_role;

commit;
