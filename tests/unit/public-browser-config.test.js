import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../js/config.js';
import { assertSafeBrowserConfig } from '../../js/lib/supabase-client.js';

describe('configuração pública versionada', () => {
  it('mantém uma URL HTTPS e somente a chave publicável do projeto', () => {
    const config = assertSafeBrowserConfig({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });

    assert.equal(config.supabaseUrl, 'https://dejctaugwnvhlwmndfli.supabase.co');
    assert.match(config.supabaseAnonKey, /^sb_publishable_/);
    assert.doesNotMatch(config.supabaseAnonKey, /^sb_secret_/);
  });
});
