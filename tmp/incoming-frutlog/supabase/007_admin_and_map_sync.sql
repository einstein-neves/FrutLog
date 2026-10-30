begin;

alter table public.usuario
  add column if not exists senha_temporaria boolean not null default false;

create sequence if not exists public.usuario_matricula_seq;

do $$
declare
  proxima_matricula bigint;
begin
  select greatest(coalesce(max(matricula::bigint), 4000) + 1, 4001)
    into proxima_matricula
    from public.usuario
   where matricula ~ '^[0-9]{1,18}$';

  perform setval('public.usuario_matricula_seq', proxima_matricula, false);
end;
$$;

create or replace function public.proxima_matricula_funcionario()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select nextval('public.usuario_matricula_seq')::text;
$$;

revoke all on function public.proxima_matricula_funcionario() from public;
grant execute on function public.proxima_matricula_funcionario() to service_role;

create or replace function public.salvar_geometrias_talhoes(
  p_fazenda_id uuid,
  p_features jsonb,
  p_removidos text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  codigo text;
  nome_talhao text;
  area_hectares numeric;
  coordenadas jsonb;
  resultado jsonb := '[]'::jsonb;
begin
  if p_fazenda_id is null or jsonb_typeof(p_features) <> 'array' then
    return jsonb_build_object('erro', 'Dados de geometria invalidos.');
  end if;

  if not exists (select 1 from public.fazenda where id = p_fazenda_id) then
    return jsonb_build_object('erro', 'Fazenda nao encontrada.');
  end if;

  foreach codigo in array coalesce(p_removidos, '{}') loop
    if exists (
      select 1
        from public.talhao t
       where t.fazenda_id = p_fazenda_id
         and t.codigo = codigo
         and (
           exists (select 1 from public.ciclo_cultura c where c.talhao_id = t.id)
           or exists (select 1 from public.inspecao i where i.talhao_id = t.id)
           or exists (select 1 from public.ocorrencia o where o.talhao_id = t.id)
           or exists (select 1 from public.dispositivo d where d.talhao_id = t.id)
           or exists (select 1 from public.problema_sensor p where p.talhao_id = t.id)
           or exists (select 1 from public.alerta a where a.talhao_id = t.id)
         )
    ) then
      return jsonb_build_object('erro', format('O talhao %s possui historico ou sensores associados e nao pode ser removido.', codigo));
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_features) loop
    codigo := btrim(item #>> '{properties,codigo}');
    nome_talhao := coalesce(nullif(btrim(item #>> '{properties,nome}'), ''), codigo);
    area_hectares := coalesce(
      nullif(item #>> '{properties,area_hectares}', '')::numeric,
      nullif(replace(regexp_replace(coalesce(item #>> '{properties,area}', ''), '[^0-9,.]', '', 'g'), ',', '.'), '')::numeric
    );
    coordenadas := item #> '{geometry,coordinates,0}';

    if codigo is null or codigo = '' or length(codigo) > 40
       or area_hectares is null or area_hectares <= 0
       or coordenadas is null or jsonb_typeof(coordenadas) <> 'array' then
      return jsonb_build_object('erro', 'Codigo, area ou coordenadas de talhao invalidos.');
    end if;

    insert into public.talhao (fazenda_id, codigo, nome, area_hectares, coordenadas)
    values (p_fazenda_id, codigo, nome_talhao, area_hectares, coordenadas)
    on conflict (fazenda_id, codigo) do update
      set nome = excluded.nome,
          area_hectares = excluded.area_hectares,
          coordenadas = excluded.coordenadas,
          atualizado_em = now();
  end loop;

  if cardinality(coalesce(p_removidos, '{}')) > 0 then
    delete from public.talhao
     where fazenda_id = p_fazenda_id
       and codigo = any(p_removidos);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'codigo', codigo,
    'nome', nome,
    'area_hectares', area_hectares,
    'coordenadas', coordenadas
  ) order by codigo), '[]'::jsonb)
    into resultado
    from public.talhao
   where fazenda_id = p_fazenda_id;

  return resultado;
end;
$$;

revoke all on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) from public;
grant execute on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) to service_role;

notify pgrst, 'reload schema';

commit;
