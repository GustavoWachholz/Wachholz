import { unwrapSupabaseResult } from '../../../lib/supabase-result.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FINANCE_TYPES = Object.freeze(['income', 'expense']);

export class FinancialCategoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FinancialCategoryError';
    this.code = code;
  }
}

export function validateFinanceUuid(value, field = 'identificador') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new FinancialCategoryError('INVALID_ID', `O ${field} financeiro é inválido.`);
  }

  return value;
}

export function validateFinanceType(value) {
  if (!FINANCE_TYPES.includes(value)) {
    throw new FinancialCategoryError('INVALID_TYPE', 'O tipo financeiro é inválido.');
  }

  return value;
}

export function mapFinancialCategory(row) {
  const name = String(row?.name ?? '').trim().replace(/\s+/g, ' ');

  if (!name || row?.is_active !== true) {
    throw new FinancialCategoryError('INVALID_RESPONSE', 'A categoria financeira é inválida.');
  }

  return Object.freeze({
    id: validateFinanceUuid(row.id, 'identificador da categoria'),
    householdId: validateFinanceUuid(row.household_id, 'identificador da household'),
    name,
    type: validateFinanceType(row.type),
    isActive: true,
  });
}

export function isCategoryCompatible(category, type) {
  return Boolean(category) && category.type === validateFinanceType(type);
}

export function createFinancialCategoryService(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('O cliente de banco do Supabase é obrigatório.');
  }

  async function listByType({ householdId, type }) {
    const validHouseholdId = validateFinanceUuid(householdId, 'identificador da household');
    const validType = validateFinanceType(type);
    const result = await client
      .from('financial_categories')
      .select('id, household_id, name, type, is_active')
      .eq('household_id', validHouseholdId)
      .eq('type', validType)
      .eq('is_active', true)
      .order('name', { ascending: true });
    const rows = unwrapSupabaseResult(result, { operation: 'carregar as categorias financeiras' });

    if (!Array.isArray(rows)) {
      throw new FinancialCategoryError(
        'INVALID_RESPONSE',
        'As categorias financeiras não puderam ser carregadas.',
      );
    }

    const categories = rows.map(mapFinancialCategory);

    if (categories.some((category) => (
      category.householdId !== validHouseholdId || category.type !== validType
    ))) {
      throw new FinancialCategoryError(
        'INVALID_SCOPE',
        'As categorias recebidas não correspondem ao filtro atual.',
      );
    }

    return Object.freeze(categories);
  }

  return Object.freeze({ listByType });
}
