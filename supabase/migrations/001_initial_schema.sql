begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint households_name_not_blank check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null constraint financial_categories_name_not_blank check (btrim(name) <> ''),
  type text not null constraint financial_categories_type_valid
    check (type in ('income', 'expense')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint financial_categories_identity_type_key unique (id, household_id, type)
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null,
  created_by uuid not null references auth.users(id),
  type text not null constraint financial_transactions_type_valid
    check (type in ('income', 'expense')),
  description text not null constraint financial_transactions_description_not_blank
    check (btrim(description) <> ''),
  amount numeric(14,2) not null constraint financial_transactions_amount_positive
    check (amount > 0),
  transaction_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_category_matches
    foreign key (category_id, household_id, type)
    references public.financial_categories(id, household_id, type)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null constraint shopping_lists_name_not_blank check (btrim(name) <> ''),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint shopping_lists_identity_household_key unique (id, household_id)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null constraint shopping_items_name_not_blank check (btrim(name) <> ''),
  quantity numeric(10,2) constraint shopping_items_quantity_positive
    check (quantity is null or quantity > 0),
  unit text,
  notes text,
  is_checked boolean not null default false,
  created_by uuid not null references auth.users(id),
  checked_by uuid references auth.users(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_items_list_matches_household
    foreign key (shopping_list_id, household_id)
    references public.shopping_lists(id, household_id)
    on delete cascade,
  constraint shopping_items_checked_state_consistent check (
    (is_checked and checked_by is not null and checked_at is not null)
    or
    (not is_checked and checked_by is null and checked_at is null)
  )
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists financial_transactions_set_updated_at
on public.financial_transactions;

create trigger financial_transactions_set_updated_at
before update on public.financial_transactions
for each row execute function private.set_updated_at();

drop trigger if exists shopping_items_set_updated_at
on public.shopping_items;

create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row execute function private.set_updated_at();

create index if not exists idx_household_members_user
on public.household_members(user_id);

create index if not exists idx_financial_categories_household_type_active
on public.financial_categories(household_id, type, is_active);

create index if not exists idx_financial_transactions_household_date
on public.financial_transactions(household_id, transaction_date);

create index if not exists idx_financial_transactions_category
on public.financial_transactions(category_id);

create index if not exists idx_shopping_lists_household
on public.shopping_lists(household_id);

create index if not exists idx_shopping_items_list
on public.shopping_items(shopping_list_id);

create index if not exists idx_shopping_items_household_checked
on public.shopping_items(household_id, is_checked);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;
revoke all on table public.financial_categories from anon, authenticated;
revoke all on table public.financial_transactions from anon, authenticated;
revoke all on table public.shopping_lists from anon, authenticated;
revoke all on table public.shopping_items from anon, authenticated;

commit;
