function createState(status, { household = null, error = null } = {}) {
  return Object.freeze({
    status,
    household,
    householdId: household?.id ?? null,
    error,
  });
}

export function createHouseholdController({ householdService, onStateChange = () => {} }) {
  if (!householdService || typeof householdService.getActiveHousehold !== 'function') {
    throw new TypeError('O serviço de household é obrigatório.');
  }

  let state = createState('idle');
  let requestVersion = 0;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  async function load(user) {
    const currentRequest = ++requestVersion;
    emit(createState('loading'));

    try {
      const household = await householdService.getActiveHousehold(user?.id);

      if (currentRequest === requestVersion) {
        emit(createState('ready', { household }));
      }
    } catch (error) {
      if (currentRequest === requestVersion) {
        emit(createState('error', { error }));
      }
    }

    return state;
  }

  function clear() {
    requestVersion += 1;
    emit(createState('idle'));
  }

  return Object.freeze({
    clear,
    getState: () => state,
    load,
  });
}
