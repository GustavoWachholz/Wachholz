import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHouseholdController } from '../../js/household/household-context.js';

const USER = { id: '11111111-1111-4111-8111-111111111111' };
const HOUSEHOLD = { id: '22222222-2222-4222-8222-222222222222', name: 'Nossa Casa' };

describe('createHouseholdController', () => {
  it('mantém householdId no estado após carregar', async () => {
    const statuses = [];
    const controller = createHouseholdController({
      householdService: { getActiveHousehold: async () => HOUSEHOLD },
      onStateChange: (state) => statuses.push(state.status),
    });

    await controller.load(USER);

    assert.equal(controller.getState().status, 'ready');
    assert.equal(controller.getState().householdId, HOUSEHOLD.id);
    assert.deepEqual(statuses, ['loading', 'ready']);
  });

  it('expõe erro legível quando a household não pode ser carregada', async () => {
    const error = new Error('Household indisponível');
    const controller = createHouseholdController({
      householdService: {
        getActiveHousehold: async () => {
          throw error;
        },
      },
    });

    await controller.load(USER);

    assert.equal(controller.getState().status, 'error');
    assert.equal(controller.getState().error, error);
  });

  it('descarta resposta antiga depois de limpar o contexto', async () => {
    let resolveHousehold;
    const pendingHousehold = new Promise((resolve) => {
      resolveHousehold = resolve;
    });
    const controller = createHouseholdController({
      householdService: { getActiveHousehold: () => pendingHousehold },
    });

    const loadPromise = controller.load(USER);
    controller.clear();
    resolveHousehold(HOUSEHOLD);
    await loadPromise;

    assert.equal(controller.getState().status, 'idle');
    assert.equal(controller.getState().householdId, null);
  });

  it('mantém apenas a resposta da solicitação mais recente', async () => {
    const resolvers = [];
    const controller = createHouseholdController({
      householdService: {
        getActiveHousehold: () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      },
    });

    const firstLoad = controller.load(USER);
    const secondLoad = controller.load(USER);
    const newerHousehold = { ...HOUSEHOLD, name: 'Casa Atual' };
    resolvers[1](newerHousehold);
    await secondLoad;
    resolvers[0](HOUSEHOLD);
    await firstLoad;

    assert.equal(controller.getState().household.name, 'Casa Atual');
  });

  it('exige um serviço compatível', () => {
    assert.throws(
      () => createHouseholdController({ householdService: {} }),
      /serviço de household é obrigatório/,
    );
  });
});
