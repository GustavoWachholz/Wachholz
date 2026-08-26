import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HouseholdError,
  createHouseholdService,
  validateUserId,
} from '../../js/household/household-service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';

function createDatabaseClient({ memberships = [], household = null } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      calls.push(['from', table]);

      if (table === 'household_members') {
        return {
          select(columns) {
            calls.push(['members.select', columns]);
            return this;
          },
          eq(column, value) {
            calls.push(['members.eq', column, value]);
            return this;
          },
          async limit(value) {
            calls.push(['members.limit', value]);
            return { data: memberships, error: null };
          },
        };
      }

      return {
        select(columns) {
          calls.push(['households.select', columns]);
          return this;
        },
        eq(column, value) {
          calls.push(['households.eq', column, value]);
          return this;
        },
        async single() {
          calls.push(['households.single']);
          return { data: household, error: null };
        },
      };
    },
  };
}

describe('validateUserId', () => {
  it('aceita UUID de usuário', () => {
    assert.equal(validateUserId(USER_ID), USER_ID);
  });

  it('rejeita identificador inválido', () => {
    assert.throws(
      () => validateUserId('user-1'),
      (error) => error instanceof HouseholdError && error.code === 'INVALID_USER',
    );
  });
});

describe('createHouseholdService', () => {
  it('carrega a única household do usuário autenticado', async () => {
    const client = createDatabaseClient({
      memberships: [{ household_id: HOUSEHOLD_ID }],
      household: { id: HOUSEHOLD_ID, name: 'Nossa Casa' },
    });
    const service = createHouseholdService(client);

    const household = await service.getActiveHousehold(USER_ID);

    assert.deepEqual(household, { id: HOUSEHOLD_ID, name: 'Nossa Casa' });
    assert.ok(Object.isFrozen(household));
    assert.deepEqual(client.calls, [
      ['from', 'household_members'],
      ['members.select', 'household_id'],
      ['members.eq', 'user_id', USER_ID],
      ['members.limit', 2],
      ['from', 'households'],
      ['households.select', 'id, name'],
      ['households.eq', 'id', HOUSEHOLD_ID],
      ['households.single'],
    ]);
  });

  it('informa quando o usuário não possui household', async () => {
    const service = createHouseholdService(createDatabaseClient());

    await assert.rejects(
      service.getActiveHousehold(USER_ID),
      (error) => error instanceof HouseholdError && error.code === 'HOUSEHOLD_NOT_FOUND',
    );
  });

  it('rejeita mais de uma household no MVP', async () => {
    const service = createHouseholdService(
      createDatabaseClient({
        memberships: [
          { household_id: HOUSEHOLD_ID },
          { household_id: '33333333-3333-4333-8333-333333333333' },
        ],
      }),
    );

    await assert.rejects(
      service.getActiveHousehold(USER_ID),
      (error) => error instanceof HouseholdError && error.code === 'MULTIPLE_HOUSEHOLDS',
    );
  });

  it('rejeita resposta incompleta da tabela households', async () => {
    const service = createHouseholdService(
      createDatabaseClient({
        memberships: [{ household_id: HOUSEHOLD_ID }],
        household: { id: HOUSEHOLD_ID, name: '' },
      }),
    );

    await assert.rejects(service.getActiveHousehold(USER_ID), /não está associado/);
  });

  it('rejeita cliente de banco incompleto', () => {
    assert.throws(() => createHouseholdService({}), /cliente de banco do Supabase/);
  });
});
