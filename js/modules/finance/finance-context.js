import { validateFinanceType } from './services/financial-category-service.js';
import {
  createFinancePeriod,
  getCurrentFinancePeriod,
  shiftFinancePeriod,
} from './utils/finance-period.js';

function normalizePeriod(period, now) {
  return period
    ? createFinancePeriod(period.year, period.month)
    : getCurrentFinancePeriod(now());
}

function createState(
  status,
  {
    period,
    categoryType = 'expense',
    categories = [],
    error = null,
  },
) {
  return Object.freeze({
    status,
    period,
    categoryType,
    categories: Object.freeze([...categories]),
    error,
  });
}

export function createFinanceController({
  categoryService,
  now = () => new Date(),
  onStateChange = () => {},
}) {
  if (!categoryService || typeof categoryService.listByType !== 'function') {
    throw new TypeError('O serviço de categorias financeiras é obrigatório.');
  }

  if (typeof now !== 'function') {
    throw new TypeError('O relógio do módulo financeiro é inválido.');
  }

  let state = createState('idle', { period: normalizePeriod(null, now) });
  let requestVersion = 0;
  let activeHouseholdId = null;

  function emit(nextState) {
    state = nextState;
    onStateChange(state);
  }

  async function load({ householdId, period = state.period, type = state.categoryType }) {
    const currentRequest = ++requestVersion;
    const normalizedPeriod = normalizePeriod(period, now);
    const categoryType = validateFinanceType(type);
    activeHouseholdId = householdId;
    emit(createState('loading', { period: normalizedPeriod, categoryType }));

    try {
      const categories = await categoryService.listByType({ householdId, type: categoryType });

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          period: normalizedPeriod,
          categoryType,
          categories,
        }));
      }
    } catch (error) {
      if (currentRequest === requestVersion) {
        emit(createState('error', {
          period: normalizedPeriod,
          categoryType,
          error,
        }));
      }
    }

    return state;
  }

  async function selectCategoryType(type) {
    if (!['ready', 'error'].includes(state.status) || !activeHouseholdId) {
      return state;
    }

    const categoryType = validateFinanceType(type);

    if (categoryType === state.categoryType) {
      return state;
    }

    return load({
      householdId: activeHouseholdId,
      period: state.period,
      type: categoryType,
    });
  }

  function shiftMonth(monthOffset) {
    if (state.status !== 'ready') {
      return state;
    }

    emit(createState('ready', {
      period: shiftFinancePeriod(state.period, monthOffset),
      categoryType: state.categoryType,
      categories: state.categories,
    }));
    return state;
  }

  function clear() {
    requestVersion += 1;
    activeHouseholdId = null;
    emit(createState('idle', { period: normalizePeriod(null, now) }));
  }

  return Object.freeze({
    clear,
    getState: () => state,
    load,
    selectCategoryType,
    shiftMonth,
  });
}
