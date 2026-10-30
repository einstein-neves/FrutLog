-- Permite ocultar e restaurar relatórios sem excluir o conteúdo enviado pelo técnico.
alter table public.relatorio_campo_diario
  add column if not exists arquivado_em timestamptz;

create index if not exists relatorio_campo_diario_visiveis_idx
  on public.relatorio_campo_diario (data_relatorio desc, criado_em desc)
  where arquivado_em is null;
