import { unwrapSupabaseResult } from '../../lib/supabase-result.js';
import { validateShoppingUuid } from './shopping-list-service.js';

export const SHOPPING_ITEM_LIMITS = Object.freeze({
  name: 120,
  unit: 30,
  notes: 500,
});

const ITEM_COLUMNS = [
  'id',
  'shopping_list_id',
  'household_id',
  'name',
  'quantity',
  'unit',
  'notes',
  'is_checked',
  'created_by',
  'checked_by',
  'checked_at',
  'created_at',
  'updated_at',
].join(', ');

export class ShoppingItemError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ShoppingItemError';
    this.code = code;
  }
}

function normalizeRequiredText(value, field, maxLength) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');

  if (!text) {
    throw new ShoppingItemError('INVALID_ITEM', `Informe ${field}.`);
  }

  if (text.length > maxLength) {
    throw new ShoppingItemError('INVALID_ITEM', `${field} deve ter no máximo ${maxLength} caracteres.`);
  }

  return text;
}

function normalizeOptionalText(value, field, maxLength) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new ShoppingItemError('INVALID_ITEM', `${field} deve ter no máximo ${maxLength} caracteres.`);
  }

  return text;
}

export function validateShoppingItemInput(value = {}) {
  const rawQuantity = String(value.quantity ?? '').trim().replace(',', '.');
  const quantity = rawQuantity ? Number(rawQuantity) : null;

  if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
    throw new ShoppingItemError(
      'INVALID_QUANTITY',
      'A quantidade deve ser um número maior que zero.',
    );
  }

  return Object.freeze({
    name: normalizeRequiredText(value.name, 'o nome do item', SHOPPING_ITEM_LIMITS.name),
    quantity,
    unit: normalizeOptionalText(value.unit, 'A unidade', SHOPPING_ITEM_LIMITS.unit),
    notes: normalizeOptionalText(value.notes, 'A observação', SHOPPING_ITEM_LIMITS.notes),
  });
}

function validateTimestamp(value, field, { optional = false } = {}) {
  if (optional && value === null) {
    return null;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ShoppingItemError('INVALID_RESPONSE', `${field} do item é inválida.`);
  }

  return value;
}

export function mapShoppingItem(row) {
  if (typeof row?.is_checked !== 'boolean') {
    throw new ShoppingItemError('INVALID_RESPONSE', 'O estado do item é inválido.');
  }

  const input = validateShoppingItemInput(row);
  const hasCheckMetadata = row.checked_by !== null && row.checked_at !== null;

  if (row.is_checked !== hasCheckMetadata) {
    throw new ShoppingItemError('INVALID_RESPONSE', 'Os dados de conclusão do item são inválidos.');
  }

  return Object.freeze({
    id: validateShoppingUuid(row.id, 'identificador do item'),
    listId: validateShoppingUuid(row.shopping_list_id, 'identificador da lista'),
    householdId: validateShoppingUuid(row.household_id, 'identificador da household'),
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    notes: input.notes,
    isChecked: row.is_checked,
    createdBy: validateShoppingUuid(row.created_by, 'identificador do autor'),
    checkedBy: row.checked_by === null
      ? null
      : validateShoppingUuid(row.checked_by, 'identificador de quem marcou'),
    checkedAt: validateTimestamp(row.checked_at, 'A data de conclusão', { optional: true }),
    createdAt: validateTimestamp(row.created_at, 'A data de criação'),
    updatedAt: validateTimestamp(row.updated_at, 'A data de atualização'),
  });
}

function timestampValue(value) {
  return value ? Date.parse(value) : 0;
}

export function sortShoppingItems(items) {
  return Object.freeze([...items].sort((left, right) => {
    if (left.isChecked !== right.isChecked) {
      return left.isChecked ? 1 : -1;
    }

    const dateDifference = left.isChecked
      ? timestampValue(right.checkedAt) - timestampValue(left.checkedAt)
      : timestampValue(left.createdAt) - timestampValue(right.createdAt);

    return dateDifference || left.id.localeCompare(right.id);
  }));
}

export function createShoppingItemService(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('O cliente de banco do Supabase é obrigatório.');
  }

  async function listByList({ householdId, listId }) {
    const result = await client
      .from('shopping_items')
      .select(ITEM_COLUMNS)
      .eq('household_id', validateShoppingUuid(householdId, 'identificador da household'))
      .eq('shopping_list_id', validateShoppingUuid(listId, 'identificador da lista'));
    const rows = unwrapSupabaseResult(result, { operation: 'carregar os itens da lista' });

    if (!Array.isArray(rows)) {
      throw new ShoppingItemError('INVALID_RESPONSE', 'Os itens da lista não puderam ser carregados.');
    }

    return sortShoppingItems(rows.map(mapShoppingItem));
  }

  async function create({ householdId, listId, userId, ...input }) {
    const normalizedInput = validateShoppingItemInput(input);
    const payload = {
      household_id: validateShoppingUuid(householdId, 'identificador da household'),
      shopping_list_id: validateShoppingUuid(listId, 'identificador da lista'),
      created_by: validateShoppingUuid(userId, 'identificador do usuário'),
      ...normalizedInput,
    };
    const result = await client
      .from('shopping_items')
      .insert(payload)
      .select(ITEM_COLUMNS)
      .single();
    const row = unwrapSupabaseResult(result, { operation: 'adicionar o item' });

    return mapShoppingItem(row);
  }

  async function update({ householdId, listId, itemId, ...input }) {
    const payload = validateShoppingItemInput(input);
    const result = await client
      .from('shopping_items')
      .update(payload)
      .eq('household_id', validateShoppingUuid(householdId, 'identificador da household'))
      .eq('shopping_list_id', validateShoppingUuid(listId, 'identificador da lista'))
      .eq('id', validateShoppingUuid(itemId, 'identificador do item'))
      .select(ITEM_COLUMNS)
      .single();
    const row = unwrapSupabaseResult(result, { operation: 'editar o item' });

    return mapShoppingItem(row);
  }

  async function setChecked({ householdId, listId, itemId, isChecked }) {
    if (typeof isChecked !== 'boolean') {
      throw new ShoppingItemError('INVALID_CHECKED_STATE', 'O estado de compra do item é inválido.');
    }

    const result = await client
      .from('shopping_items')
      .update({ is_checked: isChecked })
      .eq('household_id', validateShoppingUuid(householdId, 'identificador da household'))
      .eq('shopping_list_id', validateShoppingUuid(listId, 'identificador da lista'))
      .eq('id', validateShoppingUuid(itemId, 'identificador do item'))
      .select(ITEM_COLUMNS)
      .single();
    const row = unwrapSupabaseResult(result, {
      operation: isChecked ? 'marcar o item como comprado' : 'desmarcar o item',
    });

    return mapShoppingItem(row);
  }

  async function remove({ householdId, listId, itemId }) {
    const validItemId = validateShoppingUuid(itemId, 'identificador do item');
    const result = await client
      .from('shopping_items')
      .delete()
      .eq('household_id', validateShoppingUuid(householdId, 'identificador da household'))
      .eq('shopping_list_id', validateShoppingUuid(listId, 'identificador da lista'))
      .eq('id', validItemId)
      .select('id')
      .single();
    const row = unwrapSupabaseResult(result, { operation: 'excluir o item' });
    const removedId = validateShoppingUuid(row?.id, 'identificador do item excluído');

    if (removedId !== validItemId) {
      throw new ShoppingItemError('INVALID_RESPONSE', 'O item excluído não corresponde à solicitação.');
    }

    return removedId;
  }

  return Object.freeze({ create, listByList, remove, setChecked, update });
}
