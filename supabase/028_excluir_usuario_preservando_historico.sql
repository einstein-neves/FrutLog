-- =========================================================================
-- FrutLog - 028: permitir excluir usuario sem apagar o historico dele
-- =========================================================================
--
-- PROBLEMA
-- --------
-- Excluir um funcionario na tela Funcionarios devolve:
--
--   update or delete on table "usuario" violates foreign key constraint
--   "colheita_registrado_por_fkey" on table "colheita"
--   Key (id)=(dc446bca-...) is still referenced from table "colheita"
--
-- Ou seja: quem ja registrou uma colheita, fez uma inspecao ou abriu uma
-- ocorrencia nunca mais pode ser excluido. Demitir alguem deixa de ser uma
-- operacao possivel no sistema, o que esta errado do ponto de vista de quem
-- administra a propriedade.
--
-- POR QUE ISSO ACONTECE
-- ---------------------
-- O banco publicado foi criado com as chaves estrangeiras no padrao do
-- Postgres (NO ACTION), que BLOQUEIA a exclusao. Mas o supabase/schema.sql
-- deste repositorio ja declara `on delete set null` nas seis referencias a
-- usuario (linhas 142, 195, 208, 220, 263 e 270). Quem esta fora da linha e
-- o banco, nao o codigo: esta migration apenas alinha os dois.
--
-- O QUE MUDA NA PRATICA
-- ---------------------
-- Excluir um funcionario passa a funcionar. O registro que ele criou NAO e
-- apagado -- apenas perde o vinculo com a pessoa:
--
--   antes:  colheita de 10 sc  |  registrado por: Joao
--   depois: colheita de 10 sc  |  registrado por: (vazio)
--
-- A colheita, a inspecao e a ocorrencia continuam existindo, com data,
-- quantidade e talhao intactos. O que se perde e a autoria.
--
-- SE ISSO NAO FOR DESEJADO, O CAMINHO E OUTRO
-- -------------------------------------------
-- Para demitir alguem mantendo o nome no historico, use o botao Desativar
-- em vez de Excluir: o usuario perde o acesso ao sistema e continua
-- assinando o que ja fez. As duas opcoes passam a conviver depois desta
-- migration -- a escolha fica com quem administra, que e o certo.
--
-- ATENCAO A evento_auditoria
-- --------------------------
-- Essa tabela e o registro de auditoria do sistema. Com `on delete set null`
-- um evento passa a poder ficar sem autor quando o usuario e excluido, o que
-- enfraquece a auditoria. Esta migration segue o que o schema.sql ja declara,
-- mas se a auditoria precisar ser a prova de exclusao, a linha dela deve
-- ficar de fora (basta comentar o bloco 6) e a exclusao de quem tem evento
-- registrado continuara bloqueada de proposito.
--
-- SEGURANCA DA OPERACAO
-- ---------------------
-- Nenhuma linha de dado e lida, alterada ou apagada aqui. A migration so
-- troca a REGRA de uma chave estrangeira. E idempotente: rodar duas vezes
-- da o mesmo resultado.
-- =========================================================================

begin;

-- 1. ciclo_cultura.usuario_id  (quem cadastrou o plantio)
alter table public.ciclo_cultura
  drop constraint if exists ciclo_cultura_usuario_id_fkey;
alter table public.ciclo_cultura
  add constraint ciclo_cultura_usuario_id_fkey
  foreign key (usuario_id) references public.usuario(id) on delete set null;

-- 2. inspecao.usuario_id  (o tecnico que inspecionou)
alter table public.inspecao
  drop constraint if exists inspecao_usuario_id_fkey;
alter table public.inspecao
  add constraint inspecao_usuario_id_fkey
  foreign key (usuario_id) references public.usuario(id) on delete set null;

-- 3. ocorrencia.usuario_id  (quem registrou a ocorrencia em campo)
alter table public.ocorrencia
  drop constraint if exists ocorrencia_usuario_id_fkey;
alter table public.ocorrencia
  add constraint ocorrencia_usuario_id_fkey
  foreign key (usuario_id) references public.usuario(id) on delete set null;

-- 4. problema_sensor.usuario_id  (quem apontou o defeito no sensor)
alter table public.problema_sensor
  drop constraint if exists problema_sensor_usuario_id_fkey;
alter table public.problema_sensor
  add constraint problema_sensor_usuario_id_fkey
  foreign key (usuario_id) references public.usuario(id) on delete set null;

-- 5. colheita.registrado_por  (foi esta que apareceu no erro da tela)
alter table public.colheita
  drop constraint if exists colheita_registrado_por_fkey;
alter table public.colheita
  add constraint colheita_registrado_por_fkey
  foreign key (registrado_por) references public.usuario(id) on delete set null;

-- 6. evento_auditoria.usuario_id  (ver ATENCAO no cabecalho antes de aplicar)
alter table public.evento_auditoria
  drop constraint if exists evento_auditoria_usuario_id_fkey;
alter table public.evento_auditoria
  add constraint evento_auditoria_usuario_id_fkey
  foreign key (usuario_id) references public.usuario(id) on delete set null;

commit;

-- =========================================================================
-- CONFERENCIA (rode depois; deve listar as seis com delete_rule = SET NULL)
-- =========================================================================
-- select tc.table_name, kcu.column_name, rc.delete_rule
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_name = tc.constraint_name
-- join information_schema.referential_constraints rc
--   on rc.constraint_name = tc.constraint_name
-- where tc.constraint_type = 'FOREIGN KEY'
--   and tc.constraint_name in (
--     'ciclo_cultura_usuario_id_fkey', 'inspecao_usuario_id_fkey',
--     'ocorrencia_usuario_id_fkey', 'problema_sensor_usuario_id_fkey',
--     'colheita_registrado_por_fkey', 'evento_auditoria_usuario_id_fkey'
--   )
-- order by tc.table_name;
