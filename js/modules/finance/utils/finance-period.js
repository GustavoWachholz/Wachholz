const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class FinancePeriodError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FinancePeriodError';
    this.code = code;
  }
}

function assertYearAndMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new FinancePeriodError('INVALID_YEAR', 'O ano financeiro é inválido.');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new FinancePeriodError('INVALID_MONTH', 'O mês financeiro é inválido.');
  }
}

export function createFinancePeriod(year, month) {
  assertYearAndMonth(year, month);
  return Object.freeze({ year, month });
}

export function getCurrentFinancePeriod(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new FinancePeriodError('INVALID_DATE', 'A data atual é inválida.');
  }

  return createFinancePeriod(now.getFullYear(), now.getMonth() + 1);
}

export function parseFinanceMonthKey(value) {
  const match = String(value ?? '').match(MONTH_KEY_PATTERN);

  if (!match) {
    throw new FinancePeriodError('INVALID_PERIOD', 'O período financeiro é inválido.');
  }

  return createFinancePeriod(Number(match[1]), Number(match[2]));
}

export function toFinanceMonthKey(period) {
  assertYearAndMonth(period?.year, period?.month);
  return `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}`;
}

export function shiftFinancePeriod(period, monthOffset) {
  assertYearAndMonth(period?.year, period?.month);

  if (!Number.isInteger(monthOffset)) {
    throw new FinancePeriodError('INVALID_OFFSET', 'O deslocamento do mês é inválido.');
  }

  const monthIndex = (period.year * 12) + (period.month - 1) + monthOffset;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  return createFinancePeriod(year, month);
}

export function getFinanceDateRange(period) {
  const start = toFinanceMonthKey(period);
  const next = shiftFinancePeriod(period, 1);
  return Object.freeze({
    start: `${start}-01`,
    endExclusive: `${toFinanceMonthKey(next)}-01`,
  });
}

export function applyFinanceDateRange(query, period) {
  if (!query || typeof query.gte !== 'function') {
    throw new TypeError('A consulta financeira é inválida.');
  }

  const { start, endExclusive } = getFinanceDateRange(period);
  const rangedQuery = query.gte('transaction_date', start);

  if (!rangedQuery || typeof rangedQuery.lt !== 'function') {
    throw new TypeError('A consulta financeira é inválida.');
  }

  return rangedQuery.lt('transaction_date', endExclusive);
}

export function formatFinancePeriod(period) {
  assertYearAndMonth(period?.year, period?.month);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(period.year, period.month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatFinanceDate(value) {
  const match = String(value ?? '').match(DATE_PATTERN);

  if (!match) {
    throw new FinancePeriodError('INVALID_DATE', 'A data do lançamento é inválida.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new FinancePeriodError('INVALID_DATE', 'A data do lançamento é inválida.');
  }

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}
