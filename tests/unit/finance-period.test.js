import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFinanceDateRange,
  createFinancePeriod,
  formatFinanceDate,
  formatFinancePeriod,
  getCurrentFinancePeriod,
  getFinanceDateRange,
  parseFinanceMonthKey,
  shiftFinancePeriod,
  toFinanceMonthKey,
} from '../../js/modules/finance/utils/finance-period.js';

describe('período financeiro', () => {
  it('obtém o mês atual por relógio injetado e gera a chave canônica', () => {
    const period = getCurrentFinancePeriod(new Date(2026, 7, 26, 23, 30));

    assert.deepEqual(period, { year: 2026, month: 8 });
    assert.equal(toFinanceMonthKey(period), '2026-08');
    assert.deepEqual(parseFinanceMonthKey('2026-08'), period);
    assert.ok(Object.isFrozen(period));
  });

  it('navega entre meses atravessando os anos', () => {
    assert.deepEqual(
      shiftFinancePeriod(createFinancePeriod(2026, 1), -1),
      { year: 2025, month: 12 },
    );
    assert.deepEqual(
      shiftFinancePeriod(createFinancePeriod(2026, 12), 1),
      { year: 2027, month: 1 },
    );
  });

  it('monta intervalo semiaberto sem depender da duração do mês', () => {
    assert.deepEqual(getFinanceDateRange({ year: 2024, month: 2 }), {
      start: '2024-02-01',
      endExclusive: '2024-03-01',
    });
    assert.deepEqual(getFinanceDateRange({ year: 2026, month: 12 }), {
      start: '2026-12-01',
      endExclusive: '2027-01-01',
    });
  });

  it('aplica ao banco os limites inclusivo e exclusivo do mês', () => {
    const calls = [];
    const query = {
      gte(column, value) {
        calls.push(['gte', column, value]);
        return this;
      },
      lt(column, value) {
        calls.push(['lt', column, value]);
        return this;
      },
    };

    assert.equal(applyFinanceDateRange(query, { year: 2026, month: 8 }), query);
    assert.deepEqual(calls, [
      ['gte', 'transaction_date', '2026-08-01'],
      ['lt', 'transaction_date', '2026-09-01'],
    ]);
    assert.throws(() => applyFinanceDateRange({}, { year: 2026, month: 8 }), /consulta/i);
  });

  it('formata mês e data em português sem deslocamento de fuso', () => {
    assert.equal(formatFinancePeriod({ year: 2026, month: 8 }), 'Agosto de 2026');
    assert.equal(formatFinanceDate('2026-08-03'), '03/08/2026');
  });

  it('rejeita mês, deslocamento e datas de calendário inválidos', () => {
    assert.throws(() => createFinancePeriod(2026, 13), /mês financeiro/i);
    assert.throws(() => parseFinanceMonthKey('08/2026'), /período financeiro/i);
    assert.throws(() => shiftFinancePeriod({ year: 2026, month: 8 }, 0.5), /deslocamento/i);
    assert.throws(() => formatFinanceDate('2026-02-30'), /data do lançamento/i);
  });
});
