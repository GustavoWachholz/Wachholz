import { getFeedbackMarkup } from '../../ui/feedback.js';
import { SHOPPING_LIST_NAME_MAX_LENGTH } from './shopping-list-service.js';
import {
  bindShoppingItemsView,
  getShoppingItemsMarkup,
} from './shopping-items-view.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createFormMarkup(state) {
  const error = state.formError
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.formError.message)}</p>`
    : '';
  const notice = state.notice
    ? `<p class="form-message form-message--success" role="status">${escapeHtml(state.notice)}</p>`
    : '';

  return `
    <form class="shopping-list-form" data-shopping-list-form novalidate>
      <label for="shopping-list-name">Nova lista</label>
      <div class="shopping-list-form__controls">
        <input
          id="shopping-list-name"
          name="name"
          type="text"
          maxlength="${SHOPPING_LIST_NAME_MAX_LENGTH}"
          autocomplete="off"
          placeholder="Ex.: Mercado da semana"
          required
          ${state.isSubmitting ? 'disabled' : ''}
        >
        <button class="primary-button" type="submit" ${state.isSubmitting ? 'disabled aria-busy="true"' : ''}>
          ${state.isSubmitting ? 'Criando…' : 'Criar lista'}
        </button>
      </div>
      ${error}
      ${notice}
    </form>
  `;
}

function listCardsMarkup(lists) {
  return `
    <ul class="shopping-list-cards" aria-label="Listas de compras ativas">
      ${lists.map((list) => `
        <li>
          <a class="shopping-list-card" href="#/compras/${encodeURIComponent(list.id)}">
            <span>
              <strong>${escapeHtml(list.name)}</strong>
              <small>${list.pendingItems} ${list.pendingItems === 1 ? 'item pendente' : 'itens pendentes'}</small>
            </span>
            <span class="shopping-list-card__arrow" aria-hidden="true">›</span>
          </a>
        </li>
      `).join('')}
    </ul>
  `;
}

export function getShoppingListsMarkup(state = { status: 'idle', lists: [] }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return `
      <section class="route-panel" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Compras</h1>
        <div data-shopping-lists-feedback>
          ${getFeedbackMarkup({
            status: 'loading',
            title: 'Carregando suas listas…',
            message: 'Buscando as listas compartilhadas da casa.',
          })}
        </div>
      </section>
    `;
  }

  if (state.status === 'error') {
    return `
      <section class="route-panel" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Compras</h1>
        <div data-shopping-lists-feedback>
          ${getFeedbackMarkup({
            status: 'error',
            title: 'Listas indisponíveis',
            message: state.error?.message,
            actionLabel: 'Tentar novamente',
          })}
        </div>
      </section>
    `;
  }

  const content = state.lists.length
    ? listCardsMarkup(state.lists)
    : getFeedbackMarkup({
      status: 'empty',
      title: 'Nenhuma lista criada',
      message: 'Crie sua primeira lista de compras.',
    });

  return `
    <section class="shopping-lists" aria-labelledby="route-heading">
      <header class="shopping-lists__header">
        <p class="eyebrow">Colaboração da casa</p>
        <h1 id="route-heading">Compras</h1>
        <p>Crie uma lista e abra com um toque para organizar os próximos itens.</p>
      </header>
      ${createFormMarkup(state)}
      ${content}
    </section>
  `;
}

export function getShoppingListDetailMarkup(
  state,
  listId,
  { itemsState, currentUserId } = {},
) {
  if (state.status === 'loading' || state.status === 'idle') {
    return getShoppingListsMarkup(state);
  }

  if (state.status === 'error') {
    return getShoppingListsMarkup(state);
  }

  const list = state.lists.find((candidate) => candidate.id === listId);

  if (!list) {
    return `
      <section class="route-panel" aria-labelledby="route-heading">
        <h1 class="visually-hidden" id="route-heading">Lista não encontrada</h1>
        ${getFeedbackMarkup({
          status: 'error',
          title: 'Lista não encontrada',
          message: 'Ela pode ter sido removida ou não pertencer a esta casa.',
        })}
        <a class="secondary-button shopping-back-link" href="#/compras">Voltar para listas</a>
      </section>
    `;
  }

  const activeItemsState = itemsState?.listId === listId
    ? itemsState
    : { status: 'idle', listId, items: [] };

  return `
    <section class="shopping-list-detail" aria-labelledby="route-heading">
      <a class="shopping-back-link" href="#/compras">‹ Voltar para listas</a>
      <header class="shopping-list-detail__header">
        <p class="eyebrow">Lista compartilhada</p>
        <h1 id="route-heading">${escapeHtml(list.name)}</h1>
        <p>${list.pendingItems} ${list.pendingItems === 1 ? 'item pendente' : 'itens pendentes'}</p>
      </header>
      ${getShoppingItemsMarkup(activeItemsState, { currentUserId })}
    </section>
  `;
}

export function bindShoppingListsView(
  root,
  {
    onCreate,
    onRetry,
    onItemCreate = () => {},
    onItemsRetry = () => {},
    onItemEdit = () => {},
    onItemEditCancel = () => {},
    onItemUpdate = () => {},
    onItemToggle = () => {},
    onItemDelete = () => {},
  },
) {
  root.querySelector('[data-shopping-lists-feedback] [data-feedback-action]')
    ?.addEventListener('click', onRetry);
  const form = root.querySelector('[data-shopping-list-form]');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    onCreate(formData.get('name'));
  });

  bindShoppingItemsView(root, {
    onCreate: onItemCreate,
    onRetry: onItemsRetry,
    onEdit: onItemEdit,
    onEditCancel: onItemEditCancel,
    onUpdate: onItemUpdate,
    onToggle: onItemToggle,
    onDelete: onItemDelete,
  });
}
