import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindFinanceView, getFinanceMarkup } from '../../js/modules/finance/finance-view.js';

const PERIOD = Object.freeze({ year: 2026, month: 8 });
const CATEGORY = Object.freeze({
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Alimentação',
  type: 'expense',
});
const TRANSACTION = Object.freeze({
  id: '99999999-9999-4999-8999-999999999999',
  type: 'expense',
  description: 'Mercado',
  categoryId: CATEGORY.id,
  categoryName: CATEGORY.name,
  amountCents: 18349,
  transactionDate: '2026-08-10',
  notes: 'Semana',
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

  it('renderiza filtros combináveis e ações de manutenção com alvos explícitos', () => {
    const markup = getFinanceMarkup(state({
      transactions: [TRANSACTION],
      visibleTransactions: [TRANSACTION],
      filterType: 'expense',
      filterCategoryId: CATEGORY.id,
    }));

    assert.match(markup, /data-finance-filter-type/);
    assert.match(markup, /value="expense" selected>Despesa/);
    assert.match(markup, /data-finance-filter-category/);
    assert.match(markup, new RegExp(`value="${CATEGORY.id}" selected`));
    assert.match(markup, new RegExp(`data-financial-transaction-edit="${TRANSACTION.id}"`));
    assert.match(markup, new RegExp(`data-financial-transaction-delete="${TRANSACTION.id}"`));
  });

  it('renderiza edição completa preenchida e erro contextual escapado', () => {
    const markup = getFinanceMarkup(state({
      transactions: [TRANSACTION],
      visibleTransactions: [TRANSACTION],
      editingTransactionId: TRANSACTION.id,
      editCategories: [CATEGORY],
      formError: new Error('<b>Não salvou</b>'),
    }));

    assert.match(markup, new RegExp(`data-financial-transaction-edit="${TRANSACTION.id}"`));
    assert.match(markup, /name="description"[^>]*value="Mercado"/);
    assert.match(markup, /name="amount"[^>]*value="183,49"/);
    assert.match(markup, /name="type"/);
    assert.match(markup, /name="categoryId"/);
    assert.match(markup, /name="transactionDate"/);
    assert.match(markup, /name="notes"/);
    assert.match(markup, /data-financial-edit-cancel/);
    assert.match(markup, /&lt;b&gt;Não salvou&lt;\/b&gt;/);
  });

  it('distingue mês vazio de filtros sem resultados', () => {
    const markup = getFinanceMarkup(state({
      transactions: [TRANSACTION],
      visibleTransactions: [],
      filterType: 'income',
    }));

    assert.match(markup, /Nenhum lançamento corresponde aos filtros/);
    assert.doesNotMatch(markup, /Nenhum lançamento neste mês/);
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

  it('conecta filtros, edição, cancelamento, atualização e exclusão', () => {
    function element(dataset = {}, tagName = 'BUTTON') {
      return {
        dataset,
        tagName,
        addEventListener(type, listener) {
          this.listeners ??= {};
          this.listeners[type] = listener;
        },
      };
    }

    const filterType = element();
    filterType.value = 'expense';
    const filterCategory = element();
    filterCategory.value = CATEGORY.id;
    const editButton = element({ financialTransactionEdit: TRANSACTION.id });
    const deleteButton = element({ financialTransactionDelete: TRANSACTION.id });
    const cancelButton = element();
    const editType = element();
    editType.value = 'expense';
    const options = [
      { dataset: {}, disabled: false, hidden: false },
      { dataset: { categoryType: 'expense' }, disabled: false, hidden: false },
      { dataset: { categoryType: 'income' }, disabled: false, hidden: false },
    ];
    const editCategory = element();
    editCategory.options = options;
    editCategory.selectedIndex = 1;
    editCategory.value = CATEGORY.id;
    const editForm = element({ financialTransactionEdit: TRANSACTION.id }, 'FORM');
    editForm.querySelector = (selector) => new Map([
      ['[data-financial-edit-type]', editType],
      ['[data-financial-edit-category]', editCategory],
      ['[data-financial-edit-cancel]', cancelButton],
    ]).get(selector) ?? null;

    const root = {
      querySelector(selector) {
        return new Map([
          ['[data-finance-filter-type]', filterType],
          ['[data-finance-filter-category]', filterCategory],
        ]).get(selector) ?? null;
      },
      querySelectorAll(selector) {
        return new Map([
          ['[data-finance-category-type]', []],
          ['button[data-financial-transaction-edit]', [editButton]],
          ['[data-financial-transaction-delete]', [deleteButton]],
          ['[data-financial-transaction-edit]', [editForm]],
        ]).get(selector) ?? [];
      },
    };
    const values = new Map([
      ['type', 'expense'], ['description', 'Mercado mensal'], ['amount', '200,00'],
      ['transactionDate', '2026-08-10'], ['categoryId', CATEGORY.id], ['notes', 'Ajustado'],
    ]);
    const OriginalFormData = globalThis.FormData;
    globalThis.FormData = class {
      constructor(receivedForm) { assert.equal(receivedForm, editForm); }
      get(name) { return values.get(name); }
    };
    const calls = [];

    try {
      bindFinanceView(root, {
        onFilterTypeChange: (type) => calls.push(['filterType', type]),
        onFilterCategoryChange: (categoryId) => calls.push(['filterCategory', categoryId]),
        onEdit: (id) => calls.push(['edit', id]),
        onEditCancel: () => calls.push(['cancel']),
        onUpdate: (input) => calls.push(['update', input]),
        onDelete: (id) => calls.push(['delete', id]),
      });
      filterType.listeners.change({ currentTarget: filterType });
      filterCategory.listeners.change({ currentTarget: filterCategory });
      editButton.listeners.click();
      deleteButton.listeners.click();
      cancelButton.listeners.click();
      let prevented = false;
      editForm.listeners.submit({ preventDefault: () => { prevented = true; } });

      assert.equal(prevented, true);
      assert.deepEqual(calls, [
        ['filterType', 'expense'],
        ['filterCategory', CATEGORY.id],
        ['edit', TRANSACTION.id],
        ['delete', TRANSACTION.id],
        ['cancel'],
        ['update', {
          transactionId: TRANSACTION.id,
          type: 'expense',
          description: 'Mercado mensal',
          amount: '200,00',
          transactionDate: '2026-08-10',
          categoryId: CATEGORY.id,
          notes: 'Ajustado',
        }],
      ]);

      editType.value = 'income';
      editType.listeners.change();
      assert.equal(options[1].disabled, true);
      assert.equal(options[2].disabled, false);
      assert.equal(editCategory.value, '');
    } finally {
      globalThis.FormData = OriginalFormData;
    }
  });
});
