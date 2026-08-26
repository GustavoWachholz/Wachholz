import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createShoppingListsController } from '../../js/modules/shopping/shopping-lists-context.js';

const LIST = Object.freeze({ id: 'list-1', name: 'Mercado', pendingItems: 2 });

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

describe('createShoppingListsController', () => {
  it('carrega a coleção e expõe estados previsíveis', async () => {
    const states = [];
    const controller = createShoppingListsController({
      listService: {
        listActive: async () => [LIST],
        create: async () => LIST,
      },
      onStateChange: (state) => states.push(state),
    });

    await controller.load('household-1');

    assert.deepEqual(states.map(({ status }) => status), ['loading', 'ready']);
    assert.deepEqual(controller.getState().lists, [LIST]);
    assert.ok(Object.isFrozen(controller.getState().lists));
  });

  it('adiciona a lista criada sem refazer a consulta', async () => {
    const created = { id: 'list-2', name: 'Feira', pendingItems: 0 };
    const controller = createShoppingListsController({
      listService: {
        listActive: async () => [LIST],
        create: async (input) => {
          assert.equal(input.name, 'Feira');
          return created;
        },
      },
    });

    await controller.load('household-1');
    await controller.create({ name: 'Feira' });

    assert.deepEqual(controller.getState().lists, [LIST, created]);
    assert.equal(controller.getState().isSubmitting, false);
    assert.equal(controller.getState().notice, 'Lista criada com sucesso.');
  });

  it('mantém as listas e exibe erro contextual quando criação falha', async () => {
    const controller = createShoppingListsController({
      listService: {
        listActive: async () => [LIST],
        create: async () => { throw new Error('Informe um nome para a lista.'); },
      },
    });

    await controller.load('household-1');
    await controller.create({ name: '' });

    assert.equal(controller.getState().status, 'ready');
    assert.deepEqual(controller.getState().lists, [LIST]);
    assert.match(controller.getState().formError.message, /informe um nome/i);
  });

  it('descarta resposta de carregamento depois de limpar', async () => {
    const request = deferred();
    const controller = createShoppingListsController({
      listService: {
        listActive: () => request.promise,
        create: async () => LIST,
      },
    });

    const loading = controller.load('household-1');
    controller.clear();
    request.resolve([LIST]);
    await loading;

    assert.equal(controller.getState().status, 'idle');
  });

  it('trata erro de listagem e valida o contrato do serviço', async () => {
    const controller = createShoppingListsController({
      listService: {
        listActive: async () => { throw new Error('Falha'); },
        create: async () => LIST,
      },
    });

    await controller.load('household-1');
    assert.equal(controller.getState().status, 'error');
    assert.throws(() => createShoppingListsController({}), /serviço de listas/i);
  });

  it('sincroniza a contagem de pendentes recebida pelos itens', async () => {
    const controller = createShoppingListsController({
      listService: {
        listActive: async () => [LIST],
        create: async () => LIST,
      },
    });

    await controller.load('household-1');

    assert.equal(controller.setPendingCount('list-1', 5), true);
    assert.equal(controller.getState().lists[0].pendingItems, 5);
    assert.equal(controller.setPendingCount('list-1', 5), false);
    assert.equal(controller.setPendingCount('list-1', -1), false);
  });
});
