import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bindFinanceView,
  getFinanceMarkup,
} from '../../js/modules/finance/finance-view.js';

const PERIOD = Object.freeze({ year: 2026, month: 8 });

describe('getFinanceMarkup', () => {
  it('renderiza seletor mensal acessível e tipos financeiros', () => {
    const markup = getFinanceMarkup({
      status: 'ready',
      period: PERIOD,
      categoryType: 'expense',
      categories: [],
    });

    assert.match(markup, /datetime="2026-08">Agosto de 2026/);
    assert.match(markup, /data-finance-previous-month/);
    assert.match(markup, /aria-label="Mês anterior"/);
    assert.match(markup, /data-finance-next-month/);
    assert.match(markup, /data-finance-category-type="income"/);
    assert.match(markup, /data-finance-category-type="expense"[\s\S]*?aria-pressed="true"/);
  });

  it('exibe loading, erro com nova tentativa e estado vazio', () => {
    const loading = getFinanceMarkup({
      status: 'loading', period: PERIOD, categoryType: 'expense', categories: [],
    });
    const error = getFinanceMarkup({
      status: 'error',
      period: PERIOD,
      categoryType: 'expense',
      categories: [],
      error: new Error('Falha temporária'),
    });
    const empty = getFinanceMarkup({
      status: 'ready', period: PERIOD, categoryType: 'income', categories: [],
    });

    assert.match(loading, /Carregando categorias/);
    assert.match(loading, /data-finance-previous-month[^>]*disabled/);
    assert.match(error, /role="alert"/);
    assert.match(error, /data-feedback-action/);
    assert.match(empty, /Nenhuma categoria de receitas/);
  });

  it('lista somente nomes escapados das categorias recebidas', () => {
    const markup = getFinanceMarkup({
      status: 'ready',
      period: PERIOD,
      categoryType: 'expense',
      categories: [{ name: '<script>Alimentação</script>' }],
    });

    assert.match(markup, /&lt;script&gt;Alimentação&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script>/);
    assert.match(markup, /aria-label="Categorias de despesas"/);
  });
});

describe('bindFinanceView', () => {
  it('conecta navegação, tipo e nova tentativa aos controles nativos', () => {
    function element(dataset = {}) {
      return {
        dataset,
        addEventListener(type, listener) {
          this.listeners ??= {};
          this.listeners[type] = listener;
        },
      };
    }

    const previous = element();
    const next = element();
    const retry = element();
    const income = element({ financeCategoryType: 'income' });
    const expense = element({ financeCategoryType: 'expense' });
    const root = {
      querySelector(selector) {
        return new Map([
          ['[data-finance-previous-month]', previous],
          ['[data-finance-next-month]', next],
          ['.finance-categories-panel [data-feedback-action]', retry],
        ]).get(selector) ?? null;
      },
      querySelectorAll(selector) {
        return selector === '[data-finance-category-type]' ? [income, expense] : [];
      },
    };
    const calls = [];

    bindFinanceView(root, {
      onPreviousMonth: () => calls.push('previous'),
      onNextMonth: () => calls.push('next'),
      onCategoryTypeChange: (type) => calls.push(type),
      onRetry: () => calls.push('retry'),
    });
    previous.listeners.click();
    next.listeners.click();
    income.listeners.click();
    retry.listeners.click();

    assert.deepEqual(calls, ['previous', 'next', 'income', 'retry']);
  });
});
