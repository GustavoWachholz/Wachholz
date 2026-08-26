import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHashRouter } from '../../js/router/hash-router.js';

function createWindowDouble(hash = '') {
  const listeners = new Map();

  return {
    location: { hash },
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      listeners.get(type)?.forEach((listener) => listener());
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe('createHashRouter', () => {
  it('emite a rota atual ao iniciar', () => {
    const windowTarget = createWindowDouble('#/compras');
    const results = [];
    const router = createHashRouter({
      windowTarget,
      onRouteChange: (route) => results.push(route),
    });

    router.start();

    assert.equal(results.length, 1);
    assert.equal(results[0].route.id, 'shopping');
    assert.equal(windowTarget.listenerCount('hashchange'), 1);
  });

  it('observa mudanças de hash sem duplicar o listener', () => {
    const windowTarget = createWindowDouble('#/dashboard');
    const paths = [];
    const router = createHashRouter({
      windowTarget,
      onRouteChange: ({ path }) => paths.push(path),
    });

    router.start();
    router.start();
    windowTarget.location.hash = '#/financeiro';
    windowTarget.dispatch('hashchange');

    assert.equal(windowTarget.listenerCount('hashchange'), 1);
    assert.deepEqual(paths, ['/dashboard', '/dashboard', '/financeiro']);
  });

  it('remove a observação ao parar', () => {
    const windowTarget = createWindowDouble();
    const router = createHashRouter({ windowTarget });

    router.start();
    router.stop();

    assert.equal(windowTarget.listenerCount('hashchange'), 0);
  });

  it('rejeita janela incompatível', () => {
    assert.throws(
      () => createHashRouter({ windowTarget: {} }),
      /janela compatível é obrigatória/i,
    );
  });
});
