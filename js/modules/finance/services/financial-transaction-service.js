import { unwrapSupabaseResult } from '../../../lib/supabase-result.js';
import {
  isCategoryCompatible,
  validateFinanceType,
  validateFinanceUuid,
} from './financial-category-service.js';
import {
  centsToDatabaseMoney,
  databaseMoneyToCents,
  parseBrazilianMoney,
} from '../utils/finance-money.js';
import {
  applyFinanceDateRange,
  formatFinanceDate,
  getFinanceDateRange,
} from '../utils/finance-period.js';

export const FINANCIAL_TRANSACTION_LIMITS = Object.freeze({
  description: 160,
  notes: 500,
});

const TRANSACTION_COLUMNS = [
  'id',
  'household_id',
  'category_id',
  'created_by',
  'type',
  'description',
  'amount',
  'transaction_date',
  'notes',
  'created_at',
  'updated_at',
  'financial_categories(id, household_id, name, type, is_active)',
].join(', ');

export class FinancialTransactionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FinancialTransactionError';
    this.code = code;
  }
}

function normalizeText(value, field, maxLength, { optional = false } = {}) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');

  if (!text && optional) {
    return null;
  }

  if (!text) {
    throw new FinancialTransactionError('INVALID_TEXT', `Informe ${field}.`);
  }

  if (text.length > maxLength) {
    throw new FinancialTransactionError(
      'INVALID_TEXT',
      `${field} deve ter no máximo ${maxLength} caracteres.`,
    );
  }

  return text;
}

function validateTimestamp(value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new FinancialTransactionError('INVALID_RESPONSE', `${field} é inválida.`);
  }

  return value;
}

function validateDateInPeriod(value, period) {
  formatFinanceDate(value);
  const { start, endExclusive } = getFinanceDateRange(period);

  if (value < start || value >= endExclusive) {
    throw new FinancialTransactionError(
      'DATE_OUTSIDE_PERIOD',
      'A data deve pertencer ao mês selecionado.',
    );
  }

  return value;
}

export function validateFinancialTransactionInput(
  value = {},
  { categories = [], period } = {},
) {
  const type = validateFinanceType(value.type);
  const categoryId = validateFinanceUuid(value.categoryId, 'identificador da categoria');
  const category = categories.find((candidate) => candidate.id === categoryId);

  if (!category || !isCategoryCompatible(category, type)) {
    throw new FinancialTransactionError(
      'INCOMPATIBLE_CATEGORY',
      'Selecione uma categoria compatível com o tipo do lançamento.',
    );
  }

  const amountCents = parseBrazilianMoney(value.amount);

  if (amountCents <= 0) {
    throw new FinancialTransactionError('INVALID_AMOUNT', 'O valor deve ser maior que zero.');
  }

  return Object.freeze({
    type,
    description: normalizeText(
      value.description,
      'a descrição',
      FINANCIAL_TRANSACTION_LIMITS.description,
    ),
    amountCents,
    amount: centsToDatabaseMoney(amountCents),
    transactionDate: validateDateInPeriod(value.transactionDate, period),
    categoryId,
    notes: normalizeText(
      value.notes,
      'A observação',
      FINANCIAL_TRANSACTION_LIMITS.notes,
      { optional: true },
    ),
  });
}

function categoryFromRelation(value) {
  const categoryRow = Array.isArray(value) ? value[0] : value;
  const name = String(categoryRow?.name ?? '').trim().replace(/\s+/g, ' ');

  if (!name) {
    throw new FinancialTransactionError(
      'INVALID_RESPONSE',
      'A categoria do lançamento recebido é inválida.',
    );
  }

  return Object.freeze({
    id: validateFinanceUuid(categoryRow?.id, 'identificador da categoria'),
    householdId: validateFinanceUuid(
      categoryRow?.household_id,
      'identificador da household',
    ),
    name,
    type: validateFinanceType(categoryRow?.type),
  });
}

export function mapFinancialTransaction(row) {
  const category = categoryFromRelation(row?.financial_categories);
  const type = validateFinanceType(row?.type);
  const householdId = validateFinanceUuid(row?.household_id, 'identificador da household');
  const categoryId = validateFinanceUuid(row?.category_id, 'identificador da categoria');

  if (
    category.id !== categoryId
    || category.householdId !== householdId
    || !isCategoryCompatible(category, type)
  ) {
    throw new FinancialTransactionError(
      'INVALID_RESPONSE',
      'A categoria do lançamento recebido é inconsistente.',
    );
  }

  const transactionDate = String(row?.transaction_date ?? '');
  formatFinanceDate(transactionDate);
  const amountCents = databaseMoneyToCents(row?.amount);

  if (amountCents <= 0) {
    throw new FinancialTransactionError(
      'INVALID_RESPONSE',
      'O valor do lançamento recebido é inválido.',
    );
  }

  return Object.freeze({
    id: validateFinanceUuid(row.id, 'identificador do lançamento'),
    householdId,
    categoryId,
    categoryName: category.name,
    createdBy: validateFinanceUuid(row.created_by, 'identificador do autor'),
    type,
    description: normalizeText(
      row.description,
      'a descrição',
      FINANCIAL_TRANSACTION_LIMITS.description,
    ),
    amountCents,
    transactionDate,
    notes: normalizeText(
      row.notes,
      'A observação',
      FINANCIAL_TRANSACTION_LIMITS.notes,
      { optional: true },
    ),
    createdAt: validateTimestamp(row.created_at, 'A data de criação'),
    updatedAt: validateTimestamp(row.updated_at, 'A data de atualização'),
  });
}

export function sortFinancialTransactions(transactions) {
  return Object.freeze([...transactions].sort((left, right) => (
    right.transactionDate.localeCompare(left.transactionDate)
    || right.createdAt.localeCompare(left.createdAt)
    || left.id.localeCompare(right.id)
  )));
}

export function createFinancialTransactionService(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('O cliente de banco do Supabase é obrigatório.');
  }

  async function listByPeriod({ householdId, period }) {
    const validHouseholdId = validateFinanceUuid(householdId, 'identificador da household');
    const baseQuery = client
      .from('financial_transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('household_id', validHouseholdId);
    const result = await applyFinanceDateRange(baseQuery, period)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
    const rows = unwrapSupabaseResult(result, { operation: 'carregar os lançamentos financeiros' });

    if (!Array.isArray(rows)) {
      throw new FinancialTransactionError(
        'INVALID_RESPONSE',
        'Os lançamentos financeiros não puderam ser carregados.',
      );
    }

    const { start, endExclusive } = getFinanceDateRange(period);
    const transactions = rows.map(mapFinancialTransaction);

    if (transactions.some((transaction) => (
      transaction.householdId !== validHouseholdId
      || transaction.transactionDate < start
      || transaction.transactionDate >= endExclusive
    ))) {
      throw new FinancialTransactionError(
        'INVALID_SCOPE',
        'Os lançamentos recebidos não correspondem ao período atual.',
      );
    }

    return sortFinancialTransactions(transactions);
  }

  async function create({ householdId, userId, period, categories, ...input }) {
    const validHouseholdId = validateFinanceUuid(householdId, 'identificador da household');
    const normalized = validateFinancialTransactionInput(input, { categories, period });
    const payload = {
      household_id: validHouseholdId,
      created_by: validateFinanceUuid(userId, 'identificador do usuário'),
      category_id: normalized.categoryId,
      type: normalized.type,
      description: normalized.description,
      amount: normalized.amount,
      transaction_date: normalized.transactionDate,
      notes: normalized.notes,
    };
    const result = await client
      .from('financial_transactions')
      .insert(payload)
      .select(TRANSACTION_COLUMNS)
      .single();
    const row = unwrapSupabaseResult(result, { operation: 'cadastrar o lançamento financeiro' });
    const transaction = mapFinancialTransaction(row);

    if (
      transaction.householdId !== validHouseholdId
      || transaction.createdBy !== userId
      || transaction.categoryId !== normalized.categoryId
      || transaction.type !== normalized.type
      || transaction.description !== normalized.description
      || transaction.amountCents !== normalized.amountCents
      || transaction.transactionDate !== normalized.transactionDate
      || transaction.notes !== normalized.notes
    ) {
      throw new FinancialTransactionError(
        'INVALID_RESPONSE',
        'O lançamento criado não corresponde à solicitação.',
      );
    }

    validateDateInPeriod(transaction.transactionDate, period);
    return transaction;
  }

  return Object.freeze({ create, listByPeriod });
}
