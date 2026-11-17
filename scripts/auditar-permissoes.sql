-- Somente leitura. Executar no SQL Editor para conferir a instalacao real.
-- Nao retorna dados de usuarios, senhas ou credenciais.
select n.nspname as esquema, p.proname as funcao,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_executa,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_executa,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_executa
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by p.proname;

select n.nspname as esquema, c.relname as objeto, c.relkind,
       c.relrowsecurity as rls, c.relforcerowsecurity as force_rls,
       c.reloptions as opcoes,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
order by c.relkind, c.relname;
