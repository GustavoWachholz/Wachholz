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

function moneyInputValue(cents) {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole},${fraction}`;
}

function transactionFilterMarkup(state) {
  const categories = [...new Map(
    state.transactions
      .filter((transaction) => (
        state.filterType === 'all' || transaction.type === state.filterType
      ))
      .map((transaction) => [transaction.categoryId, transaction.categoryName]),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));
  const isDisabled = state.status !== 'ready' || Boolean(state.pendingTransactionId);

  return `
    <div class="financial-filters" aria-label="Filtros dos lançamentos">
      <div class="form-field">
        <label for="financial-filter-type">Tipo</label>
        <select id="financial-filter-type" data-finance-filter-type ${isDisabled ? 'disabled' : ''}>
          <option value="all" ${state.filterType === 'all' ? 'selected' : ''}>Todos os tipos</option>
          ${FINANCE_TYPES.map((type) => (
            `<option value="${type}" ${state.filterType === type ? 'selected' : ''}>${TYPE_LABELS[type]}</option>`
          )).join('')}
        </select>
      </div>
      <div class="form-field">
        <label for="financial-filter-category">Categoria</label>
        <select id="financial-filter-category" data-finance-filter-category ${isDisabled ? 'disabled' : ''}>
          <option value="all">Todas as categorias</option>
          ${categories.map(([id, name]) => (
            `<option value="${escapeHtml(id)}" ${state.filterCategoryId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`
          )).join('')}
        </select>
      </div>
    </div>
  `;
}

function editCategoryOptionsMarkup(state, transaction) {
  const hasCurrentCategory = state.editCategories.some(
    (category) => category.id === transaction.categoryId,
  );
  const currentFallback = hasCurrentCategory ? '' : `
    <option
      value="${escapeHtml(transaction.categoryId)}"
      data-category-type="${transaction.type}"
      disabled
    >${escapeHtml(transaction.categoryName)} (inativa)</option>
  `;

  return `
    <option value="">Selecione uma categoria</option>
    ${currentFallback}
    ${state.editCategories.map((category) => `
      <option
        value="${escapeHtml(category.id)}"
        data-category-type="${category.type}"
        ${category.id === transaction.categoryId ? 'selected' : ''}
      >${escapeHtml(category.name)}</option>
    `).join('')}
  `;
}

function transactionEditMarkup(state, transaction) {
  if (state.isEditCategoryLoading) {
    return getFeedbackMarkup({
      status: 'loading',
      title: 'Carregando categorias…',
      message: 'Preparando a edição do lançamento.',
    });
  }

  const isPending = state.pendingTransactionId === transaction.id;
  const { start } = getFinanceDateRange(state.period);
  const formError = state.formError
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.formError.message)}</p>`
    : '';

  return `
    <form class="financial-transaction-edit" data-financial-transaction-edit="${transaction.id}" novalidate>
      <div class="form-field financial-transaction-edit__description">
        <label for="financial-edit-description-${transaction.id}">Descrição</label>
        <input id="financial-edit-description-${transaction.id}" name="description" type="text" maxlength="${FINANCIAL_TRANSACTION_LIMITS.description}" value="${escapeHtml(transaction.description)}" required ${isPending ? 'disabled' : ''}>
      </div>
      <div class="form-field">
        <label for="financial-edit-type-${transaction.id}">Tipo</label>
        <select id="financial-edit-type-${transaction.id}" name="type" data-financial-edit-type required ${isPending ? 'disabled' : ''}>
          ${FINANCE_TYPES.map((type) => (
            `<option value="${type}" ${transaction.type === type ? 'selected' : ''}>${TYPE_LABELS[type]}</option>`
          )).join('')}
        </select>
      </div>
      <div class="form-field">
        <label for="financial-edit-amount-${transaction.id}">Valor</label>
        <input id="financial-edit-amount-${transaction.id}" name="amount" type="text" inputmode="decimal" value="${moneyInputValue(transaction.amountCents)}" required ${isPending ? 'disabled' : ''}>
      </div>
      <div class="form-field">
        <label for="financial-edit-date-${transaction.id}">Data</label>
        <input id="financial-edit-date-${transaction.id}" name="transactionDate" type="date" min="${start}" max="${lastDateOfPeriod(state.period)}" value="${transaction.transactionDate}" required ${isPending ? 'disabled' : ''}>
      </div>
      <div class="form-field financial-transaction-edit__category">
        <label for="financial-edit-category-${transaction.id}">Categoria</label>
        <select id="financial-edit-category-${transaction.id}" name="categoryId" data-financial-edit-category required ${isPending ? 'disabled' : ''}>
          ${editCategoryOptionsMarkup(state, transaction)}
        </select>
      </div>
      <div class="form-field financial-transaction-edit__notes">
        <label for="financial-edit-notes-${transaction.id}">Observação</label>
        <textarea id="financial-edit-notes-${transaction.id}" name="notes" maxlength="${FINANCIAL_TRANSACTION_LIMITS.notes}" rows="2" ${isPending ? 'disabled' : ''}>${escapeHtml(transaction.notes)}</textarea>
      </div>
      ${formError}
      <div class="financial-transaction-edit__actions">
        <button class="secondary-button" type="button" data-financial-edit-cancel ${isPending ? 'disabled' : ''}>Cancelar</button>
        <button class="primary-button" type="submit" ${isPending ? 'disabled aria-busy="true"' : ''}>${isPending ? 'Salvando…' : 'Salvar alterações'}</button>
      </div>
    </form>
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

  if (!state.visibleTransactions.length) {
    return getFeedbackMarkup({
      status: 'empty',
      title: 'Nenhum lançamento corresponde aos filtros',
      message: 'Altere o tipo ou a categoria para ver outros registros.',
    });
  }

  return `
    <ol class="financial-transactions" aria-label="Lançamentos do mês">
      ${state.visibleTransactions.map((transaction) => {
        const isIncome = transaction.type === 'income';
        const amountPrefix = isIncome ? '+' : '−';
        const isEditing = state.editingTransactionId === transaction.id;
        const isPending = state.pendingTransactionId === transaction.id;
        return `
          <li>
            <article class="financial-transaction financial-transaction--${transaction.type}">
              ${isEditing ? transactionEditMarkup(state, transaction) : `
                <div class="financial-transaction__main">
                  <span class="financial-transaction__type">${TYPE_LABELS[transaction.type]}</span>
                  <h3>${escapeHtml(transaction.description)}</h3>
                  <p>${escapeHtml(transaction.categoryName)} · <time datetime="${transaction.transactionDate}">${formatFinanceDate(transaction.transactionDate)}</time></p>
                  ${transaction.notes ? `<small>${escapeHtml(transaction.notes)}</small>` : ''}
                </div>
                <div class="financial-transaction__side">
                  <strong class="financial-transaction__amount">${amountPrefix}${formatFinanceMoney(transaction.amountCents)}</strong>
                  <div class="financial-transaction__actions">
                    <button class="secondary-button" type="button" data-financial-transaction-edit="${transaction.id}" ${isPending ? 'disabled' : ''}>Editar</button>
                    <button class="secondary-button financial-transaction__delete" type="button" data-financial-transaction-delete="${transaction.id}" ${isPending ? 'disabled' : ''}>Excluir</button>
                  </div>
                </div>
              `}
            </article>
          </li>
        `;
      }).join('')}
    </ol>
  `;
}

export function getFinanceMarkup(state) {
  const viewState = {
    filterType: 'all',
    filterCategoryId: 'all',
    visibleTransactions: state.transactions,
    editCategories: [],
    editingTransactionId: null,
    isEditCategoryLoading: false,
    pendingTransactionId: null,
    operationError: null,
    ...state,
  };
  return `
    <section class="route-panel finance-foundation" aria-labelledby="route-heading">
      <header class="finance-foundation__header">
        <p class="eyebrow">Organização mensal</p>
        <h1 id="route-heading">Financeiro</h1>
        <p>Registre receitas e despesas e acompanhe os totais do mês.</p>
      </header>
      ${periodSelectorMarkup(viewState.period, viewState.status !== 'ready')}
      ${summaryMarkup(viewState.summary)}
      ${transactionFormMarkup(viewState)}
      <section class="financial-history" aria-labelledby="financial-history-heading">
        <div class="financial-history__header">
          <p class="eyebrow">Histórico mensal</p>
          <h2 id="financial-history-heading">Lançamentos</h2>
        </div>
        ${transactionFilterMarkup(viewState)}
        ${viewState.operationError ? `<p class="form-message form-message--error" role="alert">${escapeHtml(viewState.operationError.message)}</p>` : ''}
        <div data-financial-transactions-feedback aria-live="polite">
          ${transactionsMarkup(viewState)}
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
    onFilterTypeChange = () => {},
    onFilterCategoryChange = () => {},
    onEdit = () => {},
    onEditCancel = () => {},
    onUpdate = () => {},
    onDelete = () => {},
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
  root.querySelector('[data-finance-filter-type]')
    ?.addEventListener('change', (event) => onFilterTypeChange(event.currentTarget.value));
  root.querySelector('[data-finance-filter-category]')
    ?.addEventListener('change', (event) => onFilterCategoryChange(event.currentTarget.value));
  root.querySelectorAll('button[data-financial-transaction-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(button.dataset.financialTransactionEdit));
  });
  root.querySelectorAll('[data-financial-transaction-delete]').forEach((button) => {
    button.addEventListener('click', () => onDelete(button.dataset.financialTransactionDelete));
  });
  root.querySelectorAll('[data-financial-transaction-edit]').forEach((form) => {
    if (form.tagName !== 'FORM') {
      return;
    }

    const typeSelect = form.querySelector('[data-financial-edit-type]');
    const categorySelect = form.querySelector('[data-financial-edit-category]');
    const syncCategoryOptions = () => {
      const selectedType = typeSelect.value;
      [...categorySelect.options].forEach((option) => {
        const optionType = option.dataset.categoryType;
        option.hidden = Boolean(optionType && optionType !== selectedType);
        option.disabled = Boolean(optionType && optionType !== selectedType);
      });
      const selectedOption = categorySelect.options[categorySelect.selectedIndex];
      if (selectedOption?.disabled) {
        categorySelect.value = '';
      }
    };
    typeSelect?.addEventListener('change', syncCategoryOptions);
    syncCategoryOptions();
    form.querySelector('[data-financial-edit-cancel]')
      ?.addEventListener('click', onEditCancel);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      onUpdate({
        transactionId: form.dataset.financialTransactionEdit,
        type: formData.get('type'),
        description: formData.get('description'),
        amount: formData.get('amount'),
        transactionDate: formData.get('transactionDate'),
        categoryId: formData.get('categoryId'),
        notes: formData.get('notes'),
      });
    });
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
