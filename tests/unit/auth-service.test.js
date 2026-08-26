import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AuthFlowError,
  createAuthService,
  normalizeAuthError,
  validateLoginCredentials,
} from '../../js/auth/auth-service.js';

function createClient(overrides = {}) {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      ...overrides,
    },
  };
}

describe('validateLoginCredentials', () => {
  it('normaliza o e-mail sem alterar a senha', () => {
    assert.deepEqual(
      validateLoginCredentials({
        email: '  pessoa@example.com  ',
        password: ' senha com espaços ',
      }),
      {
        email: 'pessoa@example.com',
        password: ' senha com espaços ',
      },
    );
  });

  it('rejeita e-mail inválido', () => {
    assert.throws(
      () => validateLoginCredentials({ email: 'email-invalido', password: 'senha' }),
      (error) => error instanceof AuthFlowError && error.code === 'invalid_email',
    );
  });

  it('rejeita senha vazia', () => {
    assert.throws(
      () => validateLoginCredentials({ email: 'pessoa@example.com', password: '' }),
      (error) => error instanceof AuthFlowError && error.code === 'password_required',
    );
  });
});

describe('normalizeAuthError', () => {
  it('não revela se a conta existe', () => {
    const invalidCredentials = normalizeAuthError({ code: 'invalid_credentials' });
    const missingUser = normalizeAuthError({ code: 'user_not_found' });

    assert.equal(invalidCredentials.message, 'E-mail ou senha inválidos.');
    assert.equal(missingUser.message, invalidCredentials.message);
  });

  it('converte erro desconhecido em mensagem genérica', () => {
    const error = normalizeAuthError({ code: 'unexpected', message: 'internal details' });

    assert.equal(error.message, 'Não foi possível entrar. Tente novamente.');
    assert.doesNotMatch(error.message, /internal details/);
  });
});

describe('createAuthService', () => {
  it('recupera a sessão persistida', async () => {
    const session = { user: { id: 'user-1' } };
    const service = createAuthService(
      createClient({
        getSession: async () => ({ data: { session }, error: null }),
      }),
    );

    assert.equal(await service.getSession(), session);
  });

  it('entra com e-mail e senha validados', async () => {
    const calls = [];
    const session = { user: { id: 'user-1' } };
    const service = createAuthService(
      createClient({
        signInWithPassword: async (credentials) => {
          calls.push(credentials);
          return { data: { session }, error: null };
        },
      }),
    );

    assert.equal(
      await service.signIn({ email: ' pessoa@example.com ', password: 'senha' }),
      session,
    );
    assert.deepEqual(calls, [{ email: 'pessoa@example.com', password: 'senha' }]);
  });

  it('encerra apenas a sessão deste dispositivo', async () => {
    const calls = [];
    const service = createAuthService(
      createClient({
        signOut: async (options) => {
          calls.push(options);
          return { error: null };
        },
      }),
    );

    await service.signOut();

    assert.deepEqual(calls, [{ scope: 'local' }]);
  });

  it('observa eventos e permite cancelar a subscription', () => {
    let listener;
    let unsubscribeCount = 0;
    const events = [];
    const service = createAuthService(
      createClient({
        onAuthStateChange: (callback) => {
          listener = callback;
          return {
            data: {
              subscription: {
                unsubscribe() {
                  unsubscribeCount += 1;
                },
              },
            },
          };
        },
      }),
    );

    const unsubscribe = service.onAuthStateChange((event) => events.push(event));
    listener('SIGNED_IN', { user: { id: 'user-1' } });
    unsubscribe();

    assert.deepEqual(events, [
      { event: 'SIGNED_IN', session: { user: { id: 'user-1' } } },
    ]);
    assert.equal(unsubscribeCount, 1);
  });

  it('rejeita cliente Auth incompleto', () => {
    assert.throws(() => createAuthService({ auth: {} }), /Supabase Auth está incompleto/);
  });
});
