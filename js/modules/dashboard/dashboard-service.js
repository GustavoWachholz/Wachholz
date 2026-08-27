import { calculateFinancialSummary } from '../finance/financial-summary.js';
import { getCurrentFinancePeriod } from '../finance/utils/finance-period.js';

export function createDashboardSummaryService({
  transactionService,
  shoppingListService,
  now = () => new Date(),
}) {
  if (!transactionService || typeof transactionService.listByPeriod !== 'function') {
    throw new TypeError('O serviço financeiro do dashboard é obrigatório.');
  }

  if (!shoppingListService || typeof shoppingListService.listActive !== 'function') {
    throw new TypeError('O serviço de compras do dashboard é obrigatório.');
  }

  if (typeof now !== 'function') {
    throw new TypeError('O relógio do dashboard é inválido.');
  }

  async function getSummary(householdId) {
    const period = getCurrentFinancePeriod(now());
    const [transactions, lists] = await Promise.all([
      transactionService.listByPeriod({ householdId, period }),
      shoppingListService.listActive(householdId),
    ]);
    const finance = calculateFinancialSummary(transactions);

    return Object.freeze({
      finance: Object.freeze({
        incomeCents: finance.incomeCents,
        expenseCents: finance.expenseCents,
        balanceCents: finance.balanceCents,
        transactionCount: finance.transactionCount,
      }),
      shopping: Object.freeze({
        pendingItems: lists.reduce((total, list) => total + list.pendingItems, 0),
        activeLists: lists.length,
      }),
    });
  }

  return Object.freeze({ getSummary });
}
