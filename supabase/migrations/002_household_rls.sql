begin;

create schema if not exists private;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

create or replace function private.prevent_protected_column_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  column_name text;
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
begin
  foreach column_name in array tg_argv loop
    if old_row -> column_name is distinct from new_row -> column_name then
      raise exception 'protected column cannot be changed: %', column_name
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.prevent_protected_column_changes() from public, anon, authenticated;
grant execute on function private.prevent_protected_column_changes() to authenticated;

drop trigger if exists financial_categories_protect_ownership
on public.financial_categories;
create trigger financial_categories_protect_ownership
before update on public.financial_categories
for each row execute function private.prevent_protected_column_changes('household_id');

drop trigger if exists financial_transactions_protect_ownership
on public.financial_transactions;
create trigger financial_transactions_protect_ownership
before update on public.financial_transactions
for each row execute function private.prevent_protected_column_changes('household_id', 'created_by');

drop trigger if exists shopping_lists_protect_ownership
on public.shopping_lists;
create trigger shopping_lists_protect_ownership
before update on public.shopping_lists
for each row execute function private.prevent_protected_column_changes('household_id', 'created_by');

drop trigger if exists shopping_items_protect_ownership
on public.shopping_items;
create trigger shopping_items_protect_ownership
before update on public.shopping_items
for each row execute function private.prevent_protected_column_changes(
  'household_id',
  'shopping_list_id',
  'created_by'
);

create or replace function private.set_shopping_item_check_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.is_checked then
    new.checked_by := current_user_id;
    new.checked_at := now();
  elsif tg_op = 'UPDATE' and new.is_checked is distinct from old.is_checked then
    if new.is_checked then
      new.checked_by := current_user_id;
      new.checked_at := now();
    else
      new.checked_by := null;
      new.checked_at := null;
    end if;
  elsif tg_op = 'UPDATE' and (
    new.checked_by is distinct from old.checked_by
    or new.checked_at is distinct from old.checked_at
  ) then
    raise exception 'check metadata can only change with is_checked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.set_shopping_item_check_metadata() from public, anon, authenticated;
grant execute on function private.set_shopping_item_check_metadata() to authenticated;

-- Trigger functions are invoker-safe and cannot be called as ordinary functions.
-- Granting EXECUTE keeps their runtime permissions explicit for authenticated writes.
revoke all on function private.set_updated_at() from public, anon;
grant execute on function private.set_updated_at() to authenticated;

drop trigger if exists shopping_items_set_check_metadata
on public.shopping_items;
create trigger shopping_items_set_check_metadata
before insert or update on public.shopping_items
for each row execute function private.set_shopping_item_check_metadata();

drop policy if exists households_select_member on public.households;
create policy households_select_member
on public.households
for select
to authenticated
using (private.is_household_member(id));

drop policy if exists household_members_select_member on public.household_members;
create policy household_members_select_member
on public.household_members
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists financial_categories_select_member on public.financial_categories;
create policy financial_categories_select_member
on public.financial_categories
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists financial_categories_insert_member on public.financial_categories;
create policy financial_categories_insert_member
on public.financial_categories
for insert
to authenticated
with check (private.is_household_member(household_id));

drop policy if exists financial_categories_update_member on public.financial_categories;
create policy financial_categories_update_member
on public.financial_categories
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists financial_categories_delete_member on public.financial_categories;
create policy financial_categories_delete_member
on public.financial_categories
for delete
to authenticated
using (private.is_household_member(household_id));

drop policy if exists financial_transactions_select_member on public.financial_transactions;
create policy financial_transactions_select_member
on public.financial_transactions
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists financial_transactions_insert_member on public.financial_transactions;
create policy financial_transactions_insert_member
on public.financial_transactions
for insert
to authenticated
with check (
  private.is_household_member(household_id)
  and created_by = (select auth.uid())
);

drop policy if exists financial_transactions_update_member on public.financial_transactions;
create policy financial_transactions_update_member
on public.financial_transactions
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists financial_transactions_delete_member on public.financial_transactions;
create policy financial_transactions_delete_member
on public.financial_transactions
for delete
to authenticated
using (private.is_household_member(household_id));

drop policy if exists shopping_lists_select_member on public.shopping_lists;
create policy shopping_lists_select_member
on public.shopping_lists
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists shopping_lists_insert_member on public.shopping_lists;
create policy shopping_lists_insert_member
on public.shopping_lists
for insert
to authenticated
with check (
  private.is_household_member(household_id)
  and created_by = (select auth.uid())
);

drop policy if exists shopping_lists_update_member on public.shopping_lists;
create policy shopping_lists_update_member
on public.shopping_lists
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists shopping_lists_delete_member on public.shopping_lists;
create policy shopping_lists_delete_member
on public.shopping_lists
for delete
to authenticated
using (private.is_household_member(household_id));

drop policy if exists shopping_items_select_member on public.shopping_items;
create policy shopping_items_select_member
on public.shopping_items
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists shopping_items_insert_member on public.shopping_items;
create policy shopping_items_insert_member
on public.shopping_items
for insert
to authenticated
with check (
  private.is_household_member(household_id)
  and created_by = (select auth.uid())
);

drop policy if exists shopping_items_update_member on public.shopping_items;
create policy shopping_items_update_member
on public.shopping_items
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists shopping_items_delete_member on public.shopping_items;
create policy shopping_items_delete_member
on public.shopping_items
for delete
to authenticated
using (private.is_household_member(household_id));

revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;
revoke all on table public.financial_categories from anon, authenticated;
revoke all on table public.financial_transactions from anon, authenticated;
revoke all on table public.shopping_lists from anon, authenticated;
revoke all on table public.shopping_items from anon, authenticated;

grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select, insert, update, delete on table public.financial_categories to authenticated;
grant select, insert, update, delete on table public.financial_transactions to authenticated;
grant select, insert, update, delete on table public.shopping_lists to authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;

commit;
