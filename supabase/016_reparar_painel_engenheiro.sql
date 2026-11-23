begin;

alter table public.ciclo_cultura
  add column if not exists previsao_colheita date;

create table if not exists public.relatorio_campo_diario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuario(id) on delete set null,
  tecnico_nome varchar(255) not null,
  data_relatorio date not null,
  conteudo text not null
    constraint relatorio_conteudo_nao_vazio
    check (length(btrim(conteudo)) > 0 and length(conteudo) <= 6000),
  status varchar(20) not null default 'enviado'
    constraint relatorio_status_valido
    check (status in ('enviado', 'em_analise', 'concluido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint relatorio_unico_por_tecnico_dia unique (usuario_id, data_relatorio)
);

create index if not exists relatorio_campo_diario_data_idx
  on public.relatorio_campo_diario (data_relatorio desc, criado_em desc);

alter table public.relatorio_campo_diario enable row level security;
grant select, insert, update, delete on public.relatorio_campo_diario to service_role;

notify pgrst, 'reload schema';

commit;
