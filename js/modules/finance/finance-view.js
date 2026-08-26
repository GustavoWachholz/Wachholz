import { getFeedbackMarkup } from '../../ui/feedback.js';
import { FINANCE_TYPES } from './services/financial-category-service.js';
import {
  formatFinancePeriod,
  toFinanceMonthKey,
} from './utils/finance-period.js';

const TYPE_LABELS = Object.freeze({
  income: 'Receitas',
  expense: 'Despesas',
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

function categoryContentMarkup(state) {
  if (state.status === 'loading' || state.status === 'idle') {
    return getFeedbackMarkup({
      status: 'loading',
      title: 'Carregando categorias…',
      message: 'Preparando os filtros financeiros desta casa.',
    });
  }

  if (state.status === 'error') {
    return getFeedbackMarkup({
      status: 'error',
      title: 'Categorias indisponíveis',
      message: state.error?.message,
      actionLabel: 'Tentar novamente',
    });
  }

  if (!state.categories.length) {
    return getFeedbackMarkup({
      status: 'empty',
      title: `Nenhuma categoria de ${TYPE_LABELS[state.categoryType].toLowerCase()}`,
      message: 'As categorias poderão ser configuradas antes do primeiro lançamento.',
    });
  }

  return `
    <ul class="finance-categories" aria-label="Categorias de ${TYPE_LABELS[state.categoryType].toLowerCase()}">
      ${state.categories.map((category) => `<li>${escapeHtml(category.name)}</li>`).join('')}
    </ul>
  `;
}

export function getFinanceMarkup(state) {
  const period = state?.period;
  const categoryType = FINANCE_TYPES.includes(state?.categoryType)
    ? state.categoryType
    : 'expense';

  return `
    <section class="route-panel finance-foundation" aria-labelledby="route-heading">
      <header class="finance-foundation__header">
        <p class="eyebrow">Organização mensal</p>
        <h1 id="route-heading">Financeiro</h1>
        <p>Escolha o mês e confira as categorias disponíveis para os próximos lançamentos.</p>
      </header>
      ${periodSelectorMarkup(period, state?.status !== 'ready')}
      <section class="finance-categories-panel" aria-labelledby="finance-categories-heading">
        <div class="finance-categories-panel__header">
          <div>
            <p class="eyebrow">Base de cadastro</p>
            <h2 id="finance-categories-heading">Categorias</h2>
          </div>
          <div class="finance-type-selector" role="group" aria-label="Tipo das categorias">
            ${FINANCE_TYPES.map((type) => `
              <button
                type="button"
                data-finance-category-type="${type}"
                aria-pressed="${categoryType === type}"
                ${state?.status === 'loading' ? 'disabled' : ''}
              >${TYPE_LABELS[type]}</button>
            `).join('')}
          </div>
        </div>
        <div class="finance-categories-panel__content" aria-live="polite">
          ${categoryContentMarkup({ ...state, categoryType })}
        </div>
      </section>
      <p class="route-placeholder" role="status">Cadastro e totais dos lançamentos entram na próxima fase.</p>
    </section>
  `;
}

export function bindFinanceView(
  root,
  {
    onPreviousMonth = () => {},
    onNextMonth = () => {},
    onCategoryTypeChange = () => {},
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
  root.querySelector('.finance-categories-panel [data-feedback-action]')
    ?.addEventListener('click', onRetry);
}
