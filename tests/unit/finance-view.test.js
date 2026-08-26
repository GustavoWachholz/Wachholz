import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindFinanceView, getFinanceMarkup } from '../../js/modules/finance/finance-view.js';

const PERIOD = Object.freeze({ year: 2026, month: 8 });
const CATEGORY = Object.freeze({
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Alimentação',
  type: 'expense',
});

function state(overrides = {}) {
  return {
    status: 'ready',
    period: PERIOD,
    categoryType: 'expense',
    categories: [CATEGORY],
    transactions: [],
    summary: {
      incomeCents: 0, expenseCents: 0, balanceCents: 0, transactionCount: 0,
    },
    error: null,
    formError: null,
    isSubmitting: false,
    notice: null,
    isCategoryLoading: false,
    categoryError: null,
    ...overrides,
  };
}

describe('getFinanceMarkup', () => {
  it('renderiza período, totais e formulário acessível do mês', () => {
    const markup = getFinanceMarkup(state());

    assert.match(markup, /datetime="2026-08">Agosto de 2026/);
    assert.match(markup, /data-finance-previous-month/);
    assert.match(markup, /aria-label="Mês anterior"/);
    assert.match(markup, /data-finance-next-month/);
    assert.match(markup, /data-finance-category-type="expense"[\s\S]*?aria-pressed="true"/);
    assert.match(markup, /aria-label="Totais do mês"/);
    assert.match(markup, /Receitas[\s\S]*?R\$ 0,00/);
    assert.match(markup, /data-financial-transaction-form/);
    assert.match(markup, /inputmode="decimal"/);
    assert.match(markup, /min="2026-08-01" max="2026-08-31"/);
  });

  it('exibe loading, erro com nova tentativa e lista vazia', () => {
    const loading = getFinanceMarkup(state({ status: 'loading', categories: [] }));
    const error = getFinanceMarkup(state({
      status: 'error', categories: [], error: new Error('Falha temporária'),
    }));
    const empty = getFinanceMarkup(state({ categoryType: 'income', categories: [] }));

    assert.match(loading, /Carregando lançamentos/);
    assert.match(loading, /data-finance-previous-month[^>]*disabled/);
    assert.match(error, /role="alert"/);
    assert.match(error, /data-feedback-action/);
    assert.match(empty, /Nenhum lançamento neste mês/);
    assert.match(empty, /Nenhuma categoria disponível/);
  });

  it('lista cards cronológicos com valores, metadados e conteúdo escapado', () => {
    const markup = getFinanceMarkup(state({
      summary: {
        incomeCents: 500000, expenseCents: 18349,
        balanceCents: 481651, transactionCount: 2,
      },
      transactions: [
        {
          id: '1', type: 'income', description: 'Salário <extra>',
          categoryName: 'Trabalho', amountCents: 500000,
          transactionDate: '2026-08-20', notes: null,
        },
        {
          id: '2', type: 'expense', description: 'Mercado',
          categoryName: 'Alimentação', amountCents: 18349,
          transactionDate: '2026-08-10', notes: '<script>ruim</script>',
        },
      ],
    }));

    assert.match(markup, /financial-transaction--income/);
    assert.match(markup, /\+R\$ 5\.000,00/);
    assert.match(markup, /financial-transaction--expense/);
    assert.match(markup, /−R\$ 183,49/);
    assert.match(markup, /Saldo[\s\S]*?R\$ 4\.816,51/);
    assert.match(markup, /datetime="2026-08-20">20\/08\/2026/);
    assert.match(markup, /Salário &lt;extra&gt;/);
    assert.doesNotMatch(markup, /<script>/);
  });

  it('escapa categorias e apresenta falhas e confirmação do formulário', () => {
    const markup = getFinanceMarkup(state({
      categories: [{ ...CATEGORY, name: '<script>Alimentação</script>' }],
      formError: new Error('<b>Valor inválido</b>'),
      notice: 'Lançamento cadastrado.',
    }));

    assert.match(markup, /&lt;script&gt;Alimentação&lt;\/script&gt;/);
    assert.match(markup, /&lt;b&gt;Valor inválido&lt;\/b&gt;/);
    assert.match(markup, /role="status">Lançamento cadastrado/);
    assert.doesNotMatch(markup, /<script>|<b>Valor inválido/);
  });
});

describe('bindFinanceView', () => {
  it('conecta navegação, tipo, envio e nova tentativa aos controles nativos', () => {
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
    const form = element();
    const income = element({ financeCategoryType: 'income' });
    const expense = element({ financeCategoryType: 'expense' });
    const root = {
      querySelector(selector) {
        return new Map([
          ['[data-finance-previous-month]', previous],
          ['[data-finance-next-month]', next],
          ['[data-financial-transactions-feedback] [data-feedback-action]', retry],
          ['[data-financial-transaction-form]', form],
        ]).get(selector) ?? null;
      },
      querySelectorAll(selector) {
        return selector === '[data-finance-category-type]' ? [income, expense] : [];
      },
    };
    const values = new Map([
      ['description', 'Mercado'], ['amount', '183,49'],
      ['transactionDate', '2026-08-10'], ['categoryId', CATEGORY.id], ['notes', 'Semana'],
    ]);
    const OriginalFormData = globalThis.FormData;
    globalThis.FormData = class {
      constructor(receivedForm) { assert.equal(receivedForm, form); }
      get(name) { return values.get(name); }
    };
    const calls = [];

    try {
      bindFinanceView(root, {
        onPreviousMonth: () => calls.push('previous'),
        onNextMonth: () => calls.push('next'),
        onCategoryTypeChange: (type) => calls.push(type),
        onCreate: (input) => calls.push(input),
        onRetry: () => calls.push('retry'),
      });
      previous.listeners.click();
      next.listeners.click();
      income.listeners.click();
      retry.listeners.click();
      let prevented = false;
      form.listeners.submit({ preventDefault: () => { prevented = true; } });

      assert.equal(prevented, true);
      assert.deepEqual(calls, [
        'previous', 'next', 'income', 'retry',
        {
          description: 'Mercado', amount: '183,49', transactionDate: '2026-08-10',
          categoryId: CATEGORY.id, notes: 'Semana',
        },
      ]);
    } finally {
      globalThis.FormData = OriginalFormData;
    }
  });
});
