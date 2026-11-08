-- Adds reversible archive markers without deleting historical records.
alter table public.talhao
  add column if not exists arquivado_em timestamptz;

alter table public.ciclo_cultura
  add column if not exists arquivado_em timestamptz;

alter table public.colheita
  add column if not exists arquivado_em timestamptz;

create index if not exists talhao_ativos_fazenda_idx
  on public.talhao (fazenda_id, codigo)
  where arquivado_em is null;

create index if not exists ciclo_ativos_talhao_idx
  on public.ciclo_cultura (talhao_id, plantado_em desc)
  where arquivado_em is null;

create index if not exists colheita_ativas_ciclo_idx
  on public.colheita (ciclo_cultura_id, colhido_em desc)
  where arquivado_em is null;
