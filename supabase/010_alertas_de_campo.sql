begin;

create or replace function public.registrar_ocorrencia_com_alerta(
  p_talhao_id uuid,
  p_usuario_id uuid,
  p_talhao_codigo text,
  p_tipo text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ocorrencia_criada public.ocorrencia;
  alerta_criado public.alerta;
  severidade_alerta public.severidade_alerta;
begin
  if p_talhao_id is null or p_usuario_id is null
     or length(btrim(coalesce(p_tipo, ''))) = 0 then
    raise exception 'Dados de ocorrencia invalidos.';
  end if;

  insert into public.ocorrencia (talhao_id, usuario_id, tipo, observacao)
  values (p_talhao_id, p_usuario_id, btrim(p_tipo), nullif(btrim(p_observacao), ''))
  returning * into ocorrencia_criada;

  severidade_alerta := case
    when lower(p_tipo) like '%praga%'
      or lower(p_tipo) like '%doenca%'
      or lower(p_tipo) like '%sensor%'
      or lower(p_tipo) like '%agua%'
      then 'alta'::public.severidade_alerta
    else 'media'::public.severidade_alerta
  end;

  insert into public.alerta (talhao_id, severidade, status, titulo, mensagem)
  values (
    p_talhao_id,
    severidade_alerta,
    'aberto',
    left('Ocorrencia de campo: ' || btrim(p_tipo), 255),
    'Talhao ' || btrim(p_talhao_codigo) || ': ' ||
      coalesce(nullif(btrim(p_observacao), ''), btrim(p_tipo))
  )
  returning * into alerta_criado;

  return jsonb_build_object('ocorrencia', to_jsonb(ocorrencia_criada), 'alerta', to_jsonb(alerta_criado));
end;
$$;

create or replace function public.registrar_problema_sensor_com_alerta(
  p_sensor_id uuid,
  p_talhao_id uuid,
  p_usuario_id uuid,
  p_talhao_codigo text,
  p_sensor_codigo text,
  p_data date,
  p_problema text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  problema_criado public.problema_sensor;
  alerta_criado public.alerta;
begin
  if p_sensor_id is null or p_talhao_id is null or p_usuario_id is null
     or p_data is null or length(btrim(coalesce(p_problema, ''))) = 0 then
    raise exception 'Dados de problema de sensor invalidos.';
  end if;
  if not exists (
    select 1
    from public.sensor s
    join public.dispositivo d on d.id = s.dispositivo_id
    where s.id = p_sensor_id and d.talhao_id = p_talhao_id
  ) then
    raise exception 'O sensor nao pertence ao talhao informado.';
  end if;

  insert into public.problema_sensor
    (sensor_id, talhao_id, usuario_id, data, problema, observacao)
  values
    (p_sensor_id, p_talhao_id, p_usuario_id, p_data, btrim(p_problema), nullif(btrim(p_observacao), ''))
  returning * into problema_criado;

  insert into public.alerta (sensor_id, talhao_id, severidade, status, titulo, mensagem)
  values (
    p_sensor_id,
    p_talhao_id,
    'alta',
    'aberto',
    left('Problema no sensor ' || btrim(p_sensor_codigo), 255),
    'Talhao ' || btrim(p_talhao_codigo) || ': ' ||
      coalesce(nullif(btrim(p_observacao), ''), btrim(p_problema))
  )
  returning * into alerta_criado;

  return jsonb_build_object('problema', to_jsonb(problema_criado), 'alerta', to_jsonb(alerta_criado));
end;
$$;

revoke all on function public.registrar_ocorrencia_com_alerta(uuid, uuid, text, text, text) from public;
revoke all on function public.registrar_problema_sensor_com_alerta(uuid, uuid, uuid, text, text, date, text, text) from public;
grant execute on function public.registrar_ocorrencia_com_alerta(uuid, uuid, text, text, text) to service_role;
grant execute on function public.registrar_problema_sensor_com_alerta(uuid, uuid, uuid, text, text, date, text, text) to service_role;

commit;
