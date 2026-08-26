import { sortShoppingItems } from './shopping-item-service.js';

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
  });
}

export function createShoppingItemsController({ itemService, onStateChange = () => {} }) {
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

  let state = createState('idle');
  let requestVersion = 0;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  async function load(input) {
    const currentRequest = ++requestVersion;
    emit(createState('loading', { listId: input?.listId ?? null }));

    try {
      const items = await itemService.listByList(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', { listId: input.listId, items }));
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
    const currentItems = state.items;
    emit(createState('ready', {
      listId: state.listId,
      items: currentItems,
      isSubmitting: true,
    }));

    try {
      const createdItem = await itemService.create(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: sortShoppingItems([...currentItems, createdItem]),
          notice: 'Item adicionado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: currentItems,
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

    emit(createState('ready', {
      listId: state.listId,
      items: state.items,
      editingItemId: itemId,
    }));
    return state;
  }

  function cancelEdit() {
    if (state.status !== 'ready' || state.pendingItemId) {
      return state;
    }

    emit(createState('ready', {
      listId: state.listId,
      items: state.items,
    }));
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
    const currentItems = state.items;
    const itemId = input.itemId;
    emit(createState('ready', {
      listId: state.listId,
      items: currentItems,
      editingItemId: itemId,
      pendingItemId: itemId,
    }));

    try {
      const updatedItem = await itemService.update(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: sortShoppingItems(currentItems.map((item) => (
            item.id === updatedItem.id ? updatedItem : item
          ))),
          notice: 'Item atualizado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: currentItems,
          editingItemId: itemId,
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
    const currentItems = state.items;
    emit(createState('ready', {
      listId: state.listId,
      items: currentItems,
      editingItemId: state.editingItemId,
      pendingItemId: input.itemId,
    }));

    try {
      const updatedItem = await itemService.setChecked(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: sortShoppingItems(currentItems.map((item) => (
            item.id === updatedItem.id ? updatedItem : item
          ))),
          notice: updatedItem.isChecked ? 'Item marcado como comprado.' : 'Item voltou para pendentes.',
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: currentItems,
          editingItemId: state.editingItemId,
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
    const currentItems = state.items;
    emit(createState('ready', {
      listId: state.listId,
      items: currentItems,
      editingItemId: state.editingItemId,
      pendingItemId: input.itemId,
    }));

    try {
      const removedId = await itemService.remove(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: currentItems.filter((item) => item.id !== removedId),
          notice: 'Item excluído.',
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          listId: state.listId,
          items: currentItems,
          editingItemId: state.editingItemId,
          operationError,
        }));
      }
    }

    return state;
  }

  function clear() {
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
