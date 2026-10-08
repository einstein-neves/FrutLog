-- Corrige instalacoes em que a conta admin foi criada sem aplicar as migracoes
-- que adicionam os campos utilizados pelo login e pelo cadastro de funcionarios.
begin;

alter table public.usuario
  add column if not exists senha_temporaria boolean not null default false,
  add column if not exists profissao varchar(160) not null default '';

notify pgrst, 'reload schema';

commit;
