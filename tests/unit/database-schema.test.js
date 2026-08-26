import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationPath = 'supabase/migrations/001_initial_schema.sql';
const tables = [
  'households',
  'household_members',
  'financial_categories',
  'financial_transactions',
  'shopping_lists',
  'shopping_items',
];

describe('migration inicial do banco', () => {
  it('cria todas as tabelas previstas no schema público', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of tables) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\s*\\(`));
    }
  });

  it('habilita RLS e nega acesso dos papéis do navegador', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of tables) {
      assert.match(
        sql,
        new RegExp(`alter table public\\.${table} enable row level security;`),
      );
      assert.match(
        sql,
        new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`),
      );
    }
  });

  it('protege a correspondência entre categoria, tipo e household', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(
      sql,
      /foreign key \(category_id, household_id, type\)\s+references public\.financial_categories\(id, household_id, type\)/,
    );
  });

  it('protege a correspondência entre lista e household', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(
      sql,
      /foreign key \(shopping_list_id, household_id\)\s+references public\.shopping_lists\(id, household_id\)/,
    );
  });

  it('mantém o estado de conclusão do item consistente', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /shopping_items_checked_state_consistent check/);
    assert.match(sql, /is_checked and checked_by is not null and checked_at is not null/);
    assert.match(sql, /not is_checked and checked_by is null and checked_at is null/);
  });

  it('cria atualização automática de updated_at', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /create or replace function private\.set_updated_at\(\)/);
    assert.match(sql, /create trigger financial_transactions_set_updated_at/);
    assert.match(sql, /create trigger shopping_items_set_updated_at/);
  });

  it('cria os índices principais de consulta', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const indexes = [
      'idx_household_members_user',
      'idx_financial_transactions_household_date',
      'idx_financial_transactions_category',
      'idx_shopping_lists_household',
      'idx_shopping_items_list',
      'idx_shopping_items_household_checked',
    ];

    for (const index of indexes) {
      assert.match(sql, new RegExp(`create index if not exists ${index}`));
    }
  });
});
