import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createFinancialCsv,
  downloadFinancialCsv,
  getFinancialCsvFilename,
} from '../../js/modules/finance/financial-csv.js';

const PERIOD = Object.freeze({ year: 2026, month: 8 });

function transaction(overrides = {}) {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    type: 'expense',
    description: 'Mercado; mensal',
    categoryName: 'Alimentação',
    amountCents: 18349,
    transactionDate: '2026-08-10',
    notes: 'Compra "grande"',
    createdAt: '2026-08-10T12:00:00Z',
    ...overrides,
  };
}

describe('createFinancialCsv', () => {
  it('gera UTF-8 com colunas, ordenação, formatação e escape completos', () => {
    const csv = createFinancialCsv([
      transaction(),
      transaction({
        id: '99999999-9999-4999-8999-999999999998',
        type: 'income',
        description: 'Salário',
        categoryName: 'Trabalho',
        amountCents: 500000,
        transactionDate: '2026-08-20',
        notes: null,
        createdAt: '2026-08-20T12:00:00Z',
      }),
    ], PERIOD);

    assert.ok(csv.startsWith('\uFEFFdata;tipo;descricao;categoria;valor;observacao\r\n'));
    assert.ok(csv.indexOf('"20/08/2026"') < csv.indexOf('"10/08/2026"'));
    assert.match(csv, /"Receita";"Salário";"Trabalho";"R\$ 5\.000,00";""/);
    assert.match(csv, /"Mercado; mensal"/);
    assert.match(csv, /"Compra ""grande"""/);
  });

  it('neutraliza fórmulas em texto e valida tipo e período', () => {
    const csv = createFinancialCsv([
      transaction({ description: '=HYPERLINK("ruim")', notes: '+1+1' }),
    ], PERIOD);

    assert.match(csv, /"'=HYPERLINK\(""ruim""\)"/);
    assert.match(csv, /"'\+1\+1"/);
    assert.throws(() => createFinancialCsv([transaction({ type: 'other' })], PERIOD), /tipo/i);
    assert.throws(() => createFinancialCsv([], { year: 2026, month: 13 }), /mês/i);
    assert.equal(getFinancialCsvFilename(PERIOD), 'financeiro-2026-08.csv');
  });
});

describe('downloadFinancialCsv', () => {
  it('cria o arquivo, aciona o download e libera a URL temporária', () => {
    const events = [];
    const anchor = {
      click() { events.push('click'); },
      remove() { events.push('remove'); },
    };
    const documentRoot = {
      body: { append(received) { assert.equal(received, anchor); events.push('append'); } },
      createElement(tag) { assert.equal(tag, 'a'); return anchor; },
    };
    class BlobMock {
      constructor(parts, options) { this.parts = parts; this.options = options; }
    }
    const urlApi = {
      createObjectURL(blob) { assert.ok(blob instanceof BlobMock); return 'blob:test'; },
      revokeObjectURL(url) { assert.equal(url, 'blob:test'); events.push('revoke'); },
    };

    const result = downloadFinancialCsv(
      { transactions: [transaction()], period: PERIOD },
      { documentRoot, BlobCtor: BlobMock, urlApi },
    );

    assert.equal(anchor.href, 'blob:test');
    assert.equal(anchor.download, 'financeiro-2026-08.csv');
    assert.deepEqual(events, ['append', 'click', 'remove', 'revoke']);
    assert.equal(result.filename, anchor.download);
  });
});
