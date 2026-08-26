import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePublicConfig } from '../../js/lib/public-config.js';

describe('validatePublicConfig', () => {
  it('aceita URL HTTPS e chave pública preenchida', () => {
    const result = validatePublicConfig({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-anon-key',
    });

    assert.deepEqual(result, { isValid: true, errors: [] });
  });

  it('rejeita configuração ausente', () => {
    const result = validatePublicConfig(null);

    assert.equal(result.isValid, false);
    assert.deepEqual(result.errors, ['Configuração pública ausente.']);
  });

  it('rejeita URL insegura e chave vazia', () => {
    const result = validatePublicConfig({
      supabaseUrl: 'http://example.supabase.co',
      supabaseAnonKey: '  ',
    });

    assert.equal(result.isValid, false);
    assert.deepEqual(result.errors, [
      'SUPABASE_URL deve ser uma URL HTTPS válida.',
      'SUPABASE_ANON_KEY deve ser informada.',
    ]);
  });

  it('permite localhost durante o desenvolvimento', () => {
    const result = validatePublicConfig({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'local-anon-key',
    });

    assert.equal(result.isValid, true);
  });
});
