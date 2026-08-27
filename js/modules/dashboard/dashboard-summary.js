function toNonNegativeNumber(value, fieldName) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;

  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${fieldName} deve ser um número não negativo.`);
  }

  return number;
}

function toCount(value, fieldName) {
  const count = toNonNegativeNumber(value, fieldName);

  if (!Number.isSafeInteger(count)) {
    throw new TypeError(`${fieldName} deve ser um número inteiro.`);
  }

  return count;
}

export function createEmptyDashboardSummary() {
  return Object.freeze({
    finance: Object.freeze({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      transactionCount: 0,
    }),
    shopping: Object.freeze({
      pendingItems: 0,
      activeLists: 0,
    }),
  });
}

export function normalizeDashboardSummary(value = {}) {
  const incomeCents = toCount(value.finance?.incomeCents ?? 0, 'Receitas em centavos');
  const expenseCents = toCount(value.finance?.expenseCents ?? 0, 'Despesas em centavos');
  const receivedBalance = value.finance?.balanceCents;
  const balanceCents = receivedBalance === undefined
    ? incomeCents - expenseCents
    : Number(receivedBalance);

  if (!Number.isSafeInteger(balanceCents) || balanceCents !== incomeCents - expenseCents) {
    throw new TypeError('O saldo financeiro do dashboard é inconsistente.');
  }

  return Object.freeze({
    finance: Object.freeze({
      incomeCents,
      expenseCents,
      balanceCents,
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
  return normalizedSummary.finance.incomeCents > 0
    || normalizedSummary.finance.expenseCents > 0
    || normalizedSummary.finance.transactionCount > 0
    || normalizedSummary.shopping.pendingItems > 0
    || normalizedSummary.shopping.activeLists > 0;
}
