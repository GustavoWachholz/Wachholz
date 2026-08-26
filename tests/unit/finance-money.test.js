import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  centsToDatabaseMoney,
  databaseMoneyToCents,
  formatFinanceMoney,
  parseBrazilianMoney,
} from '../../js/modules/finance/utils/finance-money.js';

describe('moeda financeira em centavos', () => {
  it('normaliza entradas brasileiras sem cálculo decimal', () => {
    assert.equal(parseBrazilianMoney('1.234,56'), 123456);
    assert.equal(parseBrazilianMoney(' R$ 12,5 '), 1250);
    assert.equal(parseBrazilianMoney('2500'), 250000);
    assert.equal(parseBrazilianMoney('0,01'), 1);
  });

  it('converte centavos para numeric do banco e faz a volta exata', () => {
    const cents = 9_876_543_210_099;
    const databaseValue = centsToDatabaseMoney(cents);

    assert.equal(databaseValue, '98765432100.99');
    assert.equal(databaseMoneyToCents(databaseValue), cents);
    assert.equal(databaseMoneyToCents('10.5'), 1050);
  });

  it('formata centavos em reais, incluindo saldo negativo', () => {
    assert.equal(formatFinanceMoney(123456), 'R$ 1.234,56');
    assert.equal(formatFinanceMoney(-5050), '-R$ 50,50');
  });

  it('rejeita separadores ambíguos, frações excessivas e valores inseguros', () => {
    for (const invalid of ['1,234.56', '12.34', '1,234', '-10,00', 'abc']) {
      assert.throws(() => parseBrazilianMoney(invalid), /formato brasileiro/i);
    }
    assert.throws(() => centsToDatabaseMoney(1.5), /valor monetário/i);
    assert.throws(() => centsToDatabaseMoney(-1), /não pode ser negativo/i);
    assert.throws(() => parseBrazilianMoney('999.999.999.999.999,99'), /limite/i);
  });
});
