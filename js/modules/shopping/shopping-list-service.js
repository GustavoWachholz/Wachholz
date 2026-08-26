import { unwrapSupabaseResult } from '../../lib/supabase-result.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHOPPING_LIST_NAME_MAX_LENGTH = 80;

export class ShoppingListError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ShoppingListError';
    this.code = code;
  }
}

export function validateShoppingListName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');

  if (!name) {
    throw new ShoppingListError('INVALID_NAME', 'Informe um nome para a lista.');
  }

  if (name.length > SHOPPING_LIST_NAME_MAX_LENGTH) {
    throw new ShoppingListError(
      'INVALID_NAME',
      `Use no máximo ${SHOPPING_LIST_NAME_MAX_LENGTH} caracteres.`,
    );
  }

  return name;
}

export function validateShoppingUuid(value, fieldName = 'identificador') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ShoppingListError(
      'INVALID_ID',
      `O ${fieldName} da lista de compras é inválido.`,
    );
  }

  return value;
}

export function mapShoppingList(row) {
  const id = validateShoppingUuid(row?.id, 'identificador');
  const name = validateShoppingListName(row?.name);
  const items = Array.isArray(row?.shopping_items) ? row.shopping_items : [];
  const pendingItems = items.filter((item) => item?.is_checked === false).length;

  return Object.freeze({
    id,
    name,
    pendingItems,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : null,
  });
}

export function createShoppingListService(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('O cliente de banco do Supabase é obrigatório.');
  }

  async function listActive(householdId) {
    const validHouseholdId = validateShoppingUuid(householdId, 'identificador da household');
    const result = await client
      .from('shopping_lists')
      .select('id, name, created_at, shopping_items(id, is_checked)')
      .eq('household_id', validHouseholdId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    const rows = unwrapSupabaseResult(result, { operation: 'carregar as listas de compras' });

    if (!Array.isArray(rows)) {
      throw new ShoppingListError('INVALID_RESPONSE', 'As listas de compras não puderam ser carregadas.');
    }

    return Object.freeze(rows.map(mapShoppingList));
  }

  async function create({ householdId, userId, name }) {
    const payload = {
      household_id: validateShoppingUuid(householdId, 'identificador da household'),
      created_by: validateShoppingUuid(userId, 'identificador do usuário'),
      name: validateShoppingListName(name),
    };
    const result = await client
      .from('shopping_lists')
      .insert(payload)
      .select('id, name, created_at')
      .single();
    const row = unwrapSupabaseResult(result, { operation: 'criar a lista de compras' });

    return mapShoppingList({ ...row, shopping_items: [] });
  }

  return Object.freeze({ create, listActive });
}
