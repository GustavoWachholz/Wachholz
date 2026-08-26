function createState(
  status,
  {
    lists = [],
    error = null,
    formError = null,
    isSubmitting = false,
    notice = null,
  } = {},
) {
  return Object.freeze({
    status,
    lists: Object.freeze([...lists]),
    error,
    formError,
    isSubmitting,
    notice,
  });
}

export function createShoppingListsController({ listService, onStateChange = () => {} }) {
  if (
    !listService
    || typeof listService.listActive !== 'function'
    || typeof listService.create !== 'function'
  ) {
    throw new TypeError('O serviço de listas de compras é obrigatório.');
  }

  let state = createState('idle');
  let requestVersion = 0;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  async function load(householdId) {
    const currentRequest = ++requestVersion;
    emit(createState('loading'));

    try {
      const lists = await listService.listActive(householdId);

      if (currentRequest === requestVersion) {
        emit(createState('ready', { lists }));
      }
    } catch (error) {
      if (currentRequest === requestVersion) {
        emit(createState('error', { error }));
      }
    }

    return state;
  }

  async function create(input) {
    if (state.status !== 'ready' || state.isSubmitting) {
      return state;
    }

    const currentRequest = ++requestVersion;
    const currentLists = state.lists;
    emit(createState('ready', { lists: currentLists, isSubmitting: true }));

    try {
      const createdList = await listService.create(input);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          lists: [...currentLists, createdList],
          notice: 'Lista criada com sucesso.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(createState('ready', { lists: currentLists, formError }));
      }
    }

    return state;
  }

  function clear() {
    requestVersion += 1;
    emit(createState('idle'));
  }

  function setPendingCount(listId, pendingItems) {
    if (
      state.status !== 'ready'
      || !Number.isInteger(pendingItems)
      || pendingItems < 0
    ) {
      return false;
    }

    const listIndex = state.lists.findIndex((list) => list.id === listId);

    if (listIndex < 0 || state.lists[listIndex].pendingItems === pendingItems) {
      return false;
    }

    const lists = state.lists.map((list, index) => (
      index === listIndex ? Object.freeze({ ...list, pendingItems }) : list
    ));
    emit(createState('ready', { lists }));
    return true;
  }

  return Object.freeze({
    clear,
    create,
    getState: () => state,
    load,
    setPendingCount,
  });
}
