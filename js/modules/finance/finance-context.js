import { calculateFinancialSummary, createEmptyFinancialSummary } from './financial-summary.js';
import { validateFinanceType } from './services/financial-category-service.js';
import { sortFinancialTransactions } from './services/financial-transaction-service.js';
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
    transactions = [],
    summary = createEmptyFinancialSummary(),
    error = null,
    formError = null,
    isSubmitting = false,
    notice = null,
    isCategoryLoading = false,
    categoryError = null,
  },
) {
  return Object.freeze({
    status,
    period,
    categoryType,
    categories: Object.freeze([...categories]),
    transactions: Object.freeze([...transactions]),
    summary,
    error,
    formError,
    isSubmitting,
    notice,
    isCategoryLoading,
    categoryError,
  });
}

export function createFinanceController({
  categoryService,
  transactionService,
  now = () => new Date(),
  onStateChange = () => {},
}) {
  if (!categoryService || typeof categoryService.listByType !== 'function') {
    throw new TypeError('O serviço de categorias financeiras é obrigatório.');
  }

  if (
    !transactionService
    || typeof transactionService.listByPeriod !== 'function'
    || typeof transactionService.create !== 'function'
  ) {
    throw new TypeError('O serviço de lançamentos financeiros é obrigatório.');
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

  function readyState(overrides = {}) {
    return createState('ready', { ...state, ...overrides });
  }

  async function load({ householdId, period = state.period, type = state.categoryType }) {
    const currentRequest = ++requestVersion;
    const normalizedPeriod = normalizePeriod(period, now);
    const categoryType = validateFinanceType(type);
    activeHouseholdId = householdId;
    emit(createState('loading', { period: normalizedPeriod, categoryType }));

    try {
      const [categories, transactions] = await Promise.all([
        categoryService.listByType({ householdId, type: categoryType }),
        transactionService.listByPeriod({ householdId, period: normalizedPeriod }),
      ]);

      if (currentRequest === requestVersion) {
        emit(createState('ready', {
          period: normalizedPeriod,
          categoryType,
          categories,
          transactions,
          summary: calculateFinancialSummary(transactions),
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
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.isCategoryLoading
      || !activeHouseholdId
    ) {
      return state;
    }

    const categoryType = validateFinanceType(type);

    if (categoryType === state.categoryType) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      categoryType,
      categories: [],
      formError: null,
      notice: null,
      isCategoryLoading: true,
      categoryError: null,
    }));

    try {
      const categories = await categoryService.listByType({
        householdId: activeHouseholdId,
        type: categoryType,
      });

      if (currentRequest === requestVersion) {
        emit(readyState({ categories, isCategoryLoading: false }));
      }
    } catch (categoryError) {
      if (currentRequest === requestVersion) {
        emit(readyState({ isCategoryLoading: false, categoryError }));
      }
    }

    return state;
  }

  async function shiftMonth(monthOffset) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.isCategoryLoading
      || !activeHouseholdId
    ) {
      return state;
    }

    return load({
      householdId: activeHouseholdId,
      period: shiftFinancePeriod(state.period, monthOffset),
      type: state.categoryType,
    });
  }

  async function create(input) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.isCategoryLoading
      || !activeHouseholdId
    ) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      formError: null,
      isSubmitting: true,
      notice: null,
      categoryError: null,
    }));

    try {
      const createdTransaction = await transactionService.create({
        ...input,
        householdId: activeHouseholdId,
        period: state.period,
        categories: state.categories,
        type: state.categoryType,
      });

      if (currentRequest === requestVersion) {
        const transactions = sortFinancialTransactions([
          ...state.transactions.filter((transaction) => transaction.id !== createdTransaction.id),
          createdTransaction,
        ]);
        emit(readyState({
          transactions,
          summary: calculateFinancialSummary(transactions),
          formError: null,
          isSubmitting: false,
          notice: 'Lançamento cadastrado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(readyState({ formError, isSubmitting: false }));
      }
    }

    return state;
  }

  function clear() {
    requestVersion += 1;
    activeHouseholdId = null;
    emit(createState('idle', { period: normalizePeriod(null, now) }));
  }

  return Object.freeze({
    clear,
    create,
    getState: () => state,
    load,
    selectCategoryType,
    shiftMonth,
  });
}
