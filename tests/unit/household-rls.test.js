import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationPath = 'supabase/migrations/002_household_rls.sql';
const moduleTables = [
  'financial_categories',
  'financial_transactions',
  'shopping_lists',
  'shopping_items',
];

describe('políticas RLS por household', () => {
  it('usa helper privado com search_path fixado', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /function private\.is_household_member\(target_household_id uuid\)/);
    assert.match(sql, /security definer\s+set search_path = ''/);
    assert.match(sql, /member\.user_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /revoke all on function private\.is_household_member\(uuid\) from public, anon/);
  });

  it('restringe todas as policies ao papel authenticated', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? [];

    assert.equal(policies.length, 18);
    for (const policy of policies) {
      assert.match(policy, /to authenticated/);
      assert.doesNotMatch(policy, /for all/);
    }
  });

  it('permite somente leitura de households e memberships', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /grant select on table public\.households to authenticated/);
    assert.match(sql, /grant select on table public\.household_members to authenticated/);
    assert.doesNotMatch(sql, /grant select, insert[^;]*public\.households/);
    assert.doesNotMatch(sql, /grant select, insert[^;]*public\.household_members/);
  });

  it('cria policies explícitas de CRUD para as tabelas dos módulos', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of moduleTables) {
      for (const operation of ['select', 'insert', 'update', 'delete']) {
        assert.match(sql, new RegExp(`create policy ${table}_${operation}_member`));
      }
    }
  });

  it('exige created_by igual ao usuário atual nos inserts', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of ['financial_transactions', 'shopping_lists', 'shopping_items']) {
      const policy = sql.match(
        new RegExp(`create policy ${table}_insert_member[\\s\\S]*?;`),
      )?.[0];
      assert.match(policy, /created_by = \(select auth\.uid\(\)\)/);
    }
  });

  it('impede alterar household, autoria e lista por update manipulado', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /financial_categories_protect_ownership/);
    assert.match(sql, /financial_transactions_protect_ownership/);
    assert.match(sql, /shopping_lists_protect_ownership/);
    assert.match(sql, /shopping_items_protect_ownership/);
    assert.match(sql, /'household_id',\s+'shopping_list_id',\s+'created_by'/);
  });

  it('atribui checked_by e checked_at no banco', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /new\.checked_by := current_user_id/);
    assert.match(sql, /new\.checked_at := now\(\)/);
    assert.match(sql, /new\.checked_by := null/);
    assert.match(sql, /new\.checked_at := null/);
  });

  it('concede somente ao usuário autenticado a execução das funções de trigger', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const triggerFunctions = [
      'prevent_protected_column_changes',
      'set_shopping_item_check_metadata',
      'set_updated_at',
    ];

    for (const functionName of triggerFunctions) {
      assert.match(
        sql,
        new RegExp(`revoke all on function private\\.${functionName}\\(\\) from public, anon`),
      );
      assert.match(
        sql,
        new RegExp(`grant execute on function private\\.${functionName}\\(\\) to authenticated`),
      );
    }
  });

  it('mantém anon sem privilégios nas seis tabelas', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const tables = ['households', 'household_members', ...moduleTables];

    for (const table of tables) {
      assert.match(
        sql,
        new RegExp(`revoke all on table public\\.${table} from anon, authenticated`),
      );
    }
  });
});
