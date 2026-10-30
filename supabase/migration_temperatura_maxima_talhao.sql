-- Executar uma vez no Supabase para persistir o limite definido pela Engenharia.
alter table public.talhao
  add column if not exists temperatura_maxima numeric(5,2)
  check (temperatura_maxima is null or (temperatura_maxima >= 0 and temperatura_maxima <= 100));
