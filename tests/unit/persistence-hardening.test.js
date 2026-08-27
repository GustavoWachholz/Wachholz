import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

const migrationPath = 'supabase/migrations/004_persistence_hardening.sql';

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  }));

  return nested.flat();
}

describe('hardening da persistência Supabase', () => {
  it('repete no PostgreSQL os limites textuais dos formulários', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const constraints = [
      'households_name_length',
      'financial_categories_name_length',
      'financial_transactions_description_length',
      'financial_transactions_notes_length',
      'shopping_lists_name_length',
      'shopping_items_name_length',
      'shopping_items_unit_length',
      'shopping_items_notes_length',
    ];

    for (const constraint of constraints) {
      assert.match(sql, new RegExp(`add constraint ${constraint}`));
    }
  });

  it('indexa todas as chaves estrangeiras indicadas pelo advisor', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const indexes = [
      'idx_financial_transactions_category_scope',
      'idx_financial_transactions_created_by',
      'idx_shopping_lists_created_by',
      'idx_shopping_items_list_scope',
      'idx_shopping_items_created_by',
      'idx_shopping_items_checked_by',
    ];

    for (const index of indexes) {
      assert.match(sql, new RegExp(`create index if not exists ${index}`));
    }
  });

  it('não mantém persistência de negócio nas APIs locais do navegador', async () => {
    const files = await listJavaScriptFiles('js');

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(
        source,
        /\b(?:localStorage|sessionStorage|indexedDB)\b/,
        `${file} não deve persistir dados de negócio localmente`,
      );
    }
  });
});
