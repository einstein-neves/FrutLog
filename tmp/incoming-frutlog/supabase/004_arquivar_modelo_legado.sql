-- FrutLog | Arquivamento reversível das tabelas legadas
-- Execute SOMENTE depois de a API ser adaptada, testada e aprovada contra o
-- modelo operacional singular (usuario, talhao, dispositivo, sensor etc.).
-- Não execute agora: a API atual ainda usa as tabelas abaixo.

begin;
create schema if not exists legado_frutlog;

do $$
declare item text;
begin
  foreach item in array array[
    'plantios','problemas_sensor','ocorrencias','inspecoes','telemetrias',
    'sensores','dispositivos_iot','usuarios','talhoes'
  ] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=item and c.relkind='r')
      and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='legado_frutlog' and c.relname=item) then
      execute format('alter table public.%I set schema legado_frutlog', item);
    end if;
  end loop;
end $$;
commit;

-- Para reverter antes de remover a API legada, troque os schemas no sentido
-- contrário. Nenhum dado é apagado por este script.
