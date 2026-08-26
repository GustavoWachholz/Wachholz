import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createShoppingItemsRealtime,
  reconcileShoppingItems,
} from '../../js/modules/shopping/shopping-items-realtime.js';
import { mapShoppingItem } from '../../js/modules/shopping/shopping-item-service.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const LIST_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function row(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    shopping_list_id: LIST_ID,
    household_id: HOUSEHOLD_ID,
    name: 'Leite',
    quantity: 1,
    unit: 'L',
    notes: null,
    is_checked: false,
    created_by: USER_ID,
    checked_by: null,
    checked_at: null,
    created_at: '2026-08-26T10:00:00Z',
    updated_at: '2026-08-26T10:00:00Z',
    ...overrides,
  };
}

function createRealtimeClient() {
  const registrations = [];
  let statusCallback;
  let removeCalls = 0;
  const channel = {
    on(kind, config, callback) {
      registrations.push({ kind, config, callback });
      return channel;
    },
    subscribe(callback) {
      statusCallback = callback;
      return channel;
    },
  };
  const client = {
    channelName: null,
    channel(name) {
      client.channelName = name;
      return channel;
    },
    removeChannel(receivedChannel) {
      assert.equal(receivedChannel, channel);
      removeCalls += 1;
      return Promise.resolve('ok');
    },
  };

  return {
    client,
    registrations,
    getRemoveCalls: () => removeCalls,
    emitStatus: (status) => statusCallback(status),
  };
}

describe('reconcileShoppingItems', () => {
  const scope = { householdId: HOUSEHOLD_ID, listId: LIST_ID };

  it('insere, deduplica e ordena eventos novos', () => {
    const current = mapShoppingItem(row());
    const earlier = row({
      id: '44444444-4444-4444-8444-444444444445',
      name: 'Arroz',
      created_at: '2026-08-26T09:00:00Z',
      updated_at: '2026-08-26T09:00:00Z',
    });
    const withInsert = reconcileShoppingItems([current], {
      type: 'INSERT',
      newRecord: earlier,
    }, scope);
    const deduplicated = reconcileShoppingItems(withInsert, {
      type: 'INSERT',
      newRecord: { ...earlier, name: 'Arroz integral' },
    }, scope);

    assert.deepEqual(withInsert.map(({ name }) => name), ['Arroz', 'Leite']);
    assert.deepEqual(deduplicated.map(({ name }) => name), ['Arroz integral', 'Leite']);
    assert.equal(deduplicated.length, 2);
  });

  it('substitui e reordena um item atualizado', () => {
    const current = mapShoppingItem(row());
    const updated = row({
      name: 'Leite comprado',
      is_checked: true,
      checked_by: USER_ID,
      checked_at: '2026-08-26T12:00:00Z',
      updated_at: '2026-08-26T12:00:00Z',
    });
    const result = reconcileShoppingItems([current], {
      type: 'UPDATE',
      newRecord: updated,
    }, scope);

    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Leite comprado');
    assert.equal(result[0].isChecked, true);
  });

  it('remove pelo ID antigo sem depender de outros campos do DELETE', () => {
    const current = mapShoppingItem(row());
    const result = reconcileShoppingItems([current], {
      type: 'DELETE',
      oldRecord: { id: current.id },
    }, scope);

    assert.deepEqual(result, []);
  });

  it('descarta eventos de outra household, lista ou tipo', () => {
    const current = mapShoppingItem(row());
    const anotherHousehold = row({ household_id: '99999999-9999-4999-8999-999999999999' });
    const anotherList = row({ shopping_list_id: '88888888-8888-4888-8888-888888888888' });

    assert.deepEqual(
      reconcileShoppingItems([current], { type: 'INSERT', newRecord: anotherHousehold }, scope),
      [current],
    );
    assert.deepEqual(
      reconcileShoppingItems([current], { type: 'UPDATE', newRecord: anotherList }, scope),
      [current],
    );
    assert.deepEqual(
      reconcileShoppingItems([current], { type: 'TRUNCATE' }, scope),
      [current],
    );
  });
});

describe('createShoppingItemsRealtime', () => {
  it('assina os três eventos com filtro da lista e normaliza o payload', () => {
    const mock = createRealtimeClient();
    const events = [];
    const service = createShoppingItemsRealtime(mock.client);
    service.subscribe({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      onEvent: (event) => events.push(event),
    });

    assert.match(mock.client.channelName, new RegExp(`${HOUSEHOLD_ID}:${LIST_ID}$`));
    assert.deepEqual(
      mock.registrations.map(({ config }) => config.event),
      ['INSERT', 'UPDATE', 'DELETE'],
    );
    mock.registrations.forEach(({ kind, config }) => {
      assert.equal(kind, 'postgres_changes');
      assert.equal(config.schema, 'public');
      assert.equal(config.table, 'shopping_items');
      assert.equal(config.filter, `shopping_list_id=eq.${LIST_ID}`);
    });

    mock.registrations[0].callback({ new: row(), old: {} });
    assert.equal(events[0].type, 'INSERT');
    assert.equal(events[0].newRecord.name, 'Leite');
  });

  it('relata falha do canal e remove a assinatura uma única vez', async () => {
    const mock = createRealtimeClient();
    const errors = [];
    const unsubscribe = createShoppingItemsRealtime(mock.client).subscribe({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      onEvent() {},
      onError: (error) => errors.push(error),
    });

    mock.emitStatus('CHANNEL_ERROR');
    await unsubscribe();
    await unsubscribe();

    assert.match(errors[0].message, /temporariamente indisponível/i);
    assert.equal(mock.getRemoveCalls(), 1);
  });

  it('valida cliente, escopo e callback antes de abrir o canal', () => {
    assert.throws(() => createShoppingItemsRealtime({}), /cliente Realtime/i);
    const service = createShoppingItemsRealtime(createRealtimeClient().client);
    assert.throws(() => service.subscribe({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
    }), /callbacks/i);
    assert.throws(() => service.subscribe({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      onEvent() {},
      onError: null,
    }), /callbacks/i);
  });
});
