import { normalizeDashboardSummary } from './dashboard-summary.js';

function createState(status, { summary = null, error = null } = {}) {
  return Object.freeze({ status, summary, error });
}

export function createDashboardController({ summaryService, onStateChange = () => {} }) {
  if (!summaryService || typeof summaryService.getSummary !== 'function') {
    throw new TypeError('O serviço de resumo do dashboard é obrigatório.');
  }

  let state = createState('idle');
  let requestVersion = 0;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  async function load(householdId) {
    if (typeof householdId !== 'string' || !householdId.trim()) {
      throw new TypeError('O identificador da household é obrigatório.');
    }

    const currentRequest = ++requestVersion;
    emit(createState('loading'));

    try {
      const summary = normalizeDashboardSummary(
        await summaryService.getSummary(householdId),
      );

      if (currentRequest === requestVersion) {
        emit(createState('ready', { summary }));
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
