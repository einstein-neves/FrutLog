begin;

alter table public.colheita
  add column if not exists registrado_por uuid references public.usuario(id) on delete set null;

grant select, insert, update, delete on public.colheita to service_role;

notify pgrst, 'reload schema';

commit;
