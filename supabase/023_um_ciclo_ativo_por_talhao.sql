-- Garante no banco um unico ciclo ativo por talhao.
-- A migracao para sem alterar dados se encontrar ciclos ativos duplicados.
do $$
begin
  if exists (
    select 1
    from public.ciclo_cultura
    where status = 'ativo'
    group by talhao_id
    having count(*) > 1
  ) then
    raise exception 'Ha talhoes com mais de um ciclo ativo. Consulte diagnostico_instalacao.sql e resolva os dados antes da migracao.';
  end if;
end
$$;

create unique index if not exists ciclo_cultura_um_ativo_por_talhao_idx
  on public.ciclo_cultura (talhao_id)
  where status = 'ativo';