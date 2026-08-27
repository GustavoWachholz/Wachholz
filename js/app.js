import { createAuthService } from './auth/auth-service.js';
import { createSessionController } from './auth/session.js';
import { renderAuthView } from './auth/auth-view.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import { createHouseholdController } from './household/household-context.js';
import { createHouseholdService } from './household/household-service.js';
import { renderHouseholdView } from './household/household-view.js';
import { validatePublicConfig } from './lib/public-config.js';
import { getSupabaseClient } from './lib/supabase-client.js';
import { createFinanceController } from './modules/finance/finance-context.js';
import { downloadFinancialCsv } from './modules/finance/financial-csv.js';
import { createFinancialCategoryService } from './modules/finance/services/financial-category-service.js';
import { createFinancialTransactionService } from './modules/finance/services/financial-transaction-service.js';
import { formatFinanceMoney } from './modules/finance/utils/finance-money.js';
import { createDashboardController } from './modules/dashboard/dashboard-context.js';
import { createDashboardSummaryService } from './modules/dashboard/dashboard-service.js';
import { getDocumentTitle, resolveProtectedRoute } from './router/app-routes.js';
import { createHashRouter } from './router/hash-router.js';
import { renderAppShell } from './shell/app-shell-view.js';
import { createShoppingListService } from './modules/shopping/shopping-list-service.js';
import { createShoppingListsController } from './modules/shopping/shopping-lists-context.js';
import { createShoppingItemService } from './modules/shopping/shopping-item-service.js';
import { createShoppingItemsController } from './modules/shopping/shopping-items-context.js';
import { createShoppingItemsRealtime } from './modules/shopping/shopping-items-realtime.js';
import { openConfirmationDialog } from './ui/confirmation.js';

function renderConfigStatus(documentRoot, validation) {
  const container = documentRoot.querySelector('[data-auth-root]');

  if (!container) {
    return;
  }

  const title = container.querySelector('[data-config-title]');
  const message = container.querySelector('[data-config-message]');

  container.dataset.state = 'attention';
  title.textContent = 'Configuração pendente';
  message.textContent = validation.errors.join(' ');
}

async function bootstrap(documentRoot) {
  const config = {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  };
  const validation = validatePublicConfig(config);
  const authRoot = documentRoot.querySelector('[data-auth-root]');
  const householdRoot = documentRoot.querySelector('[data-household-root]');
  const appRoot = documentRoot.querySelector('[data-app-root]');
  const publicRoot = documentRoot.querySelector('[data-public-root]');
  const publicFooter = documentRoot.querySelector('[data-public-footer]');

  if (
    !authRoot
    || !householdRoot
    || !appRoot
    || !publicRoot
    || !publicFooter
    || !validation.isValid
  ) {
    renderConfigStatus(documentRoot, validation);
    return;
  }

  try {
    const client = await getSupabaseClient();
    const authService = createAuthService(client);
    const householdService = createHouseholdService(client);
    const financialCategoryService = createFinancialCategoryService(client);
    const financialTransactionService = createFinancialTransactionService(client);
    const shoppingListService = createShoppingListService(client);
    const shoppingItemService = createShoppingItemService(client);
    const shoppingItemsRealtime = createShoppingItemsRealtime(client);
    const dashboardSummaryService = createDashboardSummaryService({
      transactionService: financialTransactionService,
      shoppingListService,
    });
    let sessionController;
    let authenticatedUser = null;
    let authState = { status: 'loading', user: null, error: null };
    let householdState = { status: 'idle', household: null, error: null };
    let dashboardState = { status: 'idle', summary: null, error: null };
    let financeState;
    let shoppingState = { status: 'idle', lists: [], error: null };
    let shoppingItemsState = { status: 'idle', listId: null, items: [], error: null };
    let currentHash = window.location.hash;

    const requestLogout = () => openConfirmationDialog(
      documentRoot,
      {
        title: 'Sair deste dispositivo?',
        message: 'Você precisará entrar novamente para acessar os dados da casa.',
        confirmLabel: 'Sair',
        cancelLabel: 'Continuar conectado',
      },
      { onConfirm: () => sessionController.logout() },
    );

    const requestShoppingItemDeletion = (itemId) => {
      const item = shoppingItemsState.items.find((candidate) => candidate.id === itemId);

      if (!item || shoppingItemsState.status !== 'ready') {
        return;
      }

      openConfirmationDialog(
        documentRoot,
        {
          title: 'Excluir este item?',
          message: `“${item.name}” será removido da lista compartilhada para todos os moradores.`,
          confirmLabel: 'Excluir item',
          cancelLabel: 'Manter item',
        },
        {
          onConfirm: () => shoppingItemsController.remove({
            householdId: householdState.householdId,
            listId: shoppingItemsState.listId,
            itemId,
          }),
        },
      );
    };

    const requestFinancialTransactionDeletion = (transactionId) => {
      const transaction = financeState.transactions.find(
        (candidate) => candidate.id === transactionId,
      );

      if (!transaction || financeState.status !== 'ready') {
        return;
      }

      openConfirmationDialog(
        documentRoot,
        {
          title: 'Excluir este lançamento?',
          message: `“${transaction.description}” no valor de ${formatFinanceMoney(transaction.amountCents)} será removido do mês.`,
          confirmLabel: 'Excluir lançamento',
          cancelLabel: 'Manter lançamento',
        },
        { onConfirm: () => financeController.remove({ transactionId }) },
      );
    };

    const renderAuthenticatedSurface = ({ focusContent = false } = {}) => {
      const isAuthenticated = authState.status === 'authenticated';
      publicRoot.hidden = isAuthenticated;
      publicFooter.hidden = isAuthenticated;
      appRoot.hidden = !isAuthenticated;

      if (!isAuthenticated) {
        documentRoot.title = 'Nossa Casa';
        return;
      }

      const routeState = resolveProtectedRoute(currentHash, {
        sessionStatus: authState.status,
        householdStatus: householdState.status,
      });
      const route = routeState.route;

      if (
        routeState.status === 'ready'
        && route?.id !== 'shopping-list'
        && shoppingItemsState.status !== 'idle'
      ) {
        shoppingItemsController.clear();
        return;
      }

      documentRoot.title = getDocumentTitle(routeState);
      renderAppShell(
        appRoot,
        {
          routeState,
          household: householdState.household,
          user: authState.user,
          error: householdState.error,
          sessionError: authState.error,
          dashboardState,
          financeState,
          shoppingState,
          shoppingItemsState,
        },
        {
          onLogout: requestLogout,
          onRetry: () => householdController.load(authenticatedUser),
          onDashboardRetry: () => dashboardController.load(householdState.householdId),
          onFinancePreviousMonth: () => financeController.shiftMonth(-1),
          onFinanceNextMonth: () => financeController.shiftMonth(1),
          onFinanceCategoryTypeChange: (type) => financeController.selectCategoryType(type),
          onFinanceCreate: (input) => financeController.create({
            ...input,
            userId: authenticatedUser?.id,
          }),
          onFinanceFilterTypeChange: (type) => financeController.setFilters({ type }),
          onFinanceFilterCategoryChange: (categoryId) => (
            financeController.setFilters({ categoryId })
          ),
          onFinanceEdit: (transactionId) => financeController.startEdit(transactionId),
          onFinanceEditCancel: () => financeController.cancelEdit(),
          onFinanceUpdate: (input) => financeController.update(input),
          onFinanceDelete: requestFinancialTransactionDeletion,
          onFinanceRetry: () => financeController.load({
            householdId: householdState.householdId,
            period: financeState.period,
            type: financeState.categoryType,
          }),
          onSettingsPreviousMonth: () => financeController.shiftMonth(-1),
          onSettingsNextMonth: () => financeController.shiftMonth(1),
          onSettingsExport: () => downloadFinancialCsv({
            transactions: financeState.transactions,
            period: financeState.period,
          }),
          onSettingsRetry: () => financeController.load({
            householdId: householdState.householdId,
            period: financeState.period,
            type: financeState.categoryType,
          }),
          onShoppingCreate: (name) => shoppingController.create({
            householdId: householdState.householdId,
            userId: authenticatedUser?.id,
            name,
          }),
          onShoppingRetry: () => shoppingController.load(householdState.householdId),
          onShoppingItemCreate: (input) => shoppingItemsController.create({
            householdId: householdState.householdId,
            listId: routeState.params.listId,
            userId: authenticatedUser?.id,
            ...input,
          }),
          onShoppingItemsRetry: () => shoppingItemsController.load({
            householdId: householdState.householdId,
            listId: routeState.params.listId,
          }),
          onShoppingItemEdit: (itemId) => shoppingItemsController.startEdit(itemId),
          onShoppingItemEditCancel: () => shoppingItemsController.cancelEdit(),
          onShoppingItemUpdate: (input) => shoppingItemsController.update({
            householdId: householdState.householdId,
            listId: routeState.params.listId,
            ...input,
          }),
          onShoppingItemToggle: (input) => shoppingItemsController.setChecked({
            householdId: householdState.householdId,
            listId: routeState.params.listId,
            ...input,
          }),
          onShoppingItemDelete: requestShoppingItemDeletion,
        },
      );

      const isShoppingRoute = route?.id === 'shopping'
        || route?.navigationId === 'shopping';

      if (
        routeState.status === 'ready'
        && route?.id === 'dashboard'
        && dashboardState.status === 'idle'
      ) {
        dashboardController.load(householdState.householdId);
      }

      if (
        routeState.status === 'ready'
        && (route?.id === 'finance' || route?.id === 'settings')
        && financeState.status === 'idle'
      ) {
        financeController.load({ householdId: householdState.householdId });
      }

      if (
        routeState.status === 'ready'
        && isShoppingRoute
        && shoppingState.status === 'idle'
      ) {
        shoppingController.load(householdState.householdId);
      }

      const selectedListId = routeState.params?.listId;
      const selectedListExists = shoppingState.status === 'ready'
        && shoppingState.lists.some((list) => list.id === selectedListId);

      if (
        routeState.status === 'ready'
        && route?.id === 'shopping-list'
        && shoppingState.status === 'ready'
        && !selectedListExists
        && shoppingItemsState.status !== 'idle'
      ) {
        shoppingItemsController.clear();
        return;
      }

      if (
        routeState.status === 'ready'
        && route?.id === 'shopping-list'
        && selectedListExists
        && (
          shoppingItemsState.status === 'idle'
          || shoppingItemsState.listId !== selectedListId
        )
      ) {
        shoppingItemsController.load({
          householdId: householdState.householdId,
          listId: selectedListId,
        });
      }

      if (focusContent) {
        appRoot.querySelector('#route-content')?.focus();
      }
    };

    const householdController = createHouseholdController({
      householdService,
      onStateChange: (state) => {
        householdState = state;
        renderHouseholdView(householdRoot, state, {
          onRetry: () => householdController.load(authenticatedUser),
        });
        renderAuthenticatedSurface();
      },
    });

    const dashboardController = createDashboardController({
      summaryService: dashboardSummaryService,
      onStateChange: (state) => {
        const finishedLoading = dashboardState.status === 'loading'
          && (state.status === 'ready' || state.status === 'error');
        dashboardState = state;
        renderAuthenticatedSurface({ focusContent: finishedLoading });
      },
    });

    const financeController = createFinanceController({
      categoryService: financialCategoryService,
      transactionService: financialTransactionService,
      onStateChange: (state) => {
        const finishedLoading = financeState.status === 'loading'
          && (state.status === 'ready' || state.status === 'error');
        financeState = state;
        renderAuthenticatedSurface({ focusContent: finishedLoading });
      },
    });
    financeState = financeController.getState();

    const shoppingController = createShoppingListsController({
      listService: shoppingListService,
      onStateChange: (state) => {
        const finishedLoading = shoppingState.status === 'loading'
          && (state.status === 'ready' || state.status === 'error');
        shoppingState = state;
        renderAuthenticatedSurface({ focusContent: finishedLoading });
      },
    });

    const shoppingItemsController = createShoppingItemsController({
      itemService: shoppingItemService,
      realtimeService: shoppingItemsRealtime,
      onStateChange: (state) => {
        const finishedLoading = shoppingItemsState.status === 'loading'
          && (state.status === 'ready' || state.status === 'error');
        shoppingItemsState = state;

        if (state.status === 'ready') {
          const pendingItems = state.items.filter((item) => !item.isChecked).length;
          shoppingController.setPendingCount(state.listId, pendingItems);
        }

        renderAuthenticatedSurface({ focusContent: finishedLoading });
      },
    });

    const router = createHashRouter({
      windowTarget: window,
      onRouteChange: (resolution) => {
        currentHash = resolution.path;
        if (resolution.route?.id === 'dashboard') {
          dashboardController.clear();
          return;
        }
        renderAuthenticatedSurface({ focusContent: true });
      },
    });

    const render = (state) => {
      authState = state;
      renderAuthView(authRoot, state, {
        onLogin: (credentials) => sessionController.login(credentials),
        onLogout: requestLogout,
        onRetry: () => sessionController.start(),
      });

      if (state.status === 'authenticated') {
        const userChanged = authenticatedUser?.id !== state.user?.id;
        authenticatedUser = state.user;

        if (userChanged) {
          householdController.load(authenticatedUser);
          dashboardController.clear();
          financeController.clear();
          shoppingItemsController.clear();
          shoppingController.clear();
        } else if (householdController.getState().status === 'idle') {
          householdController.load(authenticatedUser);
        }
      } else {
        authenticatedUser = null;
        dashboardController.clear();
        financeController.clear();
        shoppingItemsController.clear();
        shoppingController.clear();
        householdController.clear();
      }

      renderAuthenticatedSurface();
    };

    sessionController = createSessionController({ authService, onStateChange: render });
    router.start();
    window.addEventListener(
      'pagehide',
      () => {
        router.stop();
        shoppingItemsController.clear();
        sessionController.stop();
      },
      { once: true },
    );
    await sessionController.start();
  } catch (error) {
    console.error('Falha ao inicializar a autenticação.', error);
    renderAuthView(
      authRoot,
      { status: 'error', error: new Error('Revise a configuração pública do Supabase.') },
      { onLogin() {}, onLogout() {}, onRetry: () => window.location.reload() },
    );
  }
}

await bootstrap(document);
