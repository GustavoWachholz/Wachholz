import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFinanceController } from '../../js/modules/finance/finance-context.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const EXPENSE_CATEGORY = Object.freeze({
  id: '77777777-7777-4777-8777-777777777777',
  householdId: HOUSEHOLD_ID,
  name: 'Alimentação',
  type: 'expense',
  isActive: true,
});
const INCOME_CATEGORY = Object.freeze({
  ...EXPENSE_CATEGORY,
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Salário',
  type: 'income',
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

const fixedNow = () => new Date(2026, 7, 26, 12, 0);

describe('createFinanceController', () => {
  it('inicia no mês atual e carrega despesas por padrão', async () => {
    const calls = [];
    const states = [];
    const controller = createFinanceController({
      categoryService: createCategoryService({
        listByType: async (input) => { calls.push(input); return [EXPENSE_CATEGORY]; },
      }),
      now: fixedNow,
      onStateChange: (state) => states.push(state),
    });

    assert.deepEqual(controller.getState().period, { year: 2026, month: 8 });
    await controller.load({ householdId: HOUSEHOLD_ID });

    assert.deepEqual(states.map(({ status }) => status), ['loading', 'ready']);
    assert.deepEqual(calls, [{ householdId: HOUSEHOLD_ID, type: 'expense' }]);
    assert.deepEqual(controller.getState().categories, [EXPENSE_CATEGORY]);
  });

  it('navega entre dezembro e janeiro preservando as categorias', async () => {
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      now: fixedNow,
    });
    await controller.load({
      householdId: HOUSEHOLD_ID,
      period: { year: 2026, month: 12 },
    });

    controller.shiftMonth(1);
    assert.deepEqual(controller.getState().period, { year: 2027, month: 1 });
    controller.shiftMonth(-1);
    assert.deepEqual(controller.getState().period, { year: 2026, month: 12 });
    assert.deepEqual(controller.getState().categories, [EXPENSE_CATEGORY]);
  });

  it('troca o tipo e recarrega somente categorias compatíveis', async () => {
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      now: fixedNow,
    });
    await controller.load({ householdId: HOUSEHOLD_ID });
    await controller.selectCategoryType('income');

    assert.equal(controller.getState().categoryType, 'income');
    assert.deepEqual(controller.getState().categories, [INCOME_CATEGORY]);
    assert.deepEqual(controller.getState().period, { year: 2026, month: 8 });
  });

  it('expõe falha e descarta resposta antiga depois de limpar', async () => {
    const request = deferred();
    const controller = createFinanceController({
      categoryService: createCategoryService({ listByType: () => request.promise }),
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
      now: fixedNow,
    });
    await failing.load({ householdId: HOUSEHOLD_ID });
    assert.equal(failing.getState().status, 'error');
    assert.match(failing.getState().error.message, /falha/i);

    await failing.selectCategoryType('income');
    assert.equal(failing.getState().categoryType, 'income');
  });

  it('impede ações antes do carregamento e valida dependências', async () => {
    const controller = createFinanceController({
      categoryService: createCategoryService(),
      now: fixedNow,
    });
    const initial = controller.getState();
    controller.shiftMonth(1);
    await controller.selectCategoryType('income');
    assert.equal(controller.getState(), initial);

    assert.throws(() => createFinanceController({}), /categorias financeiras/i);
    assert.throws(() => createFinanceController({
      categoryService: createCategoryService(),
      now: null,
    }), /relógio/i);
  });
});
