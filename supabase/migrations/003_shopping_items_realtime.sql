begin;

-- DELETE só pode ser filtrado pelo shopping_list_id quando a identidade antiga
-- da linha faz parte da replicação lógica.
alter table public.shopping_items replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_items'
  ) then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
end;
$$;

commit;
