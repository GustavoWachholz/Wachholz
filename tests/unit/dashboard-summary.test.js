import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyDashboardSummary,
  hasDashboardActivity,
  normalizeDashboardSummary,
} from '../../js/modules/dashboard/dashboard-summary.js';

describe('normalizeDashboardSummary', () => {
  it('normaliza números do banco e calcula o saldo', () => {
    const summary = normalizeDashboardSummary({
      finance: {
        incomeCents: '350050',
        expenseCents: '127525',
        balanceCents: '222525',
        transactionCount: 4,
      },
      shopping: { pendingItems: 7, activeLists: 2 },
    });

    assert.equal(summary.finance.incomeCents, 350050);
    assert.equal(summary.finance.expenseCents, 127525);
    assert.equal(summary.finance.balanceCents, 222525);
    assert.equal(summary.shopping.pendingItems, 7);
  });

  it('preenche dados ausentes com zero', () => {
    assert.deepEqual(normalizeDashboardSummary(), createEmptyDashboardSummary());
  });

  it('rejeita valores negativos, infinitos e contagens fracionárias', () => {
    assert.throws(
      () => normalizeDashboardSummary({ finance: { incomeCents: -1 } }),
      /não negativo/i,
    );
    assert.throws(
      () => normalizeDashboardSummary({ finance: { expenseCents: Infinity } }),
      /não negativo/i,
    );
    assert.throws(
      () => normalizeDashboardSummary({ shopping: { pendingItems: 1.5 } }),
      /inteiro/i,
    );
    assert.throws(
      () => normalizeDashboardSummary({
        finance: { incomeCents: 100, expenseCents: 40, balanceCents: 50 },
      }),
      /saldo.*inconsistente/i,
    );
  });
});

describe('hasDashboardActivity', () => {
  it('considera lançamentos ou listas ativas como atividade', () => {
    assert.equal(hasDashboardActivity(createEmptyDashboardSummary()), false);
    assert.equal(hasDashboardActivity({ finance: { incomeCents: 100 } }), true);
    assert.equal(hasDashboardActivity({ finance: { transactionCount: 1 } }), true);
    assert.equal(hasDashboardActivity({ shopping: { pendingItems: 1 } }), true);
    assert.equal(hasDashboardActivity({ shopping: { activeLists: 1 } }), true);
  });
});
