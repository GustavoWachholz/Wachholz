import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHOPPING_ITEM_LIMITS,
  ShoppingItemError,
  createShoppingItemService,
  mapShoppingItem,
  sortShoppingItems,
  validateShoppingItemInput,
} from '../../js/modules/shopping/shopping-item-service.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const LIST_ID = '33333333-3333-4333-8333-333333333333';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';

function itemRow(overrides = {}) {
  return {
    id: ITEM_ID,
    shopping_list_id: LIST_ID,
    household_id: HOUSEHOLD_ID,
    name: 'Leite',
    quantity: '2.50',
    unit: 'L',
    notes: 'Integral',
    is_checked: false,
    created_by: USER_ID,
    checked_by: null,
    checked_at: null,
    created_at: '2026-08-26T10:00:00Z',
    updated_at: '2026-08-26T10:00:00Z',
    ...overrides,
  };
}

function createListClient(result) {
  const calls = [];
  let equalityCount = 0;
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', column, value]);
          equalityCount += 1;
          return equalityCount === 2 ? Promise.resolve(result) : this;
        },
      };
    },
  };
}

function createInsertClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        insert(payload) {
          calls.push(['insert', payload]);
          return this;
        },
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        async single() {
          calls.push(['single']);
          return result;
        },
      };
    },
  };
}

function createMutationClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        update(payload) {
          calls.push(['update', payload]);
          return this;
        },
        delete() {
          calls.push(['delete']);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', column, value]);
          return this;
        },
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        async single() {
          calls.push(['single']);
          return result;
        },
      };
    },
  };
}

describe('validateShoppingItemInput', () => {
  it('normaliza nome, quantidade decimal e campos opcionais', () => {
    assert.deepEqual(validateShoppingItemInput({
      name: '  Leite   integral ',
      quantity: '2,5',
      unit: '  litros ',
      notes: '  Sem lactose  ',
    }), {
      name: 'Leite integral',
      quantity: 2.5,
      unit: 'litros',
      notes: 'Sem lactose',
    });
  });

  it('transforma opcionais vazios em null', () => {
    assert.deepEqual(validateShoppingItemInput({ name: 'Arroz' }), {
      name: 'Arroz',
      quantity: null,
      unit: null,
      notes: null,
    });
  });

  it('rejeita nome vazio e quantidade não positiva', () => {
    assert.throws(
      () => validateShoppingItemInput({ name: '' }),
      (error) => error instanceof ShoppingItemError && error.code === 'INVALID_ITEM',
    );
    for (const quantity of ['0', '-1', 'abc']) {
      assert.throws(
        () => validateShoppingItemInput({ name: 'Item', quantity }),
        (error) => error instanceof ShoppingItemError && error.code === 'INVALID_QUANTITY',
      );
    }
  });

  it('aplica limites aos campos textuais', () => {
    assert.throws(
      () => validateShoppingItemInput({ name: 'a'.repeat(SHOPPING_ITEM_LIMITS.name + 1) }),
      /no máximo 120/i,
    );
    assert.throws(
      () => validateShoppingItemInput({ name: 'Item', unit: 'a'.repeat(31) }),
      /no máximo 30/i,
    );
    assert.throws(
      () => validateShoppingItemInput({ name: 'Item', notes: 'a'.repeat(501) }),
      /no máximo 500/i,
    );
  });
});

describe('mapShoppingItem', () => {
  it('mapeia números e nomes do banco para o contrato do front-end', () => {
    const item = mapShoppingItem(itemRow());

    assert.equal(item.listId, LIST_ID);
    assert.equal(item.quantity, 2.5);
    assert.equal(item.createdBy, USER_ID);
    assert.equal(item.isChecked, false);
    assert.ok(Object.isFrozen(item));
  });

  it('rejeita metadados de conclusão inconsistentes', () => {
    assert.throws(
      () => mapShoppingItem(itemRow({ is_checked: true })),
      /dados de conclusão/i,
    );
  });
});

describe('sortShoppingItems', () => {
  it('ordena pendentes por criação e concluídos por conclusão decrescente', () => {
    const items = [
      mapShoppingItem(itemRow({
        id: '44444444-4444-4444-8444-444444444445',
        name: 'Concluído antigo',
        is_checked: true,
        checked_by: USER_ID,
        checked_at: '2026-08-26T11:00:00Z',
      })),
      mapShoppingItem(itemRow({
        id: '44444444-4444-4444-8444-444444444446',
        name: 'Pendente novo',
        created_at: '2026-08-26T12:00:00Z',
        updated_at: '2026-08-26T12:00:00Z',
      })),
      mapShoppingItem(itemRow({ name: 'Pendente antigo' })),
      mapShoppingItem(itemRow({
        id: '44444444-4444-4444-8444-444444444447',
        name: 'Concluído novo',
        is_checked: true,
        checked_by: USER_ID,
        checked_at: '2026-08-26T13:00:00Z',
      })),
    ];

    assert.deepEqual(sortShoppingItems(items).map(({ name }) => name), [
      'Pendente antigo',
      'Pendente novo',
      'Concluído novo',
      'Concluído antigo',
    ]);
    assert.equal(items[0].name, 'Concluído antigo');
  });
});

describe('createShoppingItemService', () => {
  it('carrega, mapeia e ordena itens restritos à household e lista', async () => {
    const client = createListClient({
      data: [
        itemRow({
          id: '44444444-4444-4444-8444-444444444445',
          name: 'Segundo',
          created_at: '2026-08-26T12:00:00Z',
          updated_at: '2026-08-26T12:00:00Z',
        }),
        itemRow({ name: 'Primeiro' }),
      ],
      error: null,
    });
    const service = createShoppingItemService(client);

    const items = await service.listByList({ householdId: HOUSEHOLD_ID, listId: LIST_ID });

    assert.deepEqual(items.map(({ name }) => name), ['Primeiro', 'Segundo']);
    assert.deepEqual(client.calls.slice(-2), [
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'shopping_list_id', LIST_ID],
    ]);
  });

  it('cria payload completo com autoria e opcionais normalizados', async () => {
    const client = createInsertClient({ data: itemRow(), error: null });
    const service = createShoppingItemService(client);

    await service.create({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      userId: USER_ID,
      name: ' Leite ',
      quantity: '2,5',
      unit: ' L ',
      notes: ' Integral ',
    });

    assert.deepEqual(client.calls[1], ['insert', {
      household_id: HOUSEHOLD_ID,
      shopping_list_id: LIST_ID,
      created_by: USER_ID,
      name: 'Leite',
      quantity: 2.5,
      unit: 'L',
      notes: 'Integral',
    }]);
  });

  it('edita somente os campos mutáveis dentro da household e lista atuais', async () => {
    const client = createMutationClient({
      data: itemRow({ name: 'Leite sem lactose', quantity: null, unit: null, notes: null }),
      error: null,
    });
    const service = createShoppingItemService(client);

    const updated = await service.update({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
      name: ' Leite sem lactose ',
      quantity: '',
      unit: '',
      notes: '',
      createdBy: 'valor manipulado',
    });

    assert.equal(updated.name, 'Leite sem lactose');
    assert.deepEqual(client.calls.slice(0, 5), [
      ['from', 'shopping_items'],
      ['update', {
        name: 'Leite sem lactose',
        quantity: null,
        unit: null,
        notes: null,
      }],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'shopping_list_id', LIST_ID],
      ['eq', 'id', ITEM_ID],
    ]);
    assert.equal(client.calls[5][0], 'select');
    assert.equal(Object.hasOwn(client.calls[1][1], 'household_id'), false);
    assert.equal(Object.hasOwn(client.calls[1][1], 'created_by'), false);
  });

  it('marca e desmarca enviando apenas is_checked e recebe os metadados do banco', async () => {
    const checkedClient = createMutationClient({
      data: itemRow({
        is_checked: true,
        checked_by: USER_ID,
        checked_at: '2026-08-26T13:00:00Z',
      }),
      error: null,
    });
    const checked = await createShoppingItemService(checkedClient).setChecked({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
      isChecked: true,
    });

    assert.equal(checked.checkedBy, USER_ID);
    assert.deepEqual(checkedClient.calls[1], ['update', { is_checked: true }]);
    assert.equal(Object.hasOwn(checkedClient.calls[1][1], 'checked_by'), false);
    assert.equal(Object.hasOwn(checkedClient.calls[1][1], 'checked_at'), false);

    const uncheckedClient = createMutationClient({ data: itemRow(), error: null });
    const unchecked = await createShoppingItemService(uncheckedClient).setChecked({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
      isChecked: false,
    });
    assert.equal(unchecked.checkedBy, null);
    assert.deepEqual(uncheckedClient.calls[1], ['update', { is_checked: false }]);
  });

  it('remove pelo escopo completo e valida o identificador devolvido', async () => {
    const client = createMutationClient({ data: { id: ITEM_ID }, error: null });
    const service = createShoppingItemService(client);

    assert.equal(await service.remove({
      householdId: HOUSEHOLD_ID,
      listId: LIST_ID,
      itemId: ITEM_ID,
    }), ITEM_ID);
    assert.deepEqual(client.calls, [
      ['from', 'shopping_items'],
      ['delete'],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'shopping_list_id', LIST_ID],
      ['eq', 'id', ITEM_ID],
      ['select', 'id'],
      ['single'],
    ]);
  });

  it('rejeita estado de compra que não seja booleano', async () => {
    const service = createShoppingItemService(createMutationClient({ data: itemRow(), error: null }));

    await assert.rejects(
      service.setChecked({
        householdId: HOUSEHOLD_ID,
        listId: LIST_ID,
        itemId: ITEM_ID,
        isChecked: 'true',
      }),
      /estado de compra/i,
    );
  });

  it('normaliza falha do banco e rejeita cliente incompleto', async () => {
    const service = createShoppingItemService(createListClient({
      data: null,
      error: { code: '42501' },
    }));

    await assert.rejects(
      service.listByList({ householdId: HOUSEHOLD_ID, listId: LIST_ID }),
      /permissão/i,
    );
    assert.throws(() => createShoppingItemService({}), /cliente de banco/i);
  });
});
