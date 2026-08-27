import { sortFinancialTransactions } from './services/financial-transaction-service.js';
import { formatFinanceMoney } from './utils/finance-money.js';
import { formatFinanceDate, toFinanceMonthKey } from './utils/finance-period.js';

const TYPE_LABELS = Object.freeze({
  income: 'Receita',
  expense: 'Despesa',
});

const DANGEROUS_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value, { protectFormula = false } = {}) {
  let text = String(value ?? '');

  if (protectFormula && DANGEROUS_FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export function createFinancialCsv(transactions, period) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Os lançamentos para exportação são inválidos.');
  }

  toFinanceMonthKey(period);
  const rows = sortFinancialTransactions(transactions).map((transaction) => {
    const typeLabel = TYPE_LABELS[transaction.type];

    if (!typeLabel) {
      throw new TypeError('O tipo do lançamento exportado é inválido.');
    }

    return [
      csvCell(formatFinanceDate(transaction.transactionDate)),
      csvCell(typeLabel),
      csvCell(transaction.description, { protectFormula: true }),
      csvCell(transaction.categoryName, { protectFormula: true }),
      csvCell(formatFinanceMoney(transaction.amountCents)),
      csvCell(transaction.notes, { protectFormula: true }),
    ].join(';');
  });

  return `\uFEFFdata;tipo;descricao;categoria;valor;observacao\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}

export function getFinancialCsvFilename(period) {
  return `financeiro-${toFinanceMonthKey(period)}.csv`;
}

export function downloadFinancialCsv(
  { transactions, period },
  {
    documentRoot = globalThis.document,
    BlobCtor = globalThis.Blob,
    urlApi = globalThis.URL,
  } = {},
) {
  if (
    !documentRoot?.body
    || typeof documentRoot.createElement !== 'function'
    || typeof BlobCtor !== 'function'
    || typeof urlApi?.createObjectURL !== 'function'
    || typeof urlApi?.revokeObjectURL !== 'function'
  ) {
    throw new TypeError('O navegador não oferece suporte à exportação CSV.');
  }

  const filename = getFinancialCsvFilename(period);
  const content = createFinancialCsv(transactions, period);
  const blob = new BlobCtor([content], { type: 'text/csv;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  const anchor = documentRoot.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  documentRoot.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    urlApi.revokeObjectURL(url);
  }

  return Object.freeze({ filename, content });
}
