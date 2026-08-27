import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDashboardSummaryService } from '../../js/modules/dashboard/dashboard-service.js';

describe('createDashboardSummaryService', () => {
  it('agrega o mês atual e todas as listas ativas da household', async () => {
    const transactionCalls = [];
    const shoppingCalls = [];
    const service = createDashboardSummaryService({
      transactionService: {
        async listByPeriod(input) {
          transactionCalls.push(input);
          return [
            { type: 'income', amountCents: 500000 },
            { type: 'expense', amountCents: 18349 },
          ];
        },
      },
      shoppingListService: {
        async listActive(householdId) {
          shoppingCalls.push(householdId);
          return [{ pendingItems: 2 }, { pendingItems: 3 }];
        },
      },
      now: () => new Date(2026, 7, 27, 12, 0),
    });

    const summary = await service.getSummary('household-1');

    assert.deepEqual(transactionCalls, [{
      householdId: 'household-1',
      period: { year: 2026, month: 8 },
    }]);
    assert.deepEqual(shoppingCalls, ['household-1']);
    assert.deepEqual(summary, {
      finance: {
        incomeCents: 500000,
        expenseCents: 18349,
        balanceCents: 481651,
        transactionCount: 2,
      },
      shopping: { pendingItems: 5, activeLists: 2 },
    });
    assert.ok(Object.isFrozen(summary));
  });

  it('propaga falhas e valida as dependências', async () => {
    const service = createDashboardSummaryService({
      transactionService: {
        async listByPeriod() { throw new Error('Falha financeira'); },
      },
      shoppingListService: { async listActive() { return []; } },
    });

    await assert.rejects(() => service.getSummary('household-1'), /falha financeira/i);
    assert.throws(() => createDashboardSummaryService({}), /financeiro/i);
    assert.throws(() => createDashboardSummaryService({
      transactionService: { listByPeriod() {} },
    }), /compras/i);
    assert.throws(() => createDashboardSummaryService({
      transactionService: { listByPeriod() {} },
      shoppingListService: { listActive() {} },
      now: null,
    }), /relógio/i);
  });
});
