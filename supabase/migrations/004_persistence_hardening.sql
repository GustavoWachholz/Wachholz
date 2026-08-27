begin;

-- Mantém no banco os mesmos limites já aplicados pelos formulários.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'households_name_length'
      and conrelid = 'public.households'::regclass
  ) then
    alter table public.households
      add constraint households_name_length
      check (char_length(btrim(name)) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_categories_name_length'
      and conrelid = 'public.financial_categories'::regclass
  ) then
    alter table public.financial_categories
      add constraint financial_categories_name_length
      check (char_length(btrim(name)) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_transactions_description_length'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_description_length
      check (char_length(btrim(description)) <= 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_transactions_notes_length'
      and conrelid = 'public.financial_transactions'::regclass
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_notes_length
      check (notes is null or char_length(notes) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_lists_name_length'
      and conrelid = 'public.shopping_lists'::regclass
  ) then
    alter table public.shopping_lists
      add constraint shopping_lists_name_length
      check (char_length(btrim(name)) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_items_name_length'
      and conrelid = 'public.shopping_items'::regclass
  ) then
    alter table public.shopping_items
      add constraint shopping_items_name_length
      check (char_length(btrim(name)) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_items_unit_length'
      and conrelid = 'public.shopping_items'::regclass
  ) then
    alter table public.shopping_items
      add constraint shopping_items_unit_length
      check (unit is null or char_length(unit) <= 30);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_items_notes_length'
      and conrelid = 'public.shopping_items'::regclass
  ) then
    alter table public.shopping_items
      add constraint shopping_items_notes_length
      check (notes is null or char_length(notes) <= 500);
  end if;
end;
$$;

-- PostgreSQL não cria índices automaticamente para chaves estrangeiras.
create index if not exists idx_financial_transactions_category_scope
on public.financial_transactions(category_id, household_id, type);

create index if not exists idx_financial_transactions_created_by
on public.financial_transactions(created_by);

create index if not exists idx_shopping_lists_created_by
on public.shopping_lists(created_by);

create index if not exists idx_shopping_items_list_scope
on public.shopping_items(shopping_list_id, household_id);

create index if not exists idx_shopping_items_created_by
on public.shopping_items(created_by);

create index if not exists idx_shopping_items_checked_by
on public.shopping_items(checked_by);

commit;
