const BRAZILIAN_MONEY_PATTERN = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const DATABASE_MONEY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const MAX_DATABASE_CENTS = 99_999_999_999_999n;

export class FinanceMoneyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FinanceMoneyError';
    this.code = code;
  }
}

function checkedCents(value) {
  if (!Number.isSafeInteger(value)) {
    throw new FinanceMoneyError('INVALID_CENTS', 'O valor monetário é inválido.');
  }

  if (BigInt(Math.abs(value)) > MAX_DATABASE_CENTS) {
    throw new FinanceMoneyError('AMOUNT_TOO_LARGE', 'O valor monetário excede o limite permitido.');
  }

  return value;
}

function partsToCents(integerPart, fractionPart = '') {
  const cents = (BigInt(integerPart) * 100n) + BigInt(fractionPart.padEnd(2, '0') || '0');

  if (cents > MAX_DATABASE_CENTS) {
    throw new FinanceMoneyError('AMOUNT_TOO_LARGE', 'O valor monetário excede o limite permitido.');
  }

  return Number(cents);
}

export function parseBrazilianMoney(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/[\s\u00a0]/g, '');
  const match = normalized.match(BRAZILIAN_MONEY_PATTERN);

  if (!match) {
    throw new FinanceMoneyError(
      'INVALID_AMOUNT',
      'Informe o valor no formato brasileiro, como 1.234,56.',
    );
  }

  return partsToCents(normalized.split(',')[0].replaceAll('.', ''), match[1]);
}

export function databaseMoneyToCents(value) {
  const match = String(value ?? '').trim().match(DATABASE_MONEY_PATTERN);

  if (!match) {
    throw new FinanceMoneyError('INVALID_AMOUNT', 'O valor recebido do banco é inválido.');
  }

  return partsToCents(match[1], match[2]);
}

export function centsToDatabaseMoney(value) {
  const cents = checkedCents(value);

  if (cents < 0) {
    throw new FinanceMoneyError(
      'INVALID_AMOUNT',
      'O valor de um lançamento financeiro não pode ser negativo.',
    );
  }

  const absolute = BigInt(cents);
  return `${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function formatFinanceMoney(value) {
  const cents = checkedCents(value);
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100);
  const fractionPart = String(absolute % 100).padStart(2, '0');
  const groupedInteger = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(integerPart);
  return `${sign}R$ ${groupedInteger},${fractionPart}`;
}
