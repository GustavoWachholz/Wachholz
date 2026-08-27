import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createFinancialTransactionService,
  filterFinancialTransactions,
  mapFinancialTransaction,
  sortFinancialTransactions,
  validateFinancialTransactionInput,
} from '../../js/modules/finance/services/financial-transaction-service.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '77777777-7777-4777-8777-777777777777';
const TRANSACTION_ID = '99999999-9999-4999-8999-999999999999';
const PERIOD = Object.freeze({ year: 2026, month: 8 });
const CATEGORY = Object.freeze({
  id: CATEGORY_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alimentação',
  type: 'expense',
  isActive: true,
});

function transactionRow(overrides = {}) {
  const type = overrides.type ?? 'expense';
  const categoryName = type === 'income' ? 'Salário' : 'Alimentação';
  return {
    id: TRANSACTION_ID,
    household_id: HOUSEHOLD_ID,
    category_id: CATEGORY_ID,
    created_by: USER_ID,
    type,
    description: 'Supermercado',
    amount: '183.49',
    transaction_date: '2026-08-10',
    notes: 'Compra da semana',
    created_at: '2026-08-10T12:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    financial_categories: {
      id: CATEGORY_ID,
      household_id: HOUSEHOLD_ID,
      name: categoryName,
      type,
      is_active: true,
    },
    ...overrides,
  };
}

function createListClient(result) {
  const calls = [];
  let orderCalls = 0;
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    gte(column, value) { calls.push(['gte', column, value]); return this; },
    lt(column, value) { calls.push(['lt', column, value]); return this; },
    order(column, options) {
      calls.push(['order', column, options]);
      orderCalls += 1;
      return orderCalls === 2 ? Promise.resolve(result) : this;
    },
  };
  return {
    calls,
    from(table) { calls.push(['from', table]); return query; },
  };
}

function createInsertClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        insert(payload) { calls.push(['insert', payload]); return this; },
        select(columns) { calls.push(['select', columns]); return this; },
        async single() { calls.push(['single']); return result; },
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
        update(payload) { calls.push(['update', payload]); return this; },
        delete() { calls.push(['delete']); return this; },
        eq(column, value) { calls.push(['eq', column, value]); return this; },
        select(columns) { calls.push(['select', columns]); return this; },
        async single() { calls.push(['single']); return result; },
      };
    },
  };
}

describe('validateFinancialTransactionInput', () => {
  it('normaliza descrição, centavos, data, categoria e observação', () => {
    const input = validateFinancialTransactionInput({
      type: 'expense',
      description: '  Mercado   da semana ',
      amount: '1.234,56',
      transactionDate: '2026-08-20',
      categoryId: CATEGORY_ID,
      notes: '  Compra   mensal ',
    }, { categories: [CATEGORY], period: PERIOD });

    assert.deepEqual(input, {
      type: 'expense',
      description: 'Mercado da semana',
      amountCents: 123456,
      amount: '1234.56',
      transactionDate: '2026-08-20',
      categoryId: CATEGORY_ID,
      notes: 'Compra mensal',
    });
  });

  it('rejeita descrição, valor, data e categoria incompatíveis', () => {
    const base = {
      type: 'expense',
      description: 'Mercado',
      amount: '10,00',
      transactionDate: '2026-08-20',
      categoryId: CATEGORY_ID,
    };

    assert.throws(() => validateFinancialTransactionInput(
      { ...base, description: '' }, { categories: [CATEGORY], period: PERIOD },
    ), /descrição/i);
    assert.throws(() => validateFinancialTransactionInput(
      { ...base, amount: '0,00' }, { categories: [CATEGORY], period: PERIOD },
    ), /maior que zero/i);
    assert.throws(() => validateFinancialTransactionInput(
      { ...base, transactionDate: '2026-09-01' }, { categories: [CATEGORY], period: PERIOD },
    ), /mês selecionado/i);
    assert.throws(() => validateFinancialTransactionInput(
      { ...base, type: 'income' }, { categories: [CATEGORY], period: PERIOD },
    ), /categoria compatível/i);
  });
});

describe('mapFinancialTransaction e ordenação', () => {
  it('mapeia numeric para centavos e relação de categoria', () => {
    const transaction = mapFinancialTransaction(transactionRow());

    assert.equal(transaction.amountCents, 18349);
    assert.equal(transaction.categoryName, 'Alimentação');
    assert.equal(transaction.transactionDate, '2026-08-10');
    assert.ok(Object.isFrozen(transaction));
  });

  it('preserva o histórico quando a categoria relacionada foi desativada', () => {
    const row = transactionRow();
    row.financial_categories.is_active = false;

    assert.equal(mapFinancialTransaction(row).categoryName, 'Alimentação');
  });

  it('ordena por data e criação decrescentes', () => {
    const older = mapFinancialTransaction(transactionRow({
      id: '99999999-9999-4999-8999-999999999998',
      transaction_date: '2026-08-05',
    }));
    const newest = mapFinancialTransaction(transactionRow({
      id: '99999999-9999-4999-8999-999999999997',
      created_at: '2026-08-10T13:00:00Z',
      updated_at: '2026-08-10T13:00:00Z',
    }));
    const current = mapFinancialTransaction(transactionRow());

    assert.deepEqual(
      sortFinancialTransactions([older, current, newest]).map(({ id }) => id),
      [newest.id, current.id, older.id],
    );
  });

  it('rejeita relação de categoria inconsistente', () => {
    assert.throws(() => mapFinancialTransaction(transactionRow({
      financial_categories: {
        ...transactionRow().financial_categories,
        type: 'income',
      },
    })), /categoria.*inconsistente/i);
  });

  it('combina filtros de tipo e categoria sem alterar a coleção original', () => {
    const expense = mapFinancialTransaction(transactionRow());
    const income = mapFinancialTransaction(transactionRow({
      id: '99999999-9999-4999-8999-999999999997',
      type: 'income',
    }));
    const transactions = [expense, income];

    assert.deepEqual(
      filterFinancialTransactions(transactions, { type: 'income' }),
      [income],
    );
    assert.deepEqual(
      filterFinancialTransactions(transactions, { type: 'expense', categoryId: CATEGORY_ID }),
      [expense],
    );
    assert.equal(transactions.length, 2);
    assert.throws(
      () => filterFinancialTransactions(transactions, { categoryId: 'inválido' }),
      /categoria/i,
    );
  });
});

describe('createFinancialTransactionService', () => {
  it('lista somente o mês e household atuais com ordenação cronológica', async () => {
    const client = createListClient({ data: [transactionRow()], error: null });
    const transactions = await createFinancialTransactionService(client).listByPeriod({
      householdId: HOUSEHOLD_ID,
      period: PERIOD,
    });

    assert.equal(transactions[0].description, 'Supermercado');
    assert.deepEqual(client.calls.slice(0, 6), [
      ['from', 'financial_transactions'],
      ['select', client.calls[1][1]],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['gte', 'transaction_date', '2026-08-01'],
      ['lt', 'transaction_date', '2026-09-01'],
      ['order', 'transaction_date', { ascending: false }],
    ]);
    assert.deepEqual(client.calls.at(-1), ['order', 'created_at', { ascending: false }]);
  });

  it('descarta resposta fora do período mesmo se o banco estiver mal simulado', async () => {
    const client = createListClient({
      data: [transactionRow({ transaction_date: '2026-09-01' })],
      error: null,
    });

    await assert.rejects(
      () => createFinancialTransactionService(client).listByPeriod({
        householdId: HOUSEHOLD_ID,
        period: PERIOD,
      }),
      /não correspondem ao período/i,
    );
  });

  it('cria payload PostgreSQL sem float e valida a resposta', async () => {
    const client = createInsertClient({ data: transactionRow(), error: null });
    const transaction = await createFinancialTransactionService(client).create({
      householdId: HOUSEHOLD_ID,
      userId: USER_ID,
      period: PERIOD,
      categories: [CATEGORY],
      type: 'expense',
      description: 'Supermercado',
      amount: '183,49',
      transactionDate: '2026-08-10',
      categoryId: CATEGORY_ID,
      notes: 'Compra da semana',
    });

    assert.equal(transaction.amountCents, 18349);
    assert.deepEqual(client.calls[1], ['insert', {
      household_id: HOUSEHOLD_ID,
      created_by: USER_ID,
      category_id: CATEGORY_ID,
      type: 'expense',
      description: 'Supermercado',
      amount: '183.49',
      transaction_date: '2026-08-10',
      notes: 'Compra da semana',
    }]);
  });

  it('rejeita uma resposta de criação diferente do payload validado', async () => {
    const client = createInsertClient({
      data: transactionRow({ amount: '999.99' }),
      error: null,
    });

    await assert.rejects(
      () => createFinancialTransactionService(client).create({
        householdId: HOUSEHOLD_ID,
        userId: USER_ID,
        period: PERIOD,
        categories: [CATEGORY],
        type: 'expense',
        description: 'Supermercado',
        amount: '183,49',
        transactionDate: '2026-08-10',
        categoryId: CATEGORY_ID,
        notes: 'Compra da semana',
      }),
      /não corresponde à solicitação/i,
    );
  });

  it('edita somente campos mutáveis no escopo atual e valida a resposta', async () => {
    const client = createMutationClient({
      data: transactionRow({
        description: 'Supermercado mensal',
        amount: '200.00',
        notes: null,
        updated_at: '2026-08-27T12:00:00Z',
      }),
      error: null,
    });
    const updated = await createFinancialTransactionService(client).update({
      householdId: HOUSEHOLD_ID,
      transactionId: TRANSACTION_ID,
      period: PERIOD,
      categories: [CATEGORY],
      type: 'expense',
      description: ' Supermercado mensal ',
      amount: '200,00',
      transactionDate: '2026-08-10',
      categoryId: CATEGORY_ID,
      notes: '',
      createdBy: 'valor manipulado',
    });

    assert.equal(updated.amountCents, 20000);
    assert.deepEqual(client.calls.slice(0, 4), [
      ['from', 'financial_transactions'],
      ['update', {
        category_id: CATEGORY_ID,
        type: 'expense',
        description: 'Supermercado mensal',
        amount: '200.00',
        transaction_date: '2026-08-10',
        notes: null,
      }],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'id', TRANSACTION_ID],
    ]);
    assert.equal(Object.hasOwn(client.calls[1][1], 'created_by'), false);
    assert.equal(Object.hasOwn(client.calls[1][1], 'household_id'), false);
  });

  it('exclui pelo ID e household e valida o identificador devolvido', async () => {
    const client = createMutationClient({ data: { id: TRANSACTION_ID }, error: null });
    const removedId = await createFinancialTransactionService(client).remove({
      householdId: HOUSEHOLD_ID,
      transactionId: TRANSACTION_ID,
    });

    assert.equal(removedId, TRANSACTION_ID);
    assert.deepEqual(client.calls, [
      ['from', 'financial_transactions'],
      ['delete'],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'id', TRANSACTION_ID],
      ['select', 'id'],
      ['single'],
    ]);
  });

  it('normaliza falha do banco e valida o cliente', async () => {
    const client = createListClient({ data: null, error: { code: '42501' } });
    await assert.rejects(
      () => createFinancialTransactionService(client).listByPeriod({
        householdId: HOUSEHOLD_ID,
        period: PERIOD,
      }),
      /permissão/i,
    );
    assert.throws(() => createFinancialTransactionService({}), /cliente de banco/i);
  });
});
