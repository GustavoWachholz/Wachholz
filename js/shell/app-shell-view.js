import { APP_ROUTES } from '../router/app-routes.js';
import { getDashboardMarkup } from '../modules/dashboard/dashboard-view.js';
import { bindSettingsView, getSettingsMarkup } from '../modules/settings/settings-view.js';
import { bindFinanceView, getFinanceMarkup } from '../modules/finance/finance-view.js';
import {
  bindShoppingListsView,
  getShoppingListDetailMarkup,
  getShoppingListsMarkup,
} from '../modules/shopping/shopping-lists-view.js';
import { getFeedbackMarkup } from '../ui/feedback.js';

const ROUTE_ICONS = Object.freeze({
  dashboard: '⌂',
  finance: '$',
  shopping: '✓',
  settings: '⚙',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function navigationMarkup(activeRouteId, className, label) {
  const links = APP_ROUTES.map((route) => {
    const isActive = route.id === activeRouteId;
    return `
      <a class="app-nav__link" href="#${route.path}" ${isActive ? 'aria-current="page"' : ''}>
        <span class="app-nav__icon" aria-hidden="true">${ROUTE_ICONS[route.id]}</span>
        <span>${escapeHtml(route.label)}</span>
      </a>
    `;
  }).join('');

  return `<nav class="${className}" aria-label="${label}">${links}</nav>`;
}

function routeContentMarkup(
  route,
  {
    household,
    user,
    dashboardState,
    financeState,
    shoppingState,
    shoppingItemsState,
    routeState,
  },
) {
  const householdName = escapeHtml(household?.name ?? 'Nossa casa');

  switch (route?.id) {
    case 'finance':
      return getFinanceMarkup(financeState);
    case 'shopping':
      return getShoppingListsMarkup(shoppingState);
    case 'shopping-list':
      return getShoppingListDetailMarkup(
        shoppingState,
        routeState.params.listId,
        {
          itemsState: shoppingItemsState,
          currentUserId: user?.id,
        },
      );
    case 'settings':
      return getSettingsMarkup({ household, user, financeState });
    case 'dashboard':
    default:
      return getDashboardMarkup({
        household,
        dashboardState,
      });
  }
}

function statusContentMarkup(state) {
  if (state.routeState.status === 'error') {
    return `
      <section class="route-panel route-panel--status" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Casa indisponível</h1>
        ${getFeedbackMarkup({
          status: 'error',
          title: 'Não foi possível carregar seus dados',
          message: state.error?.message,
          actionLabel: 'Tentar novamente',
        })}
      </section>
    `;
  }

  if (state.routeState.status === 'not-found') {
    return `
      <section class="route-panel route-panel--status" aria-labelledby="route-heading">
        <p class="eyebrow">Rota inexistente</p>
        <h1 id="route-heading">Esta página não existe</h1>
        <p>O endereço informado não corresponde a uma área de Nossa Casa.</p>
        <a class="primary-button" href="#/dashboard">Voltar ao início</a>
      </section>
    `;
  }

  if (state.routeState.status === 'loading') {
    return `
      <section class="route-panel route-panel--status" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Carregando sua casa</h1>
        ${getFeedbackMarkup({
          status: 'loading',
          title: 'Carregando sua casa…',
          message: 'Preparando seu espaço compartilhado.',
        })}
      </section>
    `;
  }

  return routeContentMarkup(state.routeState.route, state);
}

export function getAppShellMarkup(state) {
  const route = state.routeState?.route;
  const activeRouteId = state.routeState?.status === 'ready'
    ? (route?.navigationId ?? route?.id)
    : null;
  const householdName = escapeHtml(state.household?.name ?? 'Nossa Casa');
  const routeTitle = escapeHtml(route?.title ?? 'Nossa Casa');
  const sessionError = state.sessionError
    ? `<p class="shell-alert" role="alert">${escapeHtml(state.sessionError.message)}</p>`
    : '';

  return `
    <button class="skip-link" type="button" data-skip-content>Ir para o conteúdo</button>
    <div class="app-layout">
      <aside class="desktop-sidebar">
        <a class="sidebar-brand" href="#/dashboard" aria-label="Nossa Casa — início">
          <span class="brand__mark" aria-hidden="true">NC</span>
          <span><strong>Nossa Casa</strong><small>${householdName}</small></span>
        </a>
        ${navigationMarkup(activeRouteId, 'app-nav app-nav--sidebar', 'Navegação principal')}
      </aside>

      <div class="app-main">
        <header class="app-header">
          <div>
            <span class="app-header__household">${householdName}</span>
            <strong>${routeTitle}</strong>
          </div>
          <button class="header-action" type="button" data-app-logout aria-label="Sair deste dispositivo">Sair</button>
        </header>
        ${sessionError}
        <div class="app-content" id="route-content" tabindex="-1">
          ${statusContentMarkup(state)}
        </div>
      </div>
    </div>
    ${navigationMarkup(activeRouteId, 'app-nav app-nav--bottom', 'Navegação principal')}
  `;
}

export function renderAppShell(
  root,
  state,
  {
    onLogout,
    onRetry,
    onFinancePreviousMonth = () => {},
    onFinanceNextMonth = () => {},
    onFinanceCategoryTypeChange = () => {},
    onFinanceCreate = () => {},
    onFinanceFilterTypeChange = () => {},
    onFinanceFilterCategoryChange = () => {},
    onFinanceEdit = () => {},
    onFinanceEditCancel = () => {},
    onFinanceUpdate = () => {},
    onFinanceDelete = () => {},
    onFinanceRetry = () => {},
    onDashboardRetry = () => {},
    onSettingsPreviousMonth = () => {},
    onSettingsNextMonth = () => {},
    onSettingsExport = () => {},
    onSettingsRetry = () => {},
    onShoppingCreate = () => {},
    onShoppingRetry = () => {},
    onShoppingItemCreate = () => {},
    onShoppingItemsRetry = () => {},
    onShoppingItemEdit = () => {},
    onShoppingItemEditCancel = () => {},
    onShoppingItemUpdate = () => {},
    onShoppingItemToggle = () => {},
    onShoppingItemDelete = () => {},
  },
) {
  root.hidden = state.routeState?.status === 'login';
  root.dataset.state = state.routeState?.status ?? 'loading';
  root.innerHTML = getAppShellMarkup(state);
  root.querySelectorAll('[data-app-logout]').forEach((button) => {
    button.addEventListener('click', onLogout);
  });
  if (state.routeState?.status === 'error') {
    root.querySelector('[data-feedback-action]')?.addEventListener('click', onRetry);
  }
  if (state.routeState?.route?.id === 'finance') {
    bindFinanceView(root, {
      onPreviousMonth: onFinancePreviousMonth,
      onNextMonth: onFinanceNextMonth,
      onCategoryTypeChange: onFinanceCategoryTypeChange,
      onCreate: onFinanceCreate,
      onFilterTypeChange: onFinanceFilterTypeChange,
      onFilterCategoryChange: onFinanceFilterCategoryChange,
      onEdit: onFinanceEdit,
      onEditCancel: onFinanceEditCancel,
      onUpdate: onFinanceUpdate,
      onDelete: onFinanceDelete,
      onRetry: onFinanceRetry,
    });
  }
  if (state.routeState?.route?.id === 'dashboard') {
    root.querySelector('[data-feedback-action]')
      ?.addEventListener('click', onDashboardRetry);
  }
  if (state.routeState?.route?.id === 'settings') {
    bindSettingsView(root, {
      onPreviousMonth: onSettingsPreviousMonth,
      onNextMonth: onSettingsNextMonth,
      onExport: onSettingsExport,
      onRetry: onSettingsRetry,
    });
  }
  if (state.routeState?.route?.navigationId === 'shopping'
    || state.routeState?.route?.id === 'shopping') {
    bindShoppingListsView(root, {
      onCreate: onShoppingCreate,
      onRetry: onShoppingRetry,
      onItemCreate: onShoppingItemCreate,
      onItemsRetry: onShoppingItemsRetry,
      onItemEdit: onShoppingItemEdit,
      onItemEditCancel: onShoppingItemEditCancel,
      onItemUpdate: onShoppingItemUpdate,
      onItemToggle: onShoppingItemToggle,
      onItemDelete: onShoppingItemDelete,
    });
  }
  root.querySelector('[data-skip-content]')?.addEventListener('click', () => {
    root.querySelector('#route-content')?.focus();
  });
}
