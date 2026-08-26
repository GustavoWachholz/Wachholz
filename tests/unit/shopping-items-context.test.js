import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createShoppingItemsController } from '../../js/modules/shopping/shopping-items-context.js';

const LIST_ID = '33333333-3333-4333-8333-333333333333';
const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ITEM = Object.freeze({
  id: '44444444-4444-4444-8444-444444444444',
  listId: LIST_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Leite',
  quantity: 1,
  unit: 'L',
  notes: null,
  isChecked: false,
  createdBy: USER_ID,
  checkedBy: null,
  createdAt: '2026-08-26T10:00:00Z',
  checkedAt: null,
  updatedAt: '2026-08-26T10:00:00Z',
});

function itemRow(overrides = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    shopping_list_id: LIST_ID,
    household_id: HOUSEHOLD_ID,
    name: 'Arroz',
    quantity: 2,
    unit: 'kg',
    notes: null,
    is_checked: false,
    created_by: USER_ID,
    checked_by: null,
    checked_at: null,
    created_at: '2026-08-26T11:00:00Z',
    updated_at: '2026-08-26T11:00:00Z',
    ...overrides,
  };
}

function createRealtimeService() {
  let subscription;
  let unsubscribeCalls = 0;

  return {
    service: {
      subscribe(input) {
        subscription = input;
        return () => { unsubscribeCalls += 1; };
      },
    },
    getSubscription: () => subscription,
    getUnsubscribeCalls: () => unsubscribeCalls,
  };
}

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

  it('assina após carregar, reduz eventos remotos e descarta ao limpar', async () => {
    const realtime = createRealtimeService();
    const controller = createShoppingItemsController({
      itemService: createItemService(),
      realtimeService: realtime.service,
    });

    await controller.load({ householdId: HOUSEHOLD_ID, listId: LIST_ID });
    const subscription = realtime.getSubscription();
    assert.equal(subscription.householdId, HOUSEHOLD_ID);
    assert.equal(subscription.listId, LIST_ID);

    subscription.onEvent({ type: 'INSERT', newRecord: itemRow() });
    assert.deepEqual(controller.getState().items.map(({ name }) => name), ['Leite', 'Arroz']);

    subscription.onEvent({
      type: 'UPDATE',
      newRecord: itemRow({ name: 'Arroz integral' }),
    });
    assert.equal(controller.getState().items.at(-1).name, 'Arroz integral');

    subscription.onEvent({ type: 'DELETE', oldRecord: { id: ITEM.id } });
    assert.deepEqual(controller.getState().items.map(({ name }) => name), ['Arroz integral']);

    controller.clear();
    assert.equal(realtime.getUnsubscribeCalls(), 1);
    assert.equal(controller.getState().status, 'idle');
  });

  it('preserva evento remoto recebido durante uma inclusão local', async () => {
    const createRequest = deferred();
    const realtime = createRealtimeService();
    const createdItem = { ...ITEM, id: '66666666-6666-4666-8666-666666666666', name: 'Café' };
    const controller = createShoppingItemsController({
      itemService: createItemService({ create: () => createRequest.promise }),
      realtimeService: realtime.service,
    });
    await controller.load({ householdId: HOUSEHOLD_ID, listId: LIST_ID });

    const creating = controller.create({ listId: LIST_ID, name: 'Café' });
    realtime.getSubscription().onEvent({ type: 'INSERT', newRecord: itemRow() });
    createRequest.resolve(createdItem);
    await creating;

    assert.deepEqual(
      controller.getState().items.map(({ name }) => name),
      ['Leite', 'Café', 'Arroz'],
    );
  });

  it('mantém a lista utilizável quando o canal Realtime falha', async () => {
    const realtime = createRealtimeService();
    const controller = createShoppingItemsController({
      itemService: createItemService(),
      realtimeService: realtime.service,
    });
    await controller.load({ householdId: HOUSEHOLD_ID, listId: LIST_ID });

    realtime.getSubscription().onError(new Error('Canal indisponível'));

    assert.equal(controller.getState().status, 'ready');
    assert.deepEqual(controller.getState().items, [ITEM]);
    assert.match(controller.getState().realtimeError.message, /canal/i);
  });

  it('valida o contrato opcional do serviço Realtime', () => {
    assert.throws(() => createShoppingItemsController({
      itemService: createItemService(),
      realtimeService: {},
    }), /Realtime/i);
  });
});
