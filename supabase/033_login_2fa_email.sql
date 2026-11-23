-- Aplicar apos 032_recuperacao_autenticador.sql.
begin;
alter table public.usuario add column if not exists email varchar(254);
alter table public.desafio_login_otp drop constraint if exists desafio_login_otp_modo_check;
alter table public.desafio_login_otp add constraint desafio_login_otp_modo_check
  check (modo in ('setup', 'login', 'reset', 'email'));
notify pgrst, 'reload schema';
commit;
