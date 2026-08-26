import { getFeedbackMarkup } from '../../ui/feedback.js';
import { SHOPPING_ITEM_LIMITS } from './shopping-item-service.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatQuantity(item) {
  if (item.quantity === null) {
    return '';
  }

  const quantity = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(item.quantity);
  return `${quantity}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}`;
}

function itemFormMarkup(state) {
  const isDisabled = Boolean(state.isSubmitting || state.pendingItemId);
  const error = state.formError && !state.editingItemId
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.formError.message)}</p>`
    : '';
  const notice = state.notice
    ? `<p class="form-message form-message--success" role="status">${escapeHtml(state.notice)}</p>`
    : '';

  return `
    <form class="shopping-item-form" data-shopping-item-form novalidate>
      <label class="visually-hidden" for="shopping-item-name">Adicionar item</label>
      <div class="shopping-item-form__quick">
        <input
          id="shopping-item-name"
          name="name"
          type="text"
          maxlength="${SHOPPING_ITEM_LIMITS.name}"
          autocomplete="off"
          enterkeyhint="done"
          placeholder="Adicionar item…"
          required
          ${isDisabled ? 'disabled' : ''}
        >
        <button class="primary-button shopping-item-form__submit" type="submit" aria-label="Adicionar item" ${isDisabled ? 'disabled' : ''} ${state.isSubmitting ? 'aria-busy="true"' : ''}>
          ${state.isSubmitting ? '…' : '+'}
        </button>
      </div>
      <details class="shopping-item-form__details">
        <summary>Quantidade e detalhes</summary>
        <div class="shopping-item-form__optional">
          <div class="form-field">
            <label for="shopping-item-quantity">Quantidade</label>
            <input id="shopping-item-quantity" name="quantity" type="text" inputmode="decimal" placeholder="Ex.: 2,5" ${isDisabled ? 'disabled' : ''}>
          </div>
          <div class="form-field">
            <label for="shopping-item-unit">Unidade</label>
            <input id="shopping-item-unit" name="unit" type="text" maxlength="${SHOPPING_ITEM_LIMITS.unit}" placeholder="Ex.: kg" ${isDisabled ? 'disabled' : ''}>
          </div>
          <div class="form-field shopping-item-form__notes">
            <label for="shopping-item-notes">Observação</label>
            <textarea id="shopping-item-notes" name="notes" maxlength="${SHOPPING_ITEM_LIMITS.notes}" rows="2" ${isDisabled ? 'disabled' : ''}></textarea>
          </div>
        </div>
      </details>
      ${error}
      ${notice}
    </form>
  `;
}

function editFormMarkup(item, state) {
  const fieldId = escapeHtml(item.id);
  const quantity = item.quantity === null ? '' : String(item.quantity).replace('.', ',');
  const error = state.formError
    ? `<p class="form-message form-message--error shopping-item-edit__message" role="alert">${escapeHtml(state.formError.message)}</p>`
    : '';

  return `
    <form class="shopping-item-edit" data-shopping-item-edit-form data-item-id="${fieldId}" novalidate>
      <div class="form-field shopping-item-edit__name">
        <label for="shopping-item-edit-name-${fieldId}">Nome</label>
        <input id="shopping-item-edit-name-${fieldId}" name="name" type="text" maxlength="${SHOPPING_ITEM_LIMITS.name}" value="${escapeHtml(item.name)}" required>
      </div>
      <div class="form-field">
        <label for="shopping-item-edit-quantity-${fieldId}">Quantidade</label>
        <input id="shopping-item-edit-quantity-${fieldId}" name="quantity" type="text" inputmode="decimal" value="${escapeHtml(quantity)}" placeholder="Ex.: 2,5">
      </div>
      <div class="form-field">
        <label for="shopping-item-edit-unit-${fieldId}">Unidade</label>
        <input id="shopping-item-edit-unit-${fieldId}" name="unit" type="text" maxlength="${SHOPPING_ITEM_LIMITS.unit}" value="${escapeHtml(item.unit ?? '')}" placeholder="Ex.: kg">
      </div>
      <div class="form-field shopping-item-edit__notes">
        <label for="shopping-item-edit-notes-${fieldId}">Observação</label>
        <textarea id="shopping-item-edit-notes-${fieldId}" name="notes" maxlength="${SHOPPING_ITEM_LIMITS.notes}" rows="2">${escapeHtml(item.notes ?? '')}</textarea>
      </div>
      ${error}
      <div class="shopping-item-edit__actions">
        <button class="secondary-button" type="button" data-shopping-item-edit-cancel>Cancelar</button>
        <button class="primary-button" type="submit" ${state.pendingItemId === item.id ? 'disabled aria-busy="true"' : ''}>
          ${state.pendingItemId === item.id ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  `;
}

function itemsMarkup(state, currentUserId) {
  const interactionsDisabled = Boolean(state.isSubmitting || state.pendingItemId);

  return `
    <ul class="shopping-items" aria-label="Itens da lista">
      ${state.items.map((item) => {
        const quantity = formatQuantity(item);
        const author = item.createdBy === currentUserId ? 'Adicionado por você' : 'Adicionado por outro membro';
        const checkAuthor = item.isChecked
          ? (item.checkedBy === currentUserId ? 'Comprado por você' : 'Comprado por outro membro')
          : '';
        const isEditing = state.editingItemId === item.id;
        const isPending = state.pendingItemId === item.id;
        return `
          <li class="shopping-item ${item.isChecked ? 'shopping-item--checked' : ''} ${isPending ? 'shopping-item--pending' : ''}">
            <input
              class="shopping-item__check"
              type="checkbox"
              aria-label="${escapeHtml(item.name)} comprado"
              data-shopping-item-toggle
              data-item-id="${escapeHtml(item.id)}"
              ${item.isChecked ? 'checked' : ''}
              ${interactionsDisabled || isEditing ? 'disabled' : ''}
            >
            <div class="shopping-item__content">
              ${isEditing ? editFormMarkup(item, state) : `
                <strong>${escapeHtml(item.name)}</strong>
                ${quantity ? `<span class="shopping-item__quantity">${quantity}</span>` : ''}
                ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}
                <small>${author}</small>
                ${checkAuthor ? `<small>${checkAuthor}</small>` : ''}
                <div class="shopping-item__actions" aria-label="Ações de ${escapeHtml(item.name)}">
                  <button class="secondary-button" type="button" data-shopping-item-edit data-item-id="${escapeHtml(item.id)}" ${interactionsDisabled ? 'disabled' : ''}>Editar</button>
                  <button class="secondary-button shopping-item__delete" type="button" data-shopping-item-delete data-item-id="${escapeHtml(item.id)}" ${interactionsDisabled ? 'disabled' : ''}>Excluir</button>
                </div>
              `}
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

export function getShoppingItemsMarkup(
  state = { status: 'idle', items: [] },
  { currentUserId } = {},
) {
  if (state.status === 'loading' || state.status === 'idle') {
    return `<div data-shopping-items-feedback>${getFeedbackMarkup({
      status: 'loading',
      title: 'Carregando os itens…',
      message: 'Preparando a lista compartilhada.',
    })}</div>`;
  }

  if (state.status === 'error') {
    return `<div data-shopping-items-feedback>${getFeedbackMarkup({
      status: 'error',
      title: 'Itens indisponíveis',
      message: state.error?.message,
      actionLabel: 'Tentar novamente',
    })}</div>`;
  }

  const content = state.items.length
    ? itemsMarkup(state, currentUserId)
    : getFeedbackMarkup({
      status: 'empty',
      title: 'Nenhum item adicionado',
      message: 'Use o campo abaixo para começar a lista.',
    });

  return `
    <div class="shopping-items-region" aria-live="polite">
      ${state.realtimeError ? '<p class="form-message shopping-items__sync-warning" role="status">Sincronização automática indisponível. Você ainda pode usar a lista e tentar novamente ao reabrir esta tela.</p>' : ''}
      ${state.operationError ? `<p class="form-message form-message--error shopping-items__error" role="alert">${escapeHtml(state.operationError.message)}</p>` : ''}
      ${content}
      ${itemFormMarkup(state)}
    </div>
  `;
}

export function bindShoppingItemsView(
  root,
  {
    onCreate,
    onRetry,
    onEdit = () => {},
    onEditCancel = () => {},
    onUpdate = () => {},
    onToggle = () => {},
    onDelete = () => {},
  },
) {
  root.querySelector('[data-shopping-items-feedback] [data-feedback-action]')
    ?.addEventListener('click', onRetry);
  const form = root.querySelector('[data-shopping-item-form]');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    onCreate({
      name: formData.get('name'),
      quantity: formData.get('quantity'),
      unit: formData.get('unit'),
      notes: formData.get('notes'),
    });
  });

  root.querySelectorAll('[data-shopping-item-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      onToggle({
        itemId: checkbox.dataset.itemId,
        isChecked: checkbox.checked,
      });
    });
  });
  root.querySelectorAll('[data-shopping-item-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(button.dataset.itemId));
  });
  root.querySelectorAll('[data-shopping-item-delete]').forEach((button) => {
    button.addEventListener('click', () => onDelete(button.dataset.itemId));
  });
  root.querySelector('[data-shopping-item-edit-cancel]')
    ?.addEventListener('click', onEditCancel);

  const editForm = root.querySelector('[data-shopping-item-edit-form]');
  editForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(editForm);
    onUpdate({
      itemId: editForm.dataset.itemId,
      name: formData.get('name'),
      quantity: formData.get('quantity'),
      unit: formData.get('unit'),
      notes: formData.get('notes'),
    });
  });
}
