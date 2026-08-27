import { calculateFinancialSummary, createEmptyFinancialSummary } from './financial-summary.js';
import {
  FINANCE_TYPES,
  validateFinanceType,
} from './services/financial-category-service.js';
import {
  filterFinancialTransactions,
  sortFinancialTransactions,
} from './services/financial-transaction-service.js';
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
    visibleTransactions = transactions,
    summary = createEmptyFinancialSummary(),
    error = null,
    formError = null,
    isSubmitting = false,
    notice = null,
    isCategoryLoading = false,
    categoryError = null,
    filterType = 'all',
    filterCategoryId = 'all',
    editingTransactionId = null,
    editCategories = [],
    isEditCategoryLoading = false,
    pendingTransactionId = null,
    operationError = null,
  },
) {
  return Object.freeze({
    status,
    period,
    categoryType,
    categories: Object.freeze([...categories]),
    transactions: Object.freeze([...transactions]),
    visibleTransactions: Object.freeze([...visibleTransactions]),
    summary,
    error,
    formError,
    isSubmitting,
    notice,
    isCategoryLoading,
    categoryError,
    filterType,
    filterCategoryId,
    editingTransactionId,
    editCategories: Object.freeze([...editCategories]),
    isEditCategoryLoading,
    pendingTransactionId,
    operationError,
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
    || typeof transactionService.update !== 'function'
    || typeof transactionService.remove !== 'function'
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
    const merged = { ...state, ...overrides };
    const visibleTransactions = filterFinancialTransactions(merged.transactions, {
      type: merged.filterType,
      categoryId: merged.filterCategoryId,
    });
    return createState('ready', {
      ...merged,
      visibleTransactions,
      summary: calculateFinancialSummary(visibleTransactions),
    });
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
          visibleTransactions: transactions,
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

  function setFilters({ type = state.filterType, categoryId = state.filterCategoryId } = {}) {
    if (state.status !== 'ready' || state.pendingTransactionId) {
      return state;
    }

    const filterType = type === 'all' ? 'all' : validateFinanceType(type);
    const availableCategoryIds = new Set(
      state.transactions
        .filter((transaction) => filterType === 'all' || transaction.type === filterType)
        .map((transaction) => transaction.categoryId),
    );
    const filterCategoryId = categoryId === 'all' || availableCategoryIds.has(categoryId)
      ? categoryId
      : 'all';

    emit(readyState({
      filterType,
      filterCategoryId,
      notice: null,
      operationError: null,
    }));
    return state;
  }

  async function create(input) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.isCategoryLoading
      || state.pendingTransactionId
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

  async function startEdit(transactionId) {
    if (
      state.status !== 'ready'
      || state.isSubmitting
      || state.pendingTransactionId
      || !state.transactions.some((transaction) => transaction.id === transactionId)
      || !activeHouseholdId
    ) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      editingTransactionId: transactionId,
      editCategories: [],
      isEditCategoryLoading: true,
      formError: null,
      notice: null,
      operationError: null,
    }));

    try {
      const categoryGroups = await Promise.all(FINANCE_TYPES.map((type) => (
        categoryService.listByType({ householdId: activeHouseholdId, type })
      )));

      if (currentRequest === requestVersion) {
        emit(readyState({
          editCategories: categoryGroups.flat(),
          isEditCategoryLoading: false,
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(readyState({ isEditCategoryLoading: false, operationError }));
      }
    }

    return state;
  }

  function cancelEdit() {
    if (state.status !== 'ready' || state.pendingTransactionId) {
      return state;
    }

    requestVersion += 1;
    emit(readyState({
      editingTransactionId: null,
      editCategories: [],
      isEditCategoryLoading: false,
      formError: null,
      operationError: null,
    }));
    return state;
  }

  function canMutate(transactionId) {
    return state.status === 'ready'
      && !state.isSubmitting
      && !state.pendingTransactionId
      && Boolean(activeHouseholdId)
      && state.transactions.some((transaction) => transaction.id === transactionId);
  }

  async function update(input) {
    if (!canMutate(input?.transactionId) || state.editingTransactionId !== input.transactionId) {
      return state;
    }

    const currentRequest = ++requestVersion;
    const transactionId = input.transactionId;
    emit(readyState({
      pendingTransactionId: transactionId,
      formError: null,
      notice: null,
      operationError: null,
    }));

    try {
      const updatedTransaction = await transactionService.update({
        ...input,
        householdId: activeHouseholdId,
        period: state.period,
        categories: state.editCategories,
      });

      if (currentRequest === requestVersion) {
        emit(readyState({
          transactions: sortFinancialTransactions(state.transactions.map((transaction) => (
            transaction.id === updatedTransaction.id ? updatedTransaction : transaction
          ))),
          editingTransactionId: null,
          editCategories: [],
          pendingTransactionId: null,
          notice: 'Lançamento atualizado.',
        }));
      }
    } catch (formError) {
      if (currentRequest === requestVersion) {
        emit(readyState({ pendingTransactionId: null, formError }));
      }
    }

    return state;
  }

  async function remove({ transactionId } = {}) {
    if (!canMutate(transactionId)) {
      return state;
    }

    const currentRequest = ++requestVersion;
    emit(readyState({
      pendingTransactionId: transactionId,
      formError: null,
      notice: null,
      operationError: null,
    }));

    try {
      const removedId = await transactionService.remove({
        householdId: activeHouseholdId,
        transactionId,
      });

      if (currentRequest === requestVersion) {
        emit(readyState({
          transactions: state.transactions.filter((transaction) => transaction.id !== removedId),
          editingTransactionId: state.editingTransactionId === removedId
            ? null
            : state.editingTransactionId,
          editCategories: state.editingTransactionId === removedId ? [] : state.editCategories,
          pendingTransactionId: null,
          notice: 'Lançamento excluído.',
        }));
      }
    } catch (operationError) {
      if (currentRequest === requestVersion) {
        emit(readyState({ pendingTransactionId: null, operationError }));
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
    cancelEdit,
    clear,
    create,
    getState: () => state,
    load,
    remove,
    selectCategoryType,
    setFilters,
    shiftMonth,
    startEdit,
    update,
  });
}
