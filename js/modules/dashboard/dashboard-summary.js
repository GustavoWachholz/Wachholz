function toNonNegativeNumber(value, fieldName) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;

  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${fieldName} deve ser um número não negativo.`);
  }

  return number;
}

function toCount(value, fieldName) {
  const count = toNonNegativeNumber(value, fieldName);

  if (!Number.isInteger(count)) {
    throw new TypeError(`${fieldName} deve ser um número inteiro.`);
  }

  return count;
}

export function createEmptyDashboardSummary() {
  return Object.freeze({
    finance: Object.freeze({
      income: 0,
      expenses: 0,
      balance: 0,
      transactionCount: 0,
    }),
    shopping: Object.freeze({
      pendingItems: 0,
      activeLists: 0,
    }),
  });
}

export function normalizeDashboardSummary(value = {}) {
  const income = toNonNegativeNumber(value.finance?.income ?? 0, 'Receitas');
  const expenses = toNonNegativeNumber(value.finance?.expenses ?? 0, 'Despesas');

  return Object.freeze({
    finance: Object.freeze({
      income,
      expenses,
      balance: income - expenses,
      transactionCount: toCount(
        value.finance?.transactionCount ?? 0,
        'Quantidade de lançamentos',
      ),
    }),
    shopping: Object.freeze({
      pendingItems: toCount(value.shopping?.pendingItems ?? 0, 'Itens pendentes'),
      activeLists: toCount(value.shopping?.activeLists ?? 0, 'Listas ativas'),
    }),
  });
}

export function hasDashboardActivity(summary) {
  const normalizedSummary = normalizeDashboardSummary(summary);
  return normalizedSummary.finance.income > 0
    || normalizedSummary.finance.expenses > 0
    || normalizedSummary.finance.transactionCount > 0
    || normalizedSummary.shopping.pendingItems > 0
    || normalizedSummary.shopping.activeLists > 0;
}

export function formatCurrency(value, locale = 'pt-BR', currency = 'BRL') {
  if (!Number.isFinite(value)) {
    throw new TypeError('O valor monetário deve ser um número finito.');
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}
