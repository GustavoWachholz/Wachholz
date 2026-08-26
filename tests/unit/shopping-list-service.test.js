import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHOPPING_LIST_NAME_MAX_LENGTH,
  ShoppingListError,
  createShoppingListService,
  mapShoppingList,
  validateShoppingListName,
  validateShoppingUuid,
} from '../../js/modules/shopping/shopping-list-service.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const LIST_ID = '33333333-3333-4333-8333-333333333333';

function createListClient(result) {
  const calls = [];
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
          return this;
        },
        async order(column, options) {
          calls.push(['order', column, options]);
          return result;
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

describe('validateShoppingListName', () => {
  it('remove espaços externos e normaliza espaços repetidos', () => {
    assert.equal(validateShoppingListName('  Mercado   da semana  '), 'Mercado da semana');
  });

  it('rejeita nome vazio ou acima do limite', () => {
    assert.throws(
      () => validateShoppingListName('   '),
      (error) => error instanceof ShoppingListError && error.code === 'INVALID_NAME',
    );
    assert.throws(
      () => validateShoppingListName('a'.repeat(SHOPPING_LIST_NAME_MAX_LENGTH + 1)),
      /no máximo 80 caracteres/i,
    );
  });
});

describe('validateShoppingUuid', () => {
  it('aceita UUID e rejeita identificador manipulado', () => {
    assert.equal(validateShoppingUuid(LIST_ID), LIST_ID);
    assert.throws(
      () => validateShoppingUuid('../outra-casa'),
      (error) => error instanceof ShoppingListError && error.code === 'INVALID_ID',
    );
  });
});

describe('mapShoppingList', () => {
  it('conta somente itens pendentes e congela o resultado', () => {
    const list = mapShoppingList({
      id: LIST_ID,
      name: 'Mercado',
      created_at: '2026-08-26T10:00:00Z',
      shopping_items: [
        { id: '1', is_checked: false },
        { id: '2', is_checked: true },
        { id: '3', is_checked: false },
      ],
    });

    assert.deepEqual(list, {
      id: LIST_ID,
      name: 'Mercado',
      pendingItems: 2,
      createdAt: '2026-08-26T10:00:00Z',
    });
    assert.ok(Object.isFrozen(list));
  });
});

describe('createShoppingListService', () => {
  it('lista somente listas ativas da household com seus itens', async () => {
    const client = createListClient({
      data: [{
        id: LIST_ID,
        name: 'Mercado',
        created_at: '2026-08-26T10:00:00Z',
        shopping_items: [{ is_checked: false }],
      }],
      error: null,
    });
    const service = createShoppingListService(client);

    const lists = await service.listActive(HOUSEHOLD_ID);

    assert.equal(lists[0].pendingItems, 1);
    assert.ok(Object.isFrozen(lists));
    assert.deepEqual(client.calls, [
      ['from', 'shopping_lists'],
      ['select', 'id, name, created_at, shopping_items(id, is_checked)'],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'is_active', true],
      ['order', 'created_at', { ascending: true }],
    ]);
  });

  it('cria lista atribuindo household e autoria autenticada', async () => {
    const client = createInsertClient({
      data: { id: LIST_ID, name: 'Feira', created_at: '2026-08-26T10:00:00Z' },
      error: null,
    });
    const service = createShoppingListService(client);

    const list = await service.create({
      householdId: HOUSEHOLD_ID,
      userId: USER_ID,
      name: '  Feira  ',
    });

    assert.equal(list.pendingItems, 0);
    assert.deepEqual(client.calls, [
      ['from', 'shopping_lists'],
      ['insert', {
        household_id: HOUSEHOLD_ID,
        created_by: USER_ID,
        name: 'Feira',
      }],
      ['select', 'id, name, created_at'],
      ['single'],
    ]);
  });

  it('normaliza falha do Supabase e rejeita cliente incompleto', async () => {
    const service = createShoppingListService(createListClient({
      data: null,
      error: { code: '42501' },
    }));

    await assert.rejects(service.listActive(HOUSEHOLD_ID), /permissão/i);
    assert.throws(() => createShoppingListService({}), /cliente de banco/i);
  });
});
