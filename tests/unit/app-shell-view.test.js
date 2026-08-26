import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveProtectedRoute } from '../../js/router/app-routes.js';
import { getAppShellMarkup } from '../../js/shell/app-shell-view.js';

const readyAccess = {
  sessionStatus: 'authenticated',
  householdStatus: 'ready',
};

function createState(hash, overrides = {}) {
  return {
    routeState: resolveProtectedRoute(hash, readyAccess),
    household: { name: 'Casa Wachholz' },
    user: { email: 'pessoa@example.com' },
    error: null,
    sessionError: null,
    ...overrides,
  };
}

describe('getAppShellMarkup', () => {
  it('renderiza navegação inferior e sidebar com as quatro rotas', () => {
    const markup = getAppShellMarkup(createState('#/dashboard'));

    assert.match(markup, /app-nav--bottom/);
    assert.match(markup, /app-nav--sidebar/);
    assert.match(markup, /data-skip-content/);
    assert.doesNotMatch(markup, /href="#route-content"/);
    for (const path of ['/dashboard', '/financeiro', '/compras', '/configuracoes']) {
      assert.ok(markup.split(`href="#${path}"`).length - 1 >= 2);
    }
  });

  it('marca a rota ativa nas duas navegações', () => {
    const markup = getAppShellMarkup(createState('#/compras'));

    assert.equal(markup.split('aria-current="page"').length - 1, 2);
    assert.match(markup, /<h1[^>]*id="route-heading">Compras<\/h1>/);
  });

  it('mantém compras ativa ao abrir uma lista pela rota detalhada', () => {
    const listId = '33333333-3333-4333-8333-333333333333';
    const markup = getAppShellMarkup(createState(`#/compras/${listId}`, {
      shoppingState: {
        status: 'ready',
        lists: [{ id: listId, name: 'Feira', pendingItems: 1 }],
      },
    }));

    assert.equal(markup.split('aria-current="page"').length - 1, 2);
    assert.match(markup, /<h1 id="route-heading">Feira<\/h1>/);
    assert.match(markup, /1 item pendente/);
  });

  it('renderiza a fundação financeira na rota correspondente', () => {
    const markup = getAppShellMarkup(createState('#/financeiro', {
      financeState: {
        status: 'ready',
        period: { year: 2026, month: 8 },
        categoryType: 'expense',
        categories: [],
      },
    }));

    assert.match(markup, /<h1 id="route-heading">Financeiro<\/h1>/);
    assert.match(markup, /datetime="2026-08"/);
    assert.match(markup, /data-finance-category-type/);
  });

  it('escapa dados vindos da conta e da household', () => {
    const markup = getAppShellMarkup(createState('#/configuracoes', {
      household: { name: '<img src=x onerror=alert(1)>' },
      user: { email: '<script>ruim</script>@example.com' },
    }));

    assert.doesNotMatch(markup, /<script>|<img/);
    assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(markup, /&lt;script&gt;ruim&lt;\/script&gt;@example\.com/);
  });

  it('renderiza loading global acessível', () => {
    const state = createState('#/dashboard', {
      routeState: resolveProtectedRoute('#/dashboard', {
        sessionStatus: 'authenticated',
        householdStatus: 'loading',
      }),
      household: null,
    });
    const markup = getAppShellMarkup(state);

    assert.match(markup, /role="status"/);
    assert.match(markup, /Carregando sua casa/);
  });

  it('renderiza erro global com nova tentativa sem expor HTML', () => {
    const state = createState('#/dashboard', {
      routeState: resolveProtectedRoute('#/dashboard', {
        sessionStatus: 'authenticated',
        householdStatus: 'error',
      }),
      error: new Error('<b>falha</b>'),
    });
    const markup = getAppShellMarkup(state);

    assert.match(markup, /data-feedback-action/);
    assert.match(markup, /&lt;b&gt;falha&lt;\/b&gt;/);
    assert.doesNotMatch(markup, /<b>falha<\/b>/);
  });

  it('renderiza rota inexistente com retorno ao dashboard', () => {
    const markup = getAppShellMarkup(createState('#/nao-existe'));

    assert.match(markup, /Esta página não existe/);
    assert.match(markup, /href="#\/dashboard"/);
  });
});
