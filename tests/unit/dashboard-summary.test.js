import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyDashboardSummary,
  formatCurrency,
  hasDashboardActivity,
  normalizeDashboardSummary,
} from '../../js/modules/dashboard/dashboard-summary.js';

describe('normalizeDashboardSummary', () => {
  it('normaliza números do banco e calcula o saldo', () => {
    const summary = normalizeDashboardSummary({
      finance: {
        income: '3500.50',
        expenses: '1275.25',
        transactionCount: 4,
      },
      shopping: { pendingItems: 7, activeLists: 2 },
    });

    assert.equal(summary.finance.income, 3500.5);
    assert.equal(summary.finance.expenses, 1275.25);
    assert.equal(summary.finance.balance, 2225.25);
    assert.equal(summary.shopping.pendingItems, 7);
  });

  it('preenche dados ausentes com zero', () => {
    assert.deepEqual(normalizeDashboardSummary(), createEmptyDashboardSummary());
  });

  it('rejeita valores negativos, infinitos e contagens fracionárias', () => {
    assert.throws(
      () => normalizeDashboardSummary({ finance: { income: -1 } }),
      /não negativo/i,
    );
    assert.throws(
      () => normalizeDashboardSummary({ finance: { expenses: Infinity } }),
      /não negativo/i,
    );
    assert.throws(
      () => normalizeDashboardSummary({ shopping: { pendingItems: 1.5 } }),
      /inteiro/i,
    );
  });
});

describe('hasDashboardActivity', () => {
  it('considera lançamentos ou listas ativas como atividade', () => {
    assert.equal(hasDashboardActivity(createEmptyDashboardSummary()), false);
    assert.equal(hasDashboardActivity({ finance: { income: 100 } }), true);
    assert.equal(hasDashboardActivity({ finance: { transactionCount: 1 } }), true);
    assert.equal(hasDashboardActivity({ shopping: { pendingItems: 1 } }), true);
    assert.equal(hasDashboardActivity({ shopping: { activeLists: 1 } }), true);
  });
});

describe('formatCurrency', () => {
  it('formata valores no padrão monetário brasileiro', () => {
    assert.match(formatCurrency(1500.5), /R\$[\s\u00a0]1\.500,50/);
    assert.match(formatCurrency(-10), /-R\$[\s\u00a0]10,00|R\$[\s\u00a0]-10,00/);
  });

  it('rejeita valor não finito', () => {
    assert.throws(() => formatCurrency(Number.NaN), /número finito/i);
  });
});
