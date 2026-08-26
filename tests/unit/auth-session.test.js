import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthFlowError } from '../../js/auth/auth-service.js';
import { createSessionController } from '../../js/auth/session.js';

function createAuthService(overrides = {}) {
  return {
    getSession: async () => null,
    login: async () => null,
    logout: async () => {},
    onAuthStateChange: () => () => {},
    signIn: async () => null,
    signOut: async () => {},
    ...overrides,
  };
}

describe('createSessionController', () => {
  it('recupera uma sessão autenticada ao iniciar', async () => {
    const session = { user: { id: 'user-1', email: 'pessoa@example.com' } };
    const states = [];
    const controller = createSessionController({
      authService: createAuthService({ getSession: async () => session }),
      onStateChange: (state) => states.push(state.status),
    });

    await controller.start();

    assert.equal(controller.getState().status, 'authenticated');
    assert.equal(controller.getState().user.email, 'pessoa@example.com');
    assert.deepEqual(states, ['loading', 'authenticated']);
  });

  it('fica desautenticado quando não existe sessão persistida', async () => {
    const controller = createSessionController({ authService: createAuthService() });

    await controller.start();

    assert.equal(controller.getState().status, 'unauthenticated');
    assert.equal(controller.getState().session, null);
  });

  it('processa login bem-sucedido', async () => {
    const session = { user: { id: 'user-1' } };
    const states = [];
    const controller = createSessionController({
      authService: createAuthService({ signIn: async () => session }),
      onStateChange: (state) => states.push(state.status),
    });

    await controller.login({ email: 'pessoa@example.com', password: 'senha' });

    assert.equal(controller.getState().status, 'authenticated');
    assert.deepEqual(states, ['authenticating', 'authenticated']);
  });

  it('retorna ao formulário com mensagem quando o login falha', async () => {
    const error = new AuthFlowError({ code: 'invalid_credentials' });
    const controller = createSessionController({
      authService: createAuthService({
        signIn: async () => {
          throw error;
        },
      }),
    });

    await controller.login({ email: 'pessoa@example.com', password: 'errada' });

    assert.equal(controller.getState().status, 'unauthenticated');
    assert.equal(controller.getState().error, error);
  });

  it('acompanha eventos de entrada e saída', async () => {
    let listener;
    const controller = createSessionController({
      authService: createAuthService({
        onAuthStateChange: (callback) => {
          listener = callback;
          return () => {};
        },
      }),
    });

    await controller.start();
    listener({ event: 'SIGNED_IN', session: { user: { id: 'user-1' } } });
    assert.equal(controller.getState().status, 'authenticated');

    listener({ event: 'SIGNED_OUT', session: null });
    assert.equal(controller.getState().status, 'unauthenticated');
  });

  it('não sobrescreve evento recente com recuperação antiga', async () => {
    let listener;
    let resolveSession;
    const recoveredSession = new Promise((resolve) => {
      resolveSession = resolve;
    });
    const currentSession = { user: { id: 'current-user' } };
    const controller = createSessionController({
      authService: createAuthService({
        getSession: () => recoveredSession,
        onAuthStateChange: (callback) => {
          listener = callback;
          return () => {};
        },
      }),
    });

    const startPromise = controller.start();
    listener({ event: 'SIGNED_IN', session: currentSession });
    resolveSession(null);
    await startPromise;

    assert.equal(controller.getState().session, currentSession);
  });

  it('mantém a sessão e mostra erro quando logout falha', async () => {
    const session = { user: { id: 'user-1' } };
    const error = new AuthFlowError({ code: 'unexpected' });
    const controller = createSessionController({
      authService: createAuthService({
        getSession: async () => session,
        signOut: async () => {
          throw error;
        },
      }),
    });

    await controller.start();
    await controller.logout();

    assert.equal(controller.getState().status, 'authenticated');
    assert.equal(controller.getState().session, session);
    assert.equal(controller.getState().error, error);
  });

  it('cancela a observação ao parar', async () => {
    let unsubscribeCount = 0;
    const controller = createSessionController({
      authService: createAuthService({
        onAuthStateChange: () => () => {
          unsubscribeCount += 1;
        },
      }),
    });

    await controller.start();
    controller.stop();

    assert.equal(unsubscribeCount, 1);
  });
});
