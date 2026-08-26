import { validateShoppingUuid } from './shopping-list-service.js';
import { mapShoppingItem, sortShoppingItems } from './shopping-item-service.js';

const REALTIME_EVENTS = Object.freeze(['INSERT', 'UPDATE', 'DELETE']);
const FAILURE_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT']);

export class ShoppingItemsRealtimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ShoppingItemsRealtimeError';
    this.code = code;
  }
}

function unchanged(items) {
  return Object.freeze([...items]);
}

export function reconcileShoppingItems(items, event, { householdId, listId }) {
  const currentItems = Array.isArray(items) ? items : [];
  const validHouseholdId = validateShoppingUuid(householdId, 'identificador da household');
  const validListId = validateShoppingUuid(listId, 'identificador da lista');
  const eventType = String(event?.type ?? '').toUpperCase();

  if (!REALTIME_EVENTS.includes(eventType)) {
    return unchanged(currentItems);
  }

  if (eventType === 'DELETE') {
    const removedId = validateShoppingUuid(
      event?.oldRecord?.id,
      'identificador do item excluído',
    );
    const belongsToCurrentScope = currentItems.some((item) => (
      item.id === removedId
      && item.householdId === validHouseholdId
      && item.listId === validListId
    ));

    return belongsToCurrentScope
      ? sortShoppingItems(currentItems.filter((item) => item.id !== removedId))
      : unchanged(currentItems);
  }

  const row = event?.newRecord;

  if (row?.household_id !== validHouseholdId || row?.shopping_list_id !== validListId) {
    return unchanged(currentItems);
  }

  const incomingItem = mapShoppingItem(row);
  const withoutDuplicate = currentItems.filter((item) => item.id !== incomingItem.id);
  return sortShoppingItems([...withoutDuplicate, incomingItem]);
}

export function createShoppingItemsRealtime(client) {
  if (
    !client
    || typeof client.channel !== 'function'
    || typeof client.removeChannel !== 'function'
  ) {
    throw new TypeError('O cliente Realtime do Supabase é obrigatório.');
  }

  function subscribe({ householdId, listId, onEvent, onError = () => {} }) {
    const validHouseholdId = validateShoppingUuid(householdId, 'identificador da household');
    const validListId = validateShoppingUuid(listId, 'identificador da lista');

    if (typeof onEvent !== 'function' || typeof onError !== 'function') {
      throw new TypeError('Os callbacks de eventos Realtime são obrigatórios.');
    }

    const filter = `shopping_list_id=eq.${validListId}`;
    const channel = client.channel(`shopping-items:${validHouseholdId}:${validListId}`);

    if (!channel || typeof channel.on !== 'function' || typeof channel.subscribe !== 'function') {
      throw new ShoppingItemsRealtimeError(
        'INVALID_CHANNEL',
        'Não foi possível preparar a sincronização automática.',
      );
    }

    REALTIME_EVENTS.forEach((eventType) => {
      channel.on(
        'postgres_changes',
        {
          event: eventType,
          schema: 'public',
          table: 'shopping_items',
          filter,
        },
        (payload) => onEvent(Object.freeze({
          type: eventType,
          newRecord: payload?.new ?? null,
          oldRecord: payload?.old ?? null,
        })),
      );
    });

    channel.subscribe((status) => {
      if (FAILURE_STATUSES.has(status)) {
        onError(new ShoppingItemsRealtimeError(
          'SUBSCRIPTION_FAILED',
          'A sincronização automática está temporariamente indisponível.',
        ));
      }
    });

    let isRemoved = false;
    return () => {
      if (isRemoved) {
        return undefined;
      }

      isRemoved = true;
      return client.removeChannel(channel);
    };
  }

  return Object.freeze({ subscribe });
}
