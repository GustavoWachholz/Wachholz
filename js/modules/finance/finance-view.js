import { getFeedbackMarkup } from '../../ui/feedback.js';
import { FINANCE_TYPES } from './services/financial-category-service.js';
import { FINANCIAL_TRANSACTION_LIMITS } from './services/financial-transaction-service.js';
import { createEmptyFinancialSummary } from './financial-summary.js';
import { formatFinanceMoney } from './utils/finance-money.js';
import {
  formatFinanceDate,
  formatFinancePeriod,
  getFinanceDateRange,
  toFinanceMonthKey,
} from './utils/finance-period.js';

const TYPE_LABELS = Object.freeze({
  income: 'Receita',
  expense: 'Despesa',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function periodSelectorMarkup(period, isDisabled) {
  const label = formatFinancePeriod(period);
  return `
    <div class="finance-period" aria-label="Período financeiro">
      <button class="secondary-button finance-period__button" type="button" data-finance-previous-month aria-label="Mês anterior" ${isDisabled ? 'disabled' : ''}>‹</button>
      <time datetime="${toFinanceMonthKey(period)}">${escapeHtml(label)}</time>
      <button class="secondary-button finance-period__button" type="button" data-finance-next-month aria-label="Próximo mês" ${isDisabled ? 'disabled' : ''}>›</button>
    </div>
  `;
}

function summaryMarkup(summary = createEmptyFinancialSummary()) {
  return `
    <dl class="financial-totals" aria-label="Totais do mês">
      <div>
        <dt>Receitas</dt>
        <dd>${formatFinanceMoney(summary.incomeCents)}</dd>
      </div>
      <div>
        <dt>Despesas</dt>
        <dd>${formatFinanceMoney(summary.expenseCents)}</dd>
      </div>
      <div class="financial-totals__balance">
        <dt>Saldo</dt>
        <dd>${formatFinanceMoney(summary.balanceCents)}</dd>
      </div>
      <div class="financial-totals__count">
        <dt>Lançamentos</dt>
        <dd>${summary.transactionCount}</dd>
      </div>
    </dl>
  `;
}

function lastDateOfPeriod(period) {
  const day = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  return `${toFinanceMonthKey(period)}-${String(day).padStart(2, '0')}`;
}

function categoryOptionsMarkup(state) {
  if (state.isCategoryLoading) {
    return '<option value="">Carregando categorias…</option>';
  }

  if (!state.categories.length) {
    return '<option value="">Nenhuma categoria disponível</option>';
  }

  return `
    <option value="">Selecione uma categoria</option>
    ${state.categories.map((category) => (
      `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
    )).join('')}
  `;
}

function transactionFormMarkup(state) {
  const isDisabled = state.status !== 'ready'
    || state.isSubmitting
    || state.isCategoryLoading
    || !state.categories.length;
  const typeControlsDisabled = state.status !== 'ready'
    || state.isSubmitting
    || state.isCategoryLoading;
  const { start } = getFinanceDateRange(state.period);
  const formError = state.formError
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.formError.message)}</p>`
    : '';
  const categoryError = state.categoryError
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.categoryError.message)}</p>`
    : '';
  const notice = state.notice
    ? `<p class="form-message form-message--success" role="status">${escapeHtml(state.notice)}</p>`
    : '';

  return `
    <section class="financial-entry" aria-labelledby="financial-entry-heading">
      <div class="financial-entry__header">
        <p class="eyebrow">Novo registro</p>
        <h2 id="financial-entry-heading">Adicionar lançamento</h2>
      </div>
      <div class="finance-type-selector" role="group" aria-label="Tipo do lançamento">
        ${FINANCE_TYPES.map((type) => `
          <button
            type="button"
            data-finance-category-type="${type}"
            aria-pressed="${state.categoryType === type}"
            ${typeControlsDisabled ? 'disabled' : ''}
          >${TYPE_LABELS[type]}</button>
        `).join('')}
      </div>
      ${categoryError}
      <form class="financial-entry-form" data-financial-transaction-form novalidate>
        <div class="form-field financial-entry-form__description">
          <label for="financial-description">Descrição</label>
          <input id="financial-description" name="description" type="text" maxlength="${FINANCIAL_TRANSACTION_LIMITS.description}" autocomplete="off" placeholder="Ex.: Supermercado" required ${isDisabled ? 'disabled' : ''}>
        </div>
        <div class="form-field">
          <label for="financial-amount">Valor</label>
          <input id="financial-amount" name="amount" type="text" inputmode="decimal" placeholder="0,00" required ${isDisabled ? 'disabled' : ''}>
        </div>
        <div class="form-field">
          <label for="financial-date">Data</label>
          <input id="financial-date" name="transactionDate" type="date" min="${start}" max="${lastDateOfPeriod(state.period)}" value="${start}" required ${isDisabled ? 'disabled' : ''}>
        </div>
        <div class="form-field financial-entry-form__category">
          <label for="financial-category">Categoria</label>
          <select id="financial-category" name="categoryId" required ${isDisabled ? 'disabled' : ''}>
            ${categoryOptionsMarkup(state)}
          </select>
        </div>
        <details class="financial-entry-form__details">
          <summary>Adicionar observação</summary>
          <div class="form-field">
            <label for="financial-notes">Observação</label>
            <textarea id="financial-notes" name="notes" maxlength="${FINANCIAL_TRANSACTION_LIMITS.notes}" rows="2" ${isDisabled ? 'disabled' : ''}></textarea>
          </div>
        </details>
        ${formError}
        ${notice}
        <button class="primary-button financial-entry-form__submit" type="submit" ${isDisabled ? 'disabled' : ''} ${state.isSubmitting ? 'aria-busy="true"' : ''}>
          ${state.isSubmitting ? 'Salvando…' : `Adicionar ${TYPE_LABELS[state.categoryType].toLowerCase()}`}
        </button>
      </form>
    </section>
  `;
}

function transactionsMarkup(state) {
  if (state.status === 'loading' || state.status === 'idle') {
    return getFeedbackMarkup({
      status: 'loading',
      title: 'Carregando lançamentos…',
      message: 'Buscando somente os registros do mês selecionado.',
    });
  }

  if (state.status === 'error') {
    return getFeedbackMarkup({
      status: 'error',
      title: 'Lançamentos indisponíveis',
      message: state.error?.message,
      actionLabel: 'Tentar novamente',
    });
  }

  if (!state.transactions.length) {
    return getFeedbackMarkup({
      status: 'empty',
      title: 'Nenhum lançamento neste mês',
      message: 'Use o formulário acima para registrar a primeira movimentação.',
    });
  }

  return `
    <ol class="financial-transactions" aria-label="Lançamentos do mês">
      ${state.transactions.map((transaction) => {
        const isIncome = transaction.type === 'income';
        const amountPrefix = isIncome ? '+' : '−';
        return `
          <li>
            <article class="financial-transaction financial-transaction--${transaction.type}">
              <div class="financial-transaction__main">
                <span class="financial-transaction__type">${TYPE_LABELS[transaction.type]}</span>
                <h3>${escapeHtml(transaction.description)}</h3>
                <p>${escapeHtml(transaction.categoryName)} · <time datetime="${transaction.transactionDate}">${formatFinanceDate(transaction.transactionDate)}</time></p>
                ${transaction.notes ? `<small>${escapeHtml(transaction.notes)}</small>` : ''}
              </div>
              <strong class="financial-transaction__amount">${amountPrefix}${formatFinanceMoney(transaction.amountCents)}</strong>
            </article>
          </li>
        `;
      }).join('')}
    </ol>
  `;
}

export function getFinanceMarkup(state) {
  return `
    <section class="route-panel finance-foundation" aria-labelledby="route-heading">
      <header class="finance-foundation__header">
        <p class="eyebrow">Organização mensal</p>
        <h1 id="route-heading">Financeiro</h1>
        <p>Registre receitas e despesas e acompanhe os totais do mês.</p>
      </header>
      ${periodSelectorMarkup(state.period, state.status !== 'ready')}
      ${summaryMarkup(state.summary)}
      ${transactionFormMarkup(state)}
      <section class="financial-history" aria-labelledby="financial-history-heading">
        <div class="financial-history__header">
          <p class="eyebrow">Histórico mensal</p>
          <h2 id="financial-history-heading">Lançamentos</h2>
        </div>
        <div data-financial-transactions-feedback aria-live="polite">
          ${transactionsMarkup(state)}
        </div>
      </section>
    </section>
  `;
}

export function bindFinanceView(
  root,
  {
    onPreviousMonth = () => {},
    onNextMonth = () => {},
    onCategoryTypeChange = () => {},
    onCreate = () => {},
    onRetry = () => {},
  },
) {
  root.querySelector('[data-finance-previous-month]')
    ?.addEventListener('click', onPreviousMonth);
  root.querySelector('[data-finance-next-month]')
    ?.addEventListener('click', onNextMonth);
  root.querySelectorAll('[data-finance-category-type]').forEach((button) => {
    button.addEventListener('click', () => onCategoryTypeChange(button.dataset.financeCategoryType));
  });
  root.querySelector('[data-financial-transactions-feedback] [data-feedback-action]')
    ?.addEventListener('click', onRetry);

  const form = root.querySelector('[data-financial-transaction-form]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    onCreate({
      description: formData.get('description'),
      amount: formData.get('amount'),
      transactionDate: formData.get('transactionDate'),
      categoryId: formData.get('categoryId'),
      notes: formData.get('notes'),
    });
  });
}
