export const DEFAULT_ROUTE_PATH = '/dashboard';

export const APP_ROUTES = Object.freeze([
  Object.freeze({
    id: 'dashboard',
    path: '/dashboard',
    label: 'Início',
    title: 'Visão da casa',
  }),
  Object.freeze({
    id: 'finance',
    path: '/financeiro',
    label: 'Financeiro',
    title: 'Financeiro',
  }),
  Object.freeze({
    id: 'shopping',
    path: '/compras',
    label: 'Compras',
    title: 'Compras',
  }),
  Object.freeze({
    id: 'settings',
    path: '/configuracoes',
    label: 'Ajustes',
    title: 'Configurações',
  }),
]);

const SHOPPING_LIST_ROUTE = Object.freeze({
  id: 'shopping-list',
  path: '/compras/:listId',
  navigationId: 'shopping',
  label: 'Lista',
  title: 'Lista de compras',
});

const UUID_PATH_PATTERN = /^\/compras\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function pathFromHash(value) {
  const trimmedValue = String(value ?? '').trim();
  const hashIndex = trimmedValue.indexOf('#');
  const fragment = hashIndex >= 0 ? trimmedValue.slice(hashIndex + 1) : trimmedValue;
  return fragment.split('?')[0];
}

export function normalizeHash(value) {
  let path = pathFromHash(value);

  try {
    path = decodeURIComponent(path);
  } catch {
    return '/rota-invalida';
  }

  path = path.replace(/\/{2,}/g, '/');

  if (!path || path === '/') {
    return DEFAULT_ROUTE_PATH;
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  if (path.length > 1) {
    path = path.replace(/\/+$/, '');
  }

  return path;
}

export function resolveRoute(value) {
  const path = normalizeHash(value);
  let route = APP_ROUTES.find((candidate) => candidate.path === path) ?? null;
  let params = Object.freeze({});

  if (!route) {
    const shoppingListMatch = path.match(UUID_PATH_PATTERN);

    if (shoppingListMatch) {
      route = SHOPPING_LIST_ROUTE;
      params = Object.freeze({ listId: shoppingListMatch[1] });
    }
  }

  return Object.freeze({
    status: route ? 'matched' : 'not-found',
    path,
    route,
    params,
  });
}

export function resolveProtectedRoute(
  value,
  { sessionStatus = 'loading', householdStatus = 'idle' } = {},
) {
  const resolution = resolveRoute(value);

  if (sessionStatus === 'loading') {
    return Object.freeze({ ...resolution, status: 'loading' });
  }

  if (sessionStatus !== 'authenticated') {
    return Object.freeze({ ...resolution, status: 'login' });
  }

  if (householdStatus === 'idle' || householdStatus === 'loading') {
    return Object.freeze({ ...resolution, status: 'loading' });
  }

  if (householdStatus !== 'ready') {
    return Object.freeze({ ...resolution, status: 'error' });
  }

  return resolution.status === 'matched'
    ? Object.freeze({ ...resolution, status: 'ready' })
    : resolution;
}

export function getDocumentTitle(routeState) {
  return routeState?.route?.title
    ? `${routeState.route.title} · Nossa Casa`
    : 'Nossa Casa';
}
