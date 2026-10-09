begin;

alter table public.ciclo_cultura
  add column if not exists usuario_id uuid references public.usuario(id) on delete set null;

alter table public.colheita
  add column if not exists ciclo_cultura_id uuid references public.ciclo_cultura(id) on delete set null;

do $$
declare
  v_coluna text;
begin
  foreach v_coluna in array array['crop_cycle_id', 'ciclo_cultura_id'] loop
    if exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'colheita'
         and column_name = v_coluna
         and is_nullable = 'NO'
    ) then
      execute format('alter table public.colheita alter column %I drop not null', v_coluna);
    end if;
  end loop;
end;
$$;

alter table public.inspecao
  add column if not exists sensor_id uuid references public.sensor(id) on delete set null;

grant select, insert, update, delete on public.ciclo_cultura to service_role;
grant select, insert, update, delete on public.colheita to service_role;
grant select, insert, update, delete on public.inspecao to service_role;

notify pgrst, 'reload schema';

commit;
