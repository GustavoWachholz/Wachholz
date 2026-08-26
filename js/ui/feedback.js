function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const DEFAULT_CONTENT = Object.freeze({
  loading: Object.freeze({
    title: 'Carregando…',
    message: 'Aguarde um instante.',
  }),
  error: Object.freeze({
    title: 'Não foi possível continuar',
    message: 'Tente novamente em instantes.',
  }),
  empty: Object.freeze({
    title: 'Nada por aqui ainda',
    message: 'Os dados aparecerão assim que forem adicionados.',
  }),
  success: Object.freeze({
    title: 'Tudo certo',
    message: 'A ação foi concluída.',
  }),
});

export function getFeedbackMarkup({
  status,
  title,
  message,
  actionLabel,
} = {}) {
  const normalizedStatus = Object.hasOwn(DEFAULT_CONTENT, status) ? status : 'empty';
  const content = DEFAULT_CONTENT[normalizedStatus];
  const role = normalizedStatus === 'error' ? 'alert' : 'status';
  const spinner = normalizedStatus === 'loading'
    ? '<span class="feedback-state__spinner" aria-hidden="true"></span>'
    : '';
  const action = actionLabel
    ? `<button class="${normalizedStatus === 'error' ? 'primary-button' : 'secondary-button'}" type="button" data-feedback-action>${escapeHtml(actionLabel)}</button>`
    : '';

  return `
    <div class="feedback-state feedback-state--${normalizedStatus}" role="${role}" aria-live="polite">
      ${spinner}
      <div>
        <h2>${escapeHtml(title ?? content.title)}</h2>
        <p>${escapeHtml(message ?? content.message)}</p>
        ${action}
      </div>
    </div>
  `;
}

export function renderFeedback(root, state, { onAction = () => {} } = {}) {
  if (!root) {
    throw new TypeError('O elemento de feedback é obrigatório.');
  }

  root.innerHTML = getFeedbackMarkup(state);
  root.querySelector('[data-feedback-action]')?.addEventListener('click', onAction);
}
