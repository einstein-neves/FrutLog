-- =========================================================
-- 027 - Verificacao das colunas esperadas pelo front e pela API
-- =========================================================
-- Por que este arquivo existe:
-- O erro "column colheita.status does not exist" que aparecia ao clicar em
-- "Arquivar colheita" NAO era falta de coluna no banco. Era a rota
-- PATCH /admin/historico-operacao/:tipo/:id pedindo as MESMAS colunas
-- (id,talhao_id,status,arquivado_em) para talhao, ciclo_cultura e colheita.
-- Como talhao nao tem status nem talhao_id, e colheita nao tem status, o
-- PostgREST respondia 400. A correcao esta em api/[...route].js, nao aqui.
--
-- NAO adicione uma coluna "status" em colheita: ela nao existe no esquema
-- oficial, o front nunca a le e a API monta esse texto em memoria
-- (status: "colheita registrada"). Criar a coluna so geraria campo morto.
--
-- O que este script faz:
-- Garante, de forma idempotente, que as tabelas usadas pelo painel tenham as
-- colunas, chaves e indices que a API consulta. Serve para ambientes que
-- divergiram do schema_oficial_atualizado.sql. Rodar varias vezes e seguro:
-- nada e sobrescrito e nenhum dado e apagado.
--
-- Como rodar: SQL Editor do Supabase, ou
--   psql "$SUPABASE_DB_URL" -f supabase/027_verificar_colunas_esperadas_pelo_front.sql
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Talhao: arquivamento e carimbos de tempo usados no historico.
--    ATENCAO: o codigo e unico POR FAZENDA. Um talhao arquivado continua
--    ocupando o codigo, por isso o editor de mapa pula codigos arquivados.
-- ---------------------------------------------------------
alter table public.talhao
  add column if not exists arquivado_em timestamptz,
  add column if not exists criado_em    timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists coordenadas  jsonb,
  add column if not exists nome         varchar(255) not null default '';

alter table public.talhao
  add column if not exists temperatura_maxima numeric(5,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'talhao_temperatura_maxima_faixa'
  ) then
    alter table public.talhao
      add constraint talhao_temperatura_maxima_faixa
      check (temperatura_maxima is null or (temperatura_maxima >= 0 and temperatura_maxima <= 100));
  end if;
end $$;

-- ---------------------------------------------------------
-- 2. Ciclo de cultura: aqui o status EXISTE e e usado pela regra
--    "encerre o ciclo antes de arquivar".
-- ---------------------------------------------------------
alter table public.ciclo_cultura
  add column if not exists status        varchar(40) not null default 'ativo',
  add column if not exists solo          varchar(120) not null default '',
  add column if not exists encerrado_em  date,
  add column if not exists arquivado_em  timestamptz,
  add column if not exists criado_em     timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now();

-- ---------------------------------------------------------
-- 3. Colheita: sem coluna de status, de proposito (ver nota do topo).
-- ---------------------------------------------------------
alter table public.colheita
  add column if not exists arquivado_em timestamptz,
  add column if not exists criado_em    timestamptz not null default now(),
  add column if not exists ano          integer;

-- Preenche o ano das colheitas antigas a partir da data de colheita.
update public.colheita
   set ano = extract(year from colhido_em)::int
 where ano is null
   and colhido_em is not null;

-- ---------------------------------------------------------
-- 4. Usuario, sensor e dispositivo: colunas lidas pelas telas de
--    Funcionarios e Sensores.
-- ---------------------------------------------------------
alter table public.usuario
  add column if not exists status    varchar(20) not null default 'ativo',
  add column if not exists cargo     varchar(120) not null default '',
  add column if not exists profissao varchar(120) not null default '',
  add column if not exists criado_em timestamptz not null default now();

alter table public.sensor
  add column if not exists status  varchar(20) not null default 'ativo',
  add column if not exists unidade varchar(20) not null default '';

alter table public.dispositivo
  add column if not exists status          varchar(20) not null default 'ativo',
  add column if not exists ultimo_sinal_em timestamptz;

alter table public.relatorio_campo_diario
  add column if not exists status        varchar(20) not null default 'enviado',
  add column if not exists arquivado_em  timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();

-- ---------------------------------------------------------
-- 5. Indices dos filtros mais usados pela API.
--    Todos os listamentos do painel filtram por arquivado_em is null.
-- ---------------------------------------------------------
create index if not exists idx_talhao_fazenda_ativo
  on public.talhao (fazenda_id) where arquivado_em is null;

create index if not exists idx_ciclo_cultura_talhao
  on public.ciclo_cultura (talhao_id, plantado_em desc);

create index if not exists idx_colheita_talhao
  on public.colheita (talhao_id, colhido_em desc);

create index if not exists idx_colheita_ciclo
  on public.colheita (ciclo_cultura_id);

create index if not exists idx_relatorio_data
  on public.relatorio_campo_diario (data_relatorio desc, criado_em desc);

-- ---------------------------------------------------------
-- 6. Relatorio final: lista no console o que ainda estiver faltando.
--    Se nada for impresso, o banco bate com o que a API espera.
-- ---------------------------------------------------------
do $$
declare
  v_esperado text[][] := array[
    ['talhao','id'],['talhao','codigo'],['talhao','fazenda_id'],['talhao','area_hectares'],
    ['talhao','coordenadas'],['talhao','arquivado_em'],['talhao','criado_em'],
    ['ciclo_cultura','id'],['ciclo_cultura','talhao_id'],['ciclo_cultura','cultivar_id'],
    ['ciclo_cultura','status'],['ciclo_cultura','arquivado_em'],['ciclo_cultura','encerrado_em'],
    ['colheita','id'],['colheita','talhao_id'],['colheita','ciclo_cultura_id'],
    ['colheita','colhido_em'],['colheita','quantidade'],['colheita','unidade'],
    ['colheita','ano'],['colheita','arquivado_em'],
    ['usuario','id'],['usuario','matricula'],['usuario','nome_completo'],['usuario','perfil'],['usuario','status'],
    ['sensor','id'],['sensor','id_externo'],['sensor','dispositivo_id'],['sensor','codigo_metrica'],['sensor','status'],
    ['dispositivo','id'],['dispositivo','id_externo'],['dispositivo','talhao_id'],['dispositivo','status']
  ];
  v_tabela text;
  v_coluna text;
  v_faltando int := 0;
  i int;
begin
  for i in 1 .. array_length(v_esperado, 1) loop
    v_tabela := v_esperado[i][1];
    v_coluna := v_esperado[i][2];
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = v_tabela and column_name = v_coluna
    ) then
      raise warning 'FALTANDO: %.%', v_tabela, v_coluna;
      v_faltando := v_faltando + 1;
    end if;
  end loop;

  if v_faltando = 0 then
    raise notice 'Esquema conferido: todas as colunas esperadas pela API existem.';
  else
    raise warning 'Esquema conferido: % coluna(s) ausente(s). Veja os avisos acima.', v_faltando;
  end if;
end $$;

-- Pede ao PostgREST para reler o esquema; sem isso a API continua usando o
-- cache antigo e colunas recem-criadas respondem 400.
notify pgrst, 'reload schema';

commit;
