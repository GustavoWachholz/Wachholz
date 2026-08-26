import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationPath = 'supabase/migrations/003_shopping_items_realtime.sql';

describe('migration Realtime de compras', () => {
  it('publica shopping_items de forma idempotente', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /pg_catalog\.pg_publication_tables/i);
    assert.match(sql, /pubname\s*=\s*'supabase_realtime'/i);
    assert.match(sql, /alter publication supabase_realtime add table public\.shopping_items/i);
  });

  it('habilita identidade completa para filtrar exclusões', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    assert.match(sql, /alter table public\.shopping_items replica identity full/i);
  });
});
