export function createEmptyFinancialSummary() {
  return Object.freeze({
    incomeCents: 0,
    expenseCents: 0,
    balanceCents: 0,
    transactionCount: 0,
  });
}

export function calculateFinancialSummary(transactions) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Os lançamentos financeiros são inválidos.');
  }

  let incomeCents = 0;
  let expenseCents = 0;

  transactions.forEach((transaction) => {
    if (!Number.isSafeInteger(transaction?.amountCents) || transaction.amountCents <= 0) {
      throw new TypeError('O valor de um lançamento financeiro é inválido.');
    }

    if (transaction.type === 'income') {
      incomeCents += transaction.amountCents;
    } else if (transaction.type === 'expense') {
      expenseCents += transaction.amountCents;
    } else {
      throw new TypeError('O tipo de um lançamento financeiro é inválido.');
    }

    if (!Number.isSafeInteger(incomeCents) || !Number.isSafeInteger(expenseCents)) {
      throw new TypeError('Os totais financeiros excedem o limite seguro.');
    }
  });

  return Object.freeze({
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    transactionCount: transactions.length,
  });
}
