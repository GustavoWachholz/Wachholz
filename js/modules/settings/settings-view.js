import { getFeedbackMarkup } from '../../ui/feedback.js';
import {
  formatFinancePeriod,
  getCurrentFinancePeriod,
  toFinanceMonthKey,
} from '../finance/utils/finance-period.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function exportMarkup(financeState) {
  const period = financeState.period;
  const isReady = financeState.status === 'ready';
  const hasTransactions = isReady && financeState.transactions.length > 0;
  let content;

  if (financeState.status === 'error') {
    content = getFeedbackMarkup({
      status: 'error',
      title: 'Mês indisponível',
      message: financeState.error?.message,
      actionLabel: 'Tentar novamente',
    });
  } else if (!isReady) {
    content = getFeedbackMarkup({
      status: 'loading',
      title: 'Carregando lançamentos…',
      message: 'Preparando os dados para exportação.',
    });
  } else if (!hasTransactions) {
    content = getFeedbackMarkup({
      status: 'empty',
      title: 'Nenhum lançamento neste mês',
      message: 'Escolha outro período ou cadastre um lançamento no financeiro.',
    });
  } else {
    content = `<p>${financeState.transactions.length} ${financeState.transactions.length === 1 ? 'lançamento será exportado' : 'lançamentos serão exportados'}.</p>`;
  }

  return `
    <section class="settings-card settings-export" aria-labelledby="settings-export-heading">
      <div>
        <p class="eyebrow">Cópia dos dados</p>
        <h2 id="settings-export-heading">Exportar financeiro</h2>
        <p>Baixe todos os lançamentos do mês em CSV UTF-8.</p>
      </div>
      <div class="settings-period" aria-label="Período da exportação">
        <button class="secondary-button" type="button" data-settings-previous-month aria-label="Mês anterior" ${isReady ? '' : 'disabled'}>‹</button>
        <time datetime="${toFinanceMonthKey(period)}">${escapeHtml(formatFinancePeriod(period))}</time>
        <button class="secondary-button" type="button" data-settings-next-month aria-label="Próximo mês" ${isReady ? '' : 'disabled'}>›</button>
      </div>
      <div data-settings-export-feedback aria-live="polite">${content}</div>
      <button class="primary-button settings-export__button" type="button" data-settings-export ${hasTransactions ? '' : 'disabled'}>
        Exportar CSV
      </button>
    </section>
  `;
}

export function getSettingsMarkup({ household, user, financeState } = {}) {
  const householdName = escapeHtml(household?.name ?? 'Nossa Casa');
  const email = escapeHtml(user?.email ?? 'Usuário autenticado');
  const exportState = financeState ?? {
    status: 'idle',
    period: getCurrentFinancePeriod(),
    transactions: [],
    error: null,
  };

  return `
    <section class="route-panel settings" aria-labelledby="route-heading">
      <header class="settings__header">
        <p class="eyebrow">Conta e casa</p>
        <h1 id="route-heading">Configurações</h1>
        <p>Consulte seus dados, exporte o financeiro e gerencie esta sessão.</p>
      </header>
      <section class="settings-card" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading">Dados da conta</h2>
        <dl class="account-summary">
          <div><dt>Household</dt><dd>${householdName}</dd></div>
          <div><dt>Conta</dt><dd>${email}</dd></div>
        </dl>
        <button class="secondary-button" type="button" data-app-logout>Sair deste dispositivo</button>
      </section>
      ${exportMarkup(exportState)}
    </section>
  `;
}

export function bindSettingsView(
  root,
  {
    onPreviousMonth = () => {},
    onNextMonth = () => {},
    onExport = () => {},
    onRetry = () => {},
  } = {},
) {
  root.querySelector('[data-settings-previous-month]')
    ?.addEventListener('click', onPreviousMonth);
  root.querySelector('[data-settings-next-month]')
    ?.addEventListener('click', onNextMonth);
  root.querySelector('[data-settings-export]')
    ?.addEventListener('click', onExport);
  root.querySelector('[data-settings-export-feedback] [data-feedback-action]')
    ?.addEventListener('click', onRetry);
}
