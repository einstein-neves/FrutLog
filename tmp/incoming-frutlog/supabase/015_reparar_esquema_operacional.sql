begin;

alter table public.talhao
  add column if not exists coordenadas jsonb;

create table if not exists public.colheita (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid references public.organizacao(id) on delete cascade,
  fazenda_id uuid references public.fazenda(id) on delete cascade,
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  ciclo_cultura_id uuid references public.ciclo_cultura(id) on delete set null,
  produto text,
  colhido_em date not null default current_date,
  data_colheita date,
  quantidade numeric(12, 2) not null check (quantidade >= 0),
  unidade text not null default 't',
  ano integer,
  criado_em timestamptz not null default now()
);

alter table public.colheita
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists organizacao_id uuid references public.organizacao(id) on delete cascade,
  add column if not exists fazenda_id uuid references public.fazenda(id) on delete cascade,
  add column if not exists talhao_id uuid references public.talhao(id) on delete cascade,
  add column if not exists ciclo_cultura_id uuid references public.ciclo_cultura(id) on delete set null,
  add column if not exists produto text,
  add column if not exists colhido_em date,
  add column if not exists data_colheita date,
  add column if not exists quantidade numeric(12, 2),
  add column if not exists unidade text default 't',
  add column if not exists ano integer,
  add column if not exists criado_em timestamptz default now();

alter table public.colheita
  alter column unidade drop default;

alter table public.colheita
  alter column unidade type text using unidade::text,
  alter column unidade set default 't';

update public.colheita
   set data_colheita = coalesce(data_colheita, colhido_em, current_date),
       colhido_em = coalesce(colhido_em, data_colheita, current_date),
       ano = coalesce(ano, extract(year from coalesce(data_colheita, colhido_em, current_date))::integer),
       unidade = coalesce(unidade, 't'),
       criado_em = coalesce(criado_em, now());

alter table public.colheita
  alter column unidade set not null;

alter table public.colheita
  alter column id set default gen_random_uuid();

create unique index if not exists colheita_id_uidx
  on public.colheita (id);

update public.colheita c
   set fazenda_id = t.fazenda_id,
       organizacao_id = f.organizacao_id
  from public.talhao t
  join public.fazenda f on f.id = t.fazenda_id
 where c.talhao_id = t.id
   and (c.fazenda_id is null or c.organizacao_id is null);

update public.colheita c
   set produto = ciclo.produto,
       ciclo_cultura_id = ciclo.id
  from (
    select distinct on (cc.talhao_id)
      cc.talhao_id,
      cc.id,
      cu.nome_comum as produto
    from public.ciclo_cultura cc
    join public.cultivar cv on cv.id = cc.cultivar_id
    join public.cultura cu on cu.id = cv.cultura_id
    where cc.status = 'ativo'
    order by cc.talhao_id, cc.plantado_em desc
  ) ciclo
 where c.talhao_id = ciclo.talhao_id
   and c.produto is null;

create or replace function public.preencher_dados_colheita()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.data_colheita := coalesce(new.data_colheita, new.colhido_em, current_date);
  new.colhido_em := coalesce(new.colhido_em, new.data_colheita);
  new.ano := coalesce(new.ano, extract(year from new.data_colheita)::integer);
  new.unidade := coalesce(new.unidade, 't');

  if new.talhao_id is not null then
    select t.fazenda_id, f.organizacao_id
      into new.fazenda_id, new.organizacao_id
      from public.talhao t
      join public.fazenda f on f.id = t.fazenda_id
     where t.id = new.talhao_id;

    if new.produto is null then
      select cu.nome_comum, cc.id
        into new.produto, new.ciclo_cultura_id
        from public.ciclo_cultura cc
        join public.cultivar cv on cv.id = cc.cultivar_id
        join public.cultura cu on cu.id = cv.cultura_id
       where cc.talhao_id = new.talhao_id
         and cc.status = 'ativo'
       order by cc.plantado_em desc
       limit 1;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists colheita_preencher_dados on public.colheita;
create trigger colheita_preencher_dados
before insert or update on public.colheita
for each row execute function public.preencher_dados_colheita();

create index if not exists colheita_talhao_data_idx
  on public.colheita (talhao_id, data_colheita desc);

create table if not exists public.problema_sensor (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid references public.sensor(id) on delete set null,
  talhao_id uuid not null references public.talhao(id) on delete cascade,
  usuario_id uuid references public.usuario(id) on delete set null,
  data date not null default current_date,
  problema text not null,
  observacao text,
  criado_em timestamptz not null default now()
);

alter table public.problema_sensor
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists sensor_id uuid references public.sensor(id) on delete set null,
  add column if not exists talhao_id uuid references public.talhao(id) on delete cascade,
  add column if not exists usuario_id uuid references public.usuario(id) on delete set null,
  add column if not exists data date default current_date,
  add column if not exists problema text,
  add column if not exists observacao text,
  add column if not exists criado_em timestamptz default now();

update public.problema_sensor
   set data = coalesce(data, current_date),
       problema = coalesce(problema, 'Problema nao informado'),
       criado_em = coalesce(criado_em, now());

alter table public.problema_sensor
  alter column id set default gen_random_uuid();

create unique index if not exists problema_sensor_id_uidx
  on public.problema_sensor (id);

create index if not exists problema_sensor_talhao_data_idx
  on public.problema_sensor (talhao_id, data desc);

grant usage on schema public to service_role;
grant select, insert, update, delete on public.colheita, public.problema_sensor to service_role;
revoke all on function public.preencher_dados_colheita() from public;
alter table public.colheita enable row level security;
alter table public.problema_sensor enable row level security;

notify pgrst, 'reload schema';

commit;
