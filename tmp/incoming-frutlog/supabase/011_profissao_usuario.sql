begin;

alter table public.usuario
  add column if not exists profissao varchar(160) not null default '';

commit;
