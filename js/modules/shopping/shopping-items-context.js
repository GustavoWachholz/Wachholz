import { sortShoppingItems } from './shopping-item-service.js';
import { reconcileShoppingItems } from './shopping-items-realtime.js';

function createState(
  status,
  {
    listId = null,
    items = [],
    error = null,
    formError = null,
    isSubmitting = false,
    notice = null,
    editingItemId = null,
    pendingItemId = null,
    operationError = null,
    realtimeError = null,
  } = {},
) {
  return Object.freeze({
    status,
    listId,
    items: Object.freeze([...items]),
    error,
    formError,
    isSubmitting,
    notice,
    editingItemId,
    pendingItemId,
    operationError,
    realtimeError,
  });
}

export function createShoppingItemsController({
  itemService,
  realtimeService = null,
  onStateChange = () => {},
}) {
  if (
    !itemService
    || typeof itemService.listByList !== 'function'
    || typeof itemService.create !== 'function'
    || typeof itemService.update !== 'function'
    || typeof itemService.setChecked !== 'function'
    || typeof itemService.remove !== 'function'
  ) {
    throw new TypeError('O serviço de itens de compras é obrigatório.');
  }

  if (realtimeService && typeof realtimeService.subscribe !== 'function') {
    throw new TypeError('O serviço Realtime dos itens de compras é inválido.');
  }

  let state = createState('idle');
  let requestVersion = 0;
  let realtimeVersion = 0;
  let unsubscribeRealtime = null;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  function readyState(overrides = {}) {
    return createState('ready', { ...state, ...overrides });
  }

  function stopRealtime() {
    realtimeVersion += 1;
    const unsubscribe = unsubscribeRealtime;
    unsubscribeRealtime = null;

    if (unsubscribe) {
      try {
        Promise.resolve(unsubscribe()).catch(() => {});
      } catch {
        // O canal já está sendo descartado; a próxima tela não deve ficar presa a ele.
      }
    }
  }

  function startRealtime(input) {
    if (!realtimeService) {
      return;
    }

    const currentRealtime = ++realtimeVersion;

    const reportRealtimeError = (realtimeError) => {
      if (
        currentRealtime === realtimeVersion
        && state.status === 'ready'
        && state.listId === input.listId
      ) {
        emit(readyState({ realtimeError }));
      }
    };

    try {
      unsubscribeRealtime = realtimeService.subscribe({
        householdId: input.householdId,
        listId: input.listId,
        onEvent: (event) => {
          if (
            currentRealtime !== realtimeVersion
            || state.status !== 'ready'
            || state.listId !== input.listId
          ) {
            return;
          }

          try {
            const items = reconcileShoppingItems(state.items, event, input);
            const itemIds = new Set(items.map((item) => item.id));
            emit(readyState({
              items,
              editingItemId: itemIds.has(state.editingItemId) ? state.editingItemId : null,
              realtimeError: null,
            }));
          } catch {
            reportRealtimeError(new Error(
              'Uma atualização automática inválida foi descartada com segurança.',
            ));
          }
        },
        onError: reportRealtimeError,
      });
    } catch (error) {
      reportRealtimeError(error);
    }
  }

  async function load(input) {
    stopRealtime();
    const currentRequest = ++requestVersion;
    emit(createState('loading', { listId: input?.listId ?? null }));

    try {
      const items = await itemService.listByList(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', { listId: input.listId, items }));
        startRealtime(input);
      }
    } catch (error) {
      if (currentRequest === requestVersion) {
        emit(createState('error', {
          listId: input?.listId ?? null,
          error,
        }));
      }
    }

    return state;
  }

  async function create(input) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.pendingItemId
      || input?.listId !== state.listId
    ) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      formError: null,
      isSubmitting: true,
      notice: null,
      operationError: null,
    }));

    try {
      const createdItem = await itemService.create(input);

      if (currentRequest === requestVersion) {
        emit(readyState({
          items: sortShoppingItems([
            ...state.items.filter((item) => item.id !== createdItem.id),
            createdItem,
          ]),
          formError: null,
          isSubmitting: false,
          notice: 'Item adicionado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(readyState({
          isSubmitting: false,
          formError,
        }));
      }
    }

    return state;
  }

  function startEdit(itemId) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.pendingItemId
      || !state.items.some((item) => item.id === itemId)
    ) {
      return state;
    }

    emit(readyState({
      editingItemId: itemId,
      formError: null,
      notice: null,
      operationError: null,
    }));
    return state;
  }

  function cancelEdit() {
    if (state.status !== 'ready' || state.pendingItemId) {
      return state;
    }

    emit(readyState({ editingItemId: null, formError: null }));
    return state;
  }

  function canMutate(input) {
    return state.status === 'ready'
      && !state.isSubmitting
      && !state.pendingItemId
      && input?.listId === state.listId
      && state.items.some((item) => item.id === input?.itemId);
  }

  async function update(input) {
    if (!canMutate(input)) {
      return state;
    }

    const currentRequest = ++requestVersion;
    const itemId = input.itemId;
    emit(readyState({
      editingItemId: itemId,
      formError: null,
      notice: null,
      operationError: null,
      pendingItemId: itemId,
    }));

    try {
      const updatedItem = await itemService.update(input);

      if (currentRequest === requestVersion) {
        emit(readyState({
          items: sortShoppingItems(state.items.map((item) => (
            item.id === updatedItem.id ? updatedItem : item
          ))),
          editingItemId: null,
          formError: null,
          pendingItemId: null,
          notice: 'Item atualizado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(readyState({
          editingItemId: itemId,
          pendingItemId: null,
          formError,
        }));
      }
    }

    return state;
  }

  async function setChecked(input) {
    if (!canMutate(input)) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      editingItemId: state.editingItemId,
      formError: null,
      notice: null,
      operationError: null,
      pendingItemId: input.itemId,
    }));

    try {
      const updatedItem = await itemService.setChecked(input);

      if (currentRequest === requestVersion) {
        emit(readyState({
          items: sortShoppingItems(state.items.map((item) => (
            item.id === updatedItem.id ? updatedItem : item
          ))),
          operationError: null,
          pendingItemId: null,
          notice: updatedItem.isChecked ? 'Item marcado como comprado.' : 'Item voltou para pendentes.',
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(readyState({
          editingItemId: state.editingItemId,
          pendingItemId: null,
          operationError,
        }));
      }
    }

    return state;
  }

  async function remove(input) {
    if (!canMutate(input)) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      editingItemId: state.editingItemId,
      formError: null,
      notice: null,
      operationError: null,
      pendingItemId: input.itemId,
    }));

    try {
      const removedId = await itemService.remove(input);

      if (currentRequest === requestVersion) {
        emit(readyState({
          items: state.items.filter((item) => item.id !== removedId),
          editingItemId: null,
          operationError: null,
          pendingItemId: null,
          notice: 'Item excluído.',
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(readyState({
          editingItemId: state.editingItemId,
          pendingItemId: null,
          operationError,
        }));
      }
    }

    return state;
  }

  function clear() {
    stopRealtime();
    requestVersion += 1;
    emit(createState('idle'));
  }

  return Object.freeze({
    cancelEdit,
    clear,
    create,
    getState: () => state,
    load,
    remove,
    setChecked,
    startEdit,
    update,
  });
}
