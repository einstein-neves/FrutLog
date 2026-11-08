-- FrutLog | Copia controlada do modelo legado para o modelo operacional.
-- Execute depois de 003. Não remove as tabelas antigas.

begin;

-- Compatibilidade com a autenticação PBKDF2 da API atual. firebase_uid deixa
-- de ser obrigatório para contas locais; contas Firebase existentes continuam válidas.
alter table public.usuario add column if not exists senha_hash text;
alter table public.usuario add column if not exists cargo varchar(160);
alter table public.usuario alter column firebase_uid drop not null;

insert into public.organizacao (nome)
select 'FrutLog'
where not exists (select 1 from public.organizacao where nome = 'FrutLog');

-- Mantém o UUID do usuário legado, permitindo migrar referências futuras.
insert into public.usuario (id, organizacao_id, matricula, nome_completo, perfil, status, senha_hash, cargo)
select u.id,
       (select id from public.organizacao where nome = 'FrutLog' order by criado_em limit 1),
       u.matricula, u.nome,
       case u.perfil when 'admin' then 'administrador'::public.perfil_usuario else u.perfil::public.perfil_usuario end,
       case when u.ativo then 'ativo'::public.status_registro else 'inativo'::public.status_registro end,
       u.senha_hash, u.cargo
from public.usuarios u
on conflict (id) do update set
  nome_completo = excluded.nome_completo, senha_hash = excluded.senha_hash,
  cargo = excluded.cargo, status = excluded.status;

insert into public.fazenda (organizacao_id, nome, area_hectares)
select (select id from public.organizacao where nome = 'FrutLog' order by criado_em limit 1),
       'Fazenda FrutLog', 1
where not exists (select 1 from public.fazenda where nome = 'Fazenda FrutLog');

insert into public.cultura (nome_comum)
select distinct btrim(split_part(t.cultura, ' ', 1))
from public.talhoes t
where btrim(split_part(t.cultura, ' ', 1)) <> ''
on conflict (nome_comum) do nothing;

insert into public.cultivar (cultura_id, nome)
select c.id, t.cultura
from public.talhoes t
join public.cultura c on c.nome_comum = btrim(split_part(t.cultura, ' ', 1))
on conflict (cultura_id, nome) do nothing;

insert into public.talhao (fazenda_id, codigo, nome, area_hectares)
select (select id from public.fazenda where nome = 'Fazenda FrutLog' order by criado_em limit 1),
       t.id, 'Talhão ' || t.id,
       greatest(0.0001, replace(regexp_replace(t.area, '[^0-9,]', '', 'g'), ',', '.')::numeric)
from public.talhoes t
on conflict (fazenda_id, codigo) do nothing;

insert into public.ciclo_cultura (talhao_id, cultivar_id, plantado_em, area_plantada_hectares)
select p.id, cv.id, current_date, p.area_hectares
from public.talhao p
join public.talhoes legado on legado.id = p.codigo
join public.cultura c on c.nome_comum = btrim(split_part(legado.cultura, ' ', 1))
join public.cultivar cv on cv.cultura_id = c.id and cv.nome = legado.cultura
where not exists (select 1 from public.ciclo_cultura cc where cc.talhao_id = p.id and cc.status = 'ativo' and cc.encerrado_em is null);

insert into public.dispositivo (organizacao_id, talhao_id, id_externo, status, instalado_em)
select (select id from public.organizacao where nome = 'FrutLog' order by criado_em limit 1),
       p.id, d.id, 'online'::public.status_dispositivo, now()
from public.dispositivos_iot d
join public.talhao p on p.codigo = d.talhao
where d.ativo
on conflict (organizacao_id, id_externo) do nothing;

insert into public.sensor (dispositivo_id, id_externo, codigo_metrica, unidade)
select d.id, d.id_externo,
       case when d.id_externo like 'TEMP-%' then 'temperatura'
            when d.id_externo like 'CHUVA-%' then 'chuva'
            when d.id_externo like 'SOLO-%' then 'umidadeSolo'
            else 'generico' end,
       case when d.id_externo like 'TEMP-%' then 'C'
            when d.id_externo like 'CHUVA-%' then 'mm'
            when d.id_externo like 'SOLO-%' then '%'
            else 'unidade' end
from public.dispositivo d
on conflict (dispositivo_id, id_externo) do nothing;

commit;

-- Validação: as consultas abaixo devem retornar valores maiores que zero.
-- select count(*) from public.usuario;
-- select count(*) from public.talhao;
-- select count(*) from public.dispositivo;
-- select count(*) from public.sensor;
