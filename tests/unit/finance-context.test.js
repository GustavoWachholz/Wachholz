import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFinanceController } from '../../js/modules/finance/finance-context.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const EXPENSE_CATEGORY = Object.freeze({
  id: '77777777-7777-4777-8777-777777777777', householdId: HOUSEHOLD_ID,
  name: 'Alimentação', type: 'expense', isActive: true,
});
const INCOME_CATEGORY = Object.freeze({
  ...EXPENSE_CATEGORY, id: '88888888-8888-4888-8888-888888888888',
  name: 'Salário', type: 'income',
});
const EXPENSE = Object.freeze({
  id: '99999999-9999-4999-8999-999999999998', householdId: HOUSEHOLD_ID,
  categoryId: EXPENSE_CATEGORY.id, categoryName: EXPENSE_CATEGORY.name, createdBy: USER_ID,
  type: 'expense', description: 'Mercado', amountCents: 12500,
  transactionDate: '2026-08-10', notes: null,
  createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z',
});
const INCOME = Object.freeze({
  ...EXPENSE, id: '99999999-9999-4999-8999-999999999999',
  categoryId: INCOME_CATEGORY.id, categoryName: INCOME_CATEGORY.name,
  type: 'income', description: 'Salário', amountCents: 500000,
  transactionDate: '2026-08-20', createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
});

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

function createCategoryService(overrides = {}) {
  return {
    listByType: async ({ type }) => (
      type === 'income' ? [INCOME_CATEGORY] : [EXPENSE_CATEGORY]
    ),
    ...overrides,
  };
}

function createTransactionService(overrides = {}) {
  return {
    listByPeriod: async () => [EXPENSE],
    create: async () => INCOME,
    ...overrides,
  };
}

const fixedNow = () => new Date(2026, 7, 26, 12, 0);

describe('createFinanceController', () => {
  it('inicia no mês atual e carrega categorias, lançamentos e totais', async () => {
    const categoryCalls = [];
    const transactionCalls = [];
    const states = [];
    const controller = createFinanceController({
      categoryService: createCategoryService({
        listByType: async (input) => { categoryCalls.push(input); return [EXPENSE_CATEGORY]; },
      }),
      transactionService: createTransactionService({
        listByPeriod: async (input) => { transactionCalls.push(input); return [EXPENSE]; },
      }),
      now: fixedNow,
      onStateChange: (state) => states.push(state),
    });

    assert.deepEqual(controller.getState().period, { year: 2026, month: 8 });
    await controller.load({ householdId: HOUSEHOLD_ID });

    assert.deepEqual(states.map(({ status }) => status), ['loading', 'ready']);
    assert.deepEqual(categoryCalls, [{ householdId: HOUSEHOLD_ID, type: 'expense' }]);
    assert.deepEqual(transactionCalls, [{
      householdId: HOUSEHOLD_ID, period: { year: 2026, month: 8 },
    }]);
    assert.deepEqual(controller.getState().transactions, [EXPENSE]);
    assert.deepEqual(controller.getState().summary, {
      incomeCents: 0, expenseCents: 12500, balanceCents: -12500, transactionCount: 1,
    });
  });

  it('navega entre dezembro e janeiro e recarrega todo o período', async () => {
    const calls = [];
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService({
        listByPeriod: async (input) => { calls.push(input.period); return []; },
      }),
      now: fixedNow,
    });
    await controller.load({ householdId: HOUSEHOLD_ID, period: { year: 2026, month: 12 } });

    await controller.shiftMonth(1);
    assert.deepEqual(controller.getState().period, { year: 2027, month: 1 });
    await controller.shiftMonth(-1);
    assert.deepEqual(controller.getState().period, { year: 2026, month: 12 });
    assert.deepEqual(calls, [
      { year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2026, month: 12 },
    ]);
  });

  it('troca somente as categorias do formulário e preserva os lançamentos', async () => {
    let transactionLoads = 0;
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService({
        listByPeriod: async () => { transactionLoads += 1; return [EXPENSE]; },
      }),
      now: fixedNow,
    });
    await controller.load({ householdId: HOUSEHOLD_ID });
    await controller.selectCategoryType('income');

    assert.equal(controller.getState().categoryType, 'income');
    assert.deepEqual(controller.getState().categories, [INCOME_CATEGORY]);
    assert.deepEqual(controller.getState().transactions, [EXPENSE]);
    assert.equal(transactionLoads, 1);
  });

  it('cria, ordena e recalcula os totais sem novo carregamento', async () => {
    const createCalls = [];
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService({
        create: async (input) => { createCalls.push(input); return INCOME; },
      }),
      now: fixedNow,
    });
    await controller.load({ householdId: HOUSEHOLD_ID });
    await controller.selectCategoryType('income');
    await controller.create({
      userId: USER_ID, description: 'Salário', amount: '5.000,00',
      transactionDate: '2026-08-20', categoryId: INCOME_CATEGORY.id, notes: '',
    });

    assert.equal(createCalls[0].householdId, HOUSEHOLD_ID);
    assert.deepEqual(createCalls[0].period, { year: 2026, month: 8 });
    assert.deepEqual(createCalls[0].categories, [INCOME_CATEGORY]);
    assert.equal(createCalls[0].type, 'income');
    assert.deepEqual(controller.getState().transactions.map(({ id }) => id), [INCOME.id, EXPENSE.id]);
    assert.deepEqual(controller.getState().summary, {
      incomeCents: 500000, expenseCents: 12500,
      balanceCents: 487500, transactionCount: 2,
    });
    assert.equal(controller.getState().notice, 'Lançamento cadastrado.');
  });

  it('mantém os registros e expõe erro do formulário quando a criação falha', async () => {
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService({
        create: async () => { throw new Error('Valor inválido'); },
      }),
      now: fixedNow,
    });
    await controller.load({ householdId: HOUSEHOLD_ID });
    await controller.create({ userId: USER_ID });

    assert.equal(controller.getState().status, 'ready');
    assert.equal(controller.getState().isSubmitting, false);
    assert.match(controller.getState().formError.message, /valor inválido/i);
    assert.deepEqual(controller.getState().transactions, [EXPENSE]);
  });

  it('expõe falha de carga e descarta resposta antiga depois de limpar', async () => {
    const request = deferred();
    const controller = createFinanceController({
      categoryService: createCategoryService({ listByType: () => request.promise }),
      transactionService: createTransactionService(),
      now: fixedNow,
    });
    const loading = controller.load({ householdId: HOUSEHOLD_ID });
    controller.clear();
    request.resolve([EXPENSE_CATEGORY]);
    await loading;
    assert.equal(controller.getState().status, 'idle');

    const failing = createFinanceController({
      categoryService: createCategoryService({
        listByType: async () => { throw new Error('Falha temporária'); },
      }),
      transactionService: createTransactionService(),
      now: fixedNow,
    });
    await failing.load({ householdId: HOUSEHOLD_ID });
    assert.equal(failing.getState().status, 'error');
    assert.match(failing.getState().error.message, /falha/i);
  });

  it('impede ações antes do carregamento e valida dependências', async () => {
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService(),
      now: fixedNow,
    });
    const initial = controller.getState();
    await controller.shiftMonth(1);
    await controller.selectCategoryType('income');
    await controller.create({ userId: USER_ID });
    assert.equal(controller.getState(), initial);

    assert.throws(() => createFinanceController({}), /categorias financeiras/i);
    assert.throws(() => createFinanceController({
      categoryService: createCategoryService(),
    }), /lançamentos financeiros/i);
    assert.throws(() => createFinanceController({
      categoryService: createCategoryService(),
      transactionService: createTransactionService(),
      now: null,
    }), /relógio/i);
  });
});
