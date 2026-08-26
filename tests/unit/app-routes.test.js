import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APP_ROUTES,
  getDocumentTitle,
  normalizeHash,
  resolveProtectedRoute,
  resolveRoute,
} from '../../js/router/app-routes.js';

describe('normalizeHash', () => {
  it('usa dashboard para hash vazio ou raiz', () => {
    assert.equal(normalizeHash(''), '/dashboard');
    assert.equal(normalizeHash('#/'), '/dashboard');
  });

  it('normaliza prefixo, barras repetidas, query e barra final', () => {
    assert.equal(normalizeHash('#compras/'), '/compras');
    assert.equal(normalizeHash('#//financeiro///?mes=8'), '/financeiro');
  });

  it('aceita URL completa e decodifica o fragmento', () => {
    assert.equal(
      normalizeHash('https://example.test/#/%63onfiguracoes'),
      '/configuracoes',
    );
  });

  it('transforma codificação inválida em rota inexistente segura', () => {
    assert.equal(normalizeHash('#/%E0%A4%A'), '/rota-invalida');
  });
});

describe('resolveRoute', () => {
  it('resolve as quatro rotas do shell', () => {
    assert.deepEqual(
      APP_ROUTES.map((route) => resolveRoute(`#${route.path}`).route?.id),
      ['dashboard', 'finance', 'shopping', 'settings'],
    );
  });

  it('preserva o caminho de uma rota inexistente', () => {
    const result = resolveRoute('#/nao-existe');

    assert.equal(result.status, 'not-found');
    assert.equal(result.path, '/nao-existe');
    assert.equal(result.route, null);
  });

  it('resolve lista de compras por UUID e mantém compras ativa na navegação', () => {
    const listId = '33333333-3333-4333-8333-333333333333';
    const result = resolveRoute(`#/compras/${listId}`);

    assert.equal(result.status, 'matched');
    assert.equal(result.route.id, 'shopping-list');
    assert.equal(result.route.navigationId, 'shopping');
    assert.equal(result.params.listId, listId);
  });

  it('rejeita identificador de lista inválido na rota', () => {
    assert.equal(resolveRoute('#/compras/lista-invalida').status, 'not-found');
  });
});

describe('resolveProtectedRoute', () => {
  it('mantém a rota protegida durante a recuperação da sessão', () => {
    const result = resolveProtectedRoute('#/compras', {
      sessionStatus: 'loading',
      householdStatus: 'idle',
    });

    assert.equal(result.status, 'loading');
  });

  it('exige login para qualquer estado não autenticado', () => {
    for (const sessionStatus of ['unauthenticated', 'authenticating', 'error']) {
      const result = resolveProtectedRoute('#/financeiro', {
        sessionStatus,
        householdStatus: 'idle',
      });
      assert.equal(result.status, 'login');
    }
  });

  it('aguarda a household antes de liberar a rota', () => {
    const result = resolveProtectedRoute('#/dashboard', {
      sessionStatus: 'authenticated',
      householdStatus: 'loading',
    });

    assert.equal(result.status, 'loading');
  });

  it('propaga erro de household para o estado global', () => {
    const result = resolveProtectedRoute('#/dashboard', {
      sessionStatus: 'authenticated',
      householdStatus: 'error',
    });

    assert.equal(result.status, 'error');
  });

  it('libera rota conhecida e mantém rota inexistente após autenticação', () => {
    const access = {
      sessionStatus: 'authenticated',
      householdStatus: 'ready',
    };

    assert.equal(resolveProtectedRoute('#/compras', access).status, 'ready');
    assert.equal(resolveProtectedRoute('#/desconhecida', access).status, 'not-found');
  });
});

describe('getDocumentTitle', () => {
  it('gera título específico apenas para rotas conhecidas', () => {
    assert.equal(
      getDocumentTitle(resolveRoute('#/financeiro')),
      'Financeiro · Nossa Casa',
    );
    assert.equal(getDocumentTitle(resolveRoute('#/inexistente')), 'Nossa Casa');
  });
});
