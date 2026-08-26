import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createFinancialCategoryService,
  isCategoryCompatible,
  mapFinancialCategory,
  validateFinanceType,
} from '../../js/modules/finance/services/financial-category-service.js';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '77777777-7777-4777-8777-777777777777';

function categoryRow(overrides = {}) {
  return {
    id: CATEGORY_ID,
    household_id: HOUSEHOLD_ID,
    name: '  Alimentação  ',
    type: 'expense',
    is_active: true,
    ...overrides,
  };
}

function createCategoryClient(result) {
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

describe('categorias financeiras', () => {
  it('mapeia categoria ativa e valida compatibilidade com o tipo', () => {
    const category = mapFinancialCategory(categoryRow());

    assert.equal(category.name, 'Alimentação');
    assert.equal(category.type, 'expense');
    assert.equal(isCategoryCompatible(category, 'expense'), true);
    assert.equal(isCategoryCompatible(category, 'income'), false);
    assert.ok(Object.isFrozen(category));
  });

  it('rejeita tipo desconhecido, categoria inativa e resposta incompleta', () => {
    assert.throws(() => validateFinanceType('transfer'), /tipo financeiro/i);
    assert.throws(() => mapFinancialCategory(categoryRow({ is_active: false })), /categoria/i);
    assert.throws(() => mapFinancialCategory(categoryRow({ id: 'inválido' })), /identificador/i);
  });
});

describe('createFinancialCategoryService', () => {
  it('consulta somente categorias ativas da household e do tipo atual', async () => {
    const client = createCategoryClient({ data: [categoryRow()], error: null });
    const categories = await createFinancialCategoryService(client).listByType({
      householdId: HOUSEHOLD_ID,
      type: 'expense',
    });

    assert.equal(categories[0].name, 'Alimentação');
    assert.ok(Object.isFrozen(categories));
    assert.deepEqual(client.calls, [
      ['from', 'financial_categories'],
      ['select', 'id, household_id, name, type, is_active'],
      ['eq', 'household_id', HOUSEHOLD_ID],
      ['eq', 'type', 'expense'],
      ['eq', 'is_active', true],
      ['order', 'name', { ascending: true }],
    ]);
  });

  it('descarta categoria devolvida fora do escopo solicitado', async () => {
    const client = createCategoryClient({
      data: [categoryRow({ type: 'income' })],
      error: null,
    });

    await assert.rejects(
      () => createFinancialCategoryService(client).listByType({
        householdId: HOUSEHOLD_ID,
        type: 'expense',
      }),
      /não correspondem ao filtro/i,
    );
  });

  it('normaliza falha do banco e valida o cliente', async () => {
    const failing = createCategoryClient({ data: null, error: { code: '42501' } });
    await assert.rejects(
      () => createFinancialCategoryService(failing).listByType({
        householdId: HOUSEHOLD_ID,
        type: 'expense',
      }),
      /permissão/i,
    );
    assert.throws(() => createFinancialCategoryService({}), /cliente de banco/i);
  });
});
