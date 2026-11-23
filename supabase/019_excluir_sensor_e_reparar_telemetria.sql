begin;

alter table public.leitura_sensor
  drop constraint if exists leitura_sensor_sensor_id_fkey;

alter table public.leitura_sensor
  add constraint leitura_sensor_sensor_id_fkey
  foreign key (sensor_id)
  references public.sensor(id)
  on delete cascade;

drop view if exists public.v_telemetria_diaria_talhao;

create view public.v_telemetria_diaria_talhao as
select
  d.talhao_id,
  s.codigo_metrica,
  date_trunc('day', ls.coletado_em)::date as dia,
  round(avg(ls.valor)::numeric, 2) as valor_medio,
  min(ls.valor) as valor_minimo,
  max(ls.valor) as valor_maximo,
  count(*) as leituras_contabilizadas
from public.leitura_sensor ls
join public.sensor s on s.id = ls.sensor_id
join public.dispositivo d on d.id = ls.dispositivo_id
group by d.talhao_id, s.codigo_metrica, date_trunc('day', ls.coletado_em)::date;

grant select on public.v_telemetria_diaria_talhao to service_role;
grant select, insert, update, delete on public.leitura_sensor to service_role;

notify pgrst, 'reload schema';

commit;
