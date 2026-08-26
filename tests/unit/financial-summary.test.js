import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateFinancialSummary,
  createEmptyFinancialSummary,
} from '../../js/modules/finance/financial-summary.js';

describe('calculateFinancialSummary', () => {
  it('soma receitas e despesas em centavos e calcula saldo e quantidade', () => {
    const summary = calculateFinancialSummary([
      { type: 'income', amountCents: 500000 },
      { type: 'expense', amountCents: 123456 },
      { type: 'expense', amountCents: 1000 },
    ]);

    assert.deepEqual(summary, {
      incomeCents: 500000,
      expenseCents: 124456,
      balanceCents: 375544,
      transactionCount: 3,
    });
    assert.ok(Object.isFrozen(summary));
  });

  it('cria resumo vazio e aceita saldo negativo', () => {
    assert.deepEqual(createEmptyFinancialSummary(), {
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      transactionCount: 0,
    });
    assert.equal(calculateFinancialSummary([
      { type: 'expense', amountCents: 2000 },
    ]).balanceCents, -2000);
  });

  it('rejeita tipo, valor e coleção inválidos', () => {
    assert.throws(() => calculateFinancialSummary(null), /lançamentos/i);
    assert.throws(() => calculateFinancialSummary([
      { type: 'transfer', amountCents: 100 },
    ]), /tipo/i);
    assert.throws(() => calculateFinancialSummary([
      { type: 'income', amountCents: 10.5 },
    ]), /valor/i);
  });
});
