import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDashboardController } from '../../js/modules/dashboard/dashboard-context.js';

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

describe('createDashboardController', () => {
  it('carrega e normaliza o contrato dos dois resumos', async () => {
    const states = [];
    const controller = createDashboardController({
      summaryService: {
        async getSummary(householdId) {
          assert.equal(householdId, 'household-1');
          return {
            finance: { income: '100', expenses: '40', transactionCount: 2 },
            shopping: { pendingItems: 3, activeLists: 1 },
          };
        },
      },
      onStateChange: (state) => states.push(state),
    });

    await controller.load('household-1');

    assert.deepEqual(states.map(({ status }) => status), ['loading', 'ready']);
    assert.equal(controller.getState().summary.finance.balance, 60);
  });

  it('expõe erro do serviço em estado próprio', async () => {
    const controller = createDashboardController({
      summaryService: {
        async getSummary() {
          throw new Error('Resumo indisponível');
        },
      },
    });

    await controller.load('household-1');

    assert.equal(controller.getState().status, 'error');
    assert.match(controller.getState().error.message, /indisponível/);
  });

  it('descarta resposta antiga após limpar o contexto', async () => {
    const request = deferred();
    const controller = createDashboardController({
      summaryService: { getSummary: () => request.promise },
    });

    const loading = controller.load('household-1');
    controller.clear();
    request.resolve({});
    await loading;

    assert.equal(controller.getState().status, 'idle');
  });

  it('valida serviço e household', async () => {
    assert.throws(() => createDashboardController({}), /serviço de resumo/i);

    const controller = createDashboardController({
      summaryService: { getSummary: async () => ({}) },
    });
    await assert.rejects(() => controller.load(''), /identificador da household/i);
  });
});
