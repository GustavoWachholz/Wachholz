import { getFeedbackMarkup } from '../../ui/feedback.js';
import {
  createEmptyDashboardSummary,
  formatCurrency,
  hasDashboardActivity,
  normalizeDashboardSummary,
} from './dashboard-summary.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cardsMarkup(summary) {
  return `
    <div class="dashboard-grid">
      <article class="summary-card summary-card--finance">
        <div class="summary-card__header">
          <div>
            <p class="summary-card__eyebrow">Mês atual</p>
            <h2>Financeiro</h2>
          </div>
          <span class="summary-card__symbol" aria-hidden="true">$</span>
        </div>
        <dl class="finance-summary">
          <div><dt>Receitas</dt><dd>${formatCurrency(summary.finance.income)}</dd></div>
          <div><dt>Despesas</dt><dd>${formatCurrency(summary.finance.expenses)}</dd></div>
          <div class="finance-summary__balance"><dt>Saldo</dt><dd>${formatCurrency(summary.finance.balance)}</dd></div>
        </dl>
        <a class="card-link" href="#/financeiro">Abrir financeiro</a>
      </article>

      <article class="summary-card summary-card--shopping">
        <div class="summary-card__header">
          <div>
            <p class="summary-card__eyebrow">Listas ativas</p>
            <h2>Compras</h2>
          </div>
          <span class="summary-card__symbol" aria-hidden="true">✓</span>
        </div>
        <p class="shopping-total"><strong>${summary.shopping.pendingItems}</strong> itens pendentes</p>
        <p class="shopping-lists">${summary.shopping.activeLists} listas ativas</p>
        <a class="card-link" href="#/compras">Abrir compras</a>
      </article>
    </div>
  `;
}

export function getDashboardMarkup({ household, dashboardState } = {}) {
  const householdName = escapeHtml(household?.name ?? 'Nossa casa');

  if (dashboardState?.status === 'loading') {
    return `
      <section class="route-panel" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Visão da casa</h1>
        ${getFeedbackMarkup({
          status: 'loading',
          title: 'Montando o resumo da casa…',
          message: 'Estamos reunindo financeiro e compras.',
        })}
      </section>
    `;
  }

  if (dashboardState?.status === 'error') {
    return `
      <section class="route-panel" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Visão da casa</h1>
        ${getFeedbackMarkup({
          status: 'error',
          title: 'Resumo indisponível',
          message: dashboardState.error?.message,
          actionLabel: 'Tentar novamente',
        })}
      </section>
    `;
  }

  const summary = normalizeDashboardSummary(
    dashboardState?.summary ?? createEmptyDashboardSummary(),
  );
  const emptyFeedback = hasDashboardActivity(summary)
    ? ''
    : getFeedbackMarkup({
      status: 'empty',
      title: 'Sua casa está pronta',
      message: 'Os resumos ganharão dados conforme compras e lançamentos forem adicionados.',
    });

  return `
    <section class="dashboard" aria-labelledby="route-heading">
      <header class="dashboard__header">
        <p class="eyebrow">Resumo compartilhado</p>
        <h1 id="route-heading">Visão da casa</h1>
        <p>Um olhar rápido para ${householdName}, pensado para consultar pelo celular.</p>
      </header>
      ${cardsMarkup(summary)}
      ${emptyFeedback}
    </section>
  `;
}
