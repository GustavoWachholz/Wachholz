import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PublicConfigError,
  SUPABASE_MODULE_URL,
  assertSafeBrowserConfig,
  createSupabaseClient,
  initializeSupabaseClient,
} from '../../js/lib/supabase-client.js';

function createJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

describe('assertSafeBrowserConfig', () => {
  it('normaliza uma configuração pública válida', () => {
    assert.deepEqual(
      assertSafeBrowserConfig({
        supabaseUrl: 'https://example.supabase.co/',
        supabaseAnonKey: ' public-key ',
      }),
      {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'public-key',
      },
    );
  });

  it('rejeita a chave secreta moderna do Supabase', () => {
    assert.throws(
      () =>
        assertSafeBrowserConfig({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'sb_secret_example',
        }),
      PublicConfigError,
    );
  });

  it('rejeita JWT legado com papel service_role', () => {
    assert.throws(
      () =>
        assertSafeBrowserConfig({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: createJwt({ role: 'service_role' }),
        }),
      /chave administrativa/i,
    );
  });
});

describe('createSupabaseClient', () => {
  it('inicializa o SDK com sessão persistente e schema público', () => {
    const calls = [];
    const fakeClient = { name: 'supabase-client' };
    const createClient = (...args) => {
      calls.push(args);
      return fakeClient;
    };

    const client = createSupabaseClient({
      config: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'public-key',
      },
      createClient,
    });

    assert.equal(client, fakeClient);
    assert.deepEqual(calls, [
      [
        'https://example.supabase.co',
        'public-key',
        {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: false,
            persistSession: true,
          },
          db: { schema: 'public' },
        },
      ],
    ]);
  });

  it('falha quando o SDK não fornece createClient', () => {
    assert.throws(
      () =>
        createSupabaseClient({
          config: {
            supabaseUrl: 'https://example.supabase.co',
            supabaseAnonKey: 'public-key',
          },
          createClient: undefined,
        }),
      /createClient do Supabase não foi carregada/,
    );
  });
});

describe('initializeSupabaseClient', () => {
  it('carrega a versão fixada do SDK e cria o cliente', async () => {
    const importedUrls = [];
    const fakeClient = { connected: true };

    const client = await initializeSupabaseClient({
      config: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'public-key',
      },
      importModule: async (url) => {
        importedUrls.push(url);
        return { createClient: () => fakeClient };
      },
    });

    assert.equal(client, fakeClient);
    assert.deepEqual(importedUrls, [SUPABASE_MODULE_URL]);
    assert.match(SUPABASE_MODULE_URL, /@supabase\/supabase-js@2\.111\.0/);
  });

  it('rejeita credencial administrativa antes de carregar o SDK', async () => {
    let importCalled = false;

    await assert.rejects(
      initializeSupabaseClient({
        config: {
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'sb_secret_example',
        },
        importModule: async () => {
          importCalled = true;
          return { createClient: () => ({}) };
        },
      }),
      PublicConfigError,
    );

    assert.equal(importCalled, false);
  });
});
