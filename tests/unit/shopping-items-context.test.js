import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createShoppingItemsController } from '../../js/modules/shopping/shopping-items-context.js';

const LIST_ID = '33333333-3333-4333-8333-333333333333';
const ITEM = Object.freeze({
  id: '44444444-4444-4444-8444-444444444444',
  listId: LIST_ID,
  name: 'Leite',
  isChecked: false,
  createdAt: '2026-08-26T10:00:00Z',
  checkedAt: null,
});

function deferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

function createItemService(overrides = {}) {
  return {
    listByList: async () => [ITEM],
    create: async () => ITEM,
    update: async () => ITEM,
    setChecked: async () => ITEM,
    remove: async () => ITEM.id,
    ...overrides,
  };
}

describe('createShoppingItemsController', () => {
  it('carrega os itens da lista selecionada', async () => {
    const states = [];
    const controller = createShoppingItemsController({
      itemService: createItemService(),
      onStateChange: (state) => states.push(state),
    });

    await controller.load({ listId: LIST_ID });

    assert.deepEqual(states.map(({ status }) => status), ['loading', 'ready']);
    assert.equal(controller.getState().listId, LIST_ID);
    assert.deepEqual(controller.getState().items, [ITEM]);
  });

  it('adiciona e ordena o item imediatamente', async () => {
    const earlierItem = { ...ITEM, id: '44444444-4444-4444-8444-444444444445' };
    const controller = createShoppingItemsController({
      itemService: createItemService({ create: async () => earlierItem }),
    });

    await controller.load({ listId: LIST_ID });
    await controller.create({ listId: LIST_ID, name: 'Arroz' });

    assert.equal(controller.getState().items.length, 2);
    assert.equal(controller.getState().notice, 'Item adicionado.');
  });

  it('mantém itens e mostra erro contextual quando a inclusão falha', async () => {
    const controller = createShoppingItemsController({
      itemService: createItemService({
        create: async () => { throw new Error('Informe o nome do item.'); },
      }),
    });

    await controller.load({ listId: LIST_ID });
    await controller.create({ listId: LIST_ID, name: '' });

    assert.deepEqual(controller.getState().items, [ITEM]);
    assert.match(controller.getState().formError.message, /nome do item/i);
  });

  it('ignora inclusão destinada a outra lista', async () => {
    let calls = 0;
    const controller = createShoppingItemsController({
      itemService: createItemService({
        listByList: async () => [],
        create: async () => { calls += 1; return ITEM; },
      }),
    });

    await controller.load({ listId: LIST_ID });
    await controller.create({ listId: 'outra-lista' });

    assert.equal(calls, 0);
  });

  it('descarta resposta antiga e trata erro de carregamento', async () => {
    const request = deferred();
    const controller = createShoppingItemsController({
      itemService: createItemService({ listByList: () => request.promise }),
    });

    const loading = controller.load({ listId: LIST_ID });
    controller.clear();
    request.resolve([ITEM]);
    await loading;
    assert.equal(controller.getState().status, 'idle');

    const failing = createShoppingItemsController({
      itemService: createItemService({
        listByList: async () => { throw new Error('Falha'); },
      }),
    });
    await failing.load({ listId: LIST_ID });
    assert.equal(failing.getState().status, 'error');
  });

  it('valida o contrato do serviço', () => {
    assert.throws(() => createShoppingItemsController({}), /serviço de itens/i);
  });

  it('abre, cancela e conclui a edição substituindo o item', async () => {
    const updated = { ...ITEM, name: 'Leite sem lactose' };
    const controller = createShoppingItemsController({
      itemService: createItemService({ update: async () => updated }),
    });
    await controller.load({ listId: LIST_ID });

    controller.startEdit(ITEM.id);
    assert.equal(controller.getState().editingItemId, ITEM.id);
    controller.cancelEdit();
    assert.equal(controller.getState().editingItemId, null);

    controller.startEdit(ITEM.id);
    await controller.update({ listId: LIST_ID, itemId: ITEM.id, name: updated.name });
    assert.equal(controller.getState().items[0].name, updated.name);
    assert.equal(controller.getState().editingItemId, null);
    assert.equal(controller.getState().notice, 'Item atualizado.');
  });

  it('mantém a edição e os itens quando a atualização falha', async () => {
    const controller = createShoppingItemsController({
      itemService: createItemService({
        update: async () => { throw new Error('Nome inválido'); },
      }),
    });
    await controller.load({ listId: LIST_ID });
    controller.startEdit(ITEM.id);

    await controller.update({ listId: LIST_ID, itemId: ITEM.id, name: '' });

    assert.deepEqual(controller.getState().items, [ITEM]);
    assert.equal(controller.getState().editingItemId, ITEM.id);
    assert.match(controller.getState().formError.message, /nome inválido/i);
  });

  it('marca o item, atualiza metadados e reordena o estado', async () => {
    const checked = {
      ...ITEM,
      isChecked: true,
      checkedBy: '22222222-2222-4222-8222-222222222222',
      checkedAt: '2026-08-26T13:00:00Z',
    };
    const controller = createShoppingItemsController({
      itemService: createItemService({ setChecked: async () => checked }),
    });
    await controller.load({ listId: LIST_ID });

    await controller.setChecked({ listId: LIST_ID, itemId: ITEM.id, isChecked: true });

    assert.equal(controller.getState().items[0].isChecked, true);
    assert.equal(controller.getState().items[0].checkedAt, checked.checkedAt);
    assert.match(controller.getState().notice, /comprado/i);
  });

  it('remove somente após o serviço confirmar e preserva o item em caso de falha', async () => {
    const controller = createShoppingItemsController({ itemService: createItemService() });
    await controller.load({ listId: LIST_ID });
    await controller.remove({ listId: LIST_ID, itemId: ITEM.id });
    assert.deepEqual(controller.getState().items, []);
    assert.equal(controller.getState().notice, 'Item excluído.');

    const failing = createShoppingItemsController({
      itemService: createItemService({
        remove: async () => { throw new Error('Falha ao excluir'); },
      }),
    });
    await failing.load({ listId: LIST_ID });
    await failing.remove({ listId: LIST_ID, itemId: ITEM.id });
    assert.deepEqual(failing.getState().items, [ITEM]);
    assert.match(failing.getState().operationError.message, /excluir/i);
  });

  it('impede mutações concorrentes no mesmo estado', async () => {
    const updateRequest = deferred();
    let toggleCalls = 0;
    const controller = createShoppingItemsController({
      itemService: createItemService({
        update: () => updateRequest.promise,
        setChecked: async () => { toggleCalls += 1; return ITEM; },
      }),
    });
    await controller.load({ listId: LIST_ID });

    const updating = controller.update({ listId: LIST_ID, itemId: ITEM.id, name: 'Novo' });
    assert.equal(controller.getState().pendingItemId, ITEM.id);
    await controller.setChecked({ listId: LIST_ID, itemId: ITEM.id, isChecked: true });
    assert.equal(toggleCalls, 0);
    updateRequest.resolve(ITEM);
    await updating;
  });
});
