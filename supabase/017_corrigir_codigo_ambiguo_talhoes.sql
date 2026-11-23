begin;

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
  v_item jsonb;
  v_codigo text;
  v_nome_talhao text;
  v_area_hectares numeric;
  v_coordenadas jsonb;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_fazenda_id is null or jsonb_typeof(p_features) <> 'array' then
    return jsonb_build_object('erro', 'Dados de geometria invalidos.');
  end if;

  if not exists (select 1 from public.fazenda where id = p_fazenda_id) then
    return jsonb_build_object('erro', 'Fazenda nao encontrada.');
  end if;

  foreach v_codigo in array coalesce(p_removidos, '{}') loop
    if exists (
      select 1
        from public.talhao t
       where t.fazenda_id = p_fazenda_id
         and t.codigo = v_codigo
         and (
           exists (select 1 from public.ciclo_cultura c where c.talhao_id = t.id)
           or exists (select 1 from public.inspecao i where i.talhao_id = t.id)
           or exists (select 1 from public.ocorrencia o where o.talhao_id = t.id)
           or exists (select 1 from public.dispositivo d where d.talhao_id = t.id)
           or exists (select 1 from public.problema_sensor p where p.talhao_id = t.id)
           or exists (select 1 from public.alerta a where a.talhao_id = t.id)
         )
    ) then
      return jsonb_build_object('erro', format('O talhao %s possui historico ou sensores associados e nao pode ser removido.', v_codigo));
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_features) loop
    v_codigo := btrim(v_item #>> '{properties,codigo}');
    v_nome_talhao := coalesce(nullif(btrim(v_item #>> '{properties,nome}'), ''), v_codigo);
    v_area_hectares := coalesce(
      nullif(v_item #>> '{properties,area_hectares}', '')::numeric,
      nullif(replace(regexp_replace(coalesce(v_item #>> '{properties,area}', ''), '[^0-9,.]', '', 'g'), ',', '.'), '')::numeric
    );
    v_coordenadas := v_item #> '{geometry,coordinates,0}';

    if v_codigo is null or v_codigo = '' or length(v_codigo) > 40
       or v_area_hectares is null or v_area_hectares <= 0
       or v_coordenadas is null or jsonb_typeof(v_coordenadas) <> 'array' then
      return jsonb_build_object('erro', 'Codigo, area ou coordenadas de talhao invalidos.');
    end if;

    insert into public.talhao (fazenda_id, codigo, nome, area_hectares, coordenadas)
    values (p_fazenda_id, v_codigo, v_nome_talhao, v_area_hectares, v_coordenadas)
    on conflict (fazenda_id, codigo) do update
      set nome = excluded.nome,
          area_hectares = excluded.area_hectares,
          coordenadas = excluded.coordenadas,
          atualizado_em = now();
  end loop;

  if cardinality(coalesce(p_removidos, '{}')) > 0 then
    delete from public.talhao as t
     where t.fazenda_id = p_fazenda_id
       and t.codigo = any(p_removidos);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'codigo', t.codigo,
    'nome', t.nome,
    'area_hectares', t.area_hectares,
    'coordenadas', t.coordenadas
  ) order by t.codigo), '[]'::jsonb)
    into v_resultado
    from public.talhao as t
   where t.fazenda_id = p_fazenda_id;

  return v_resultado;
end;
$$;

revoke all on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) from public;
grant execute on function public.salvar_geometrias_talhoes(uuid, jsonb, text[]) to service_role;

notify pgrst, 'reload schema';

commit;
