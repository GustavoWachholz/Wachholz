function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getHouseholdMarkup(state) {
  switch (state.status) {
    case 'ready':
      return `
        <p class="eyebrow">Casa ativa</p>
        <h2>${escapeHtml(state.household.name)}</h2>
        <p>Os próximos módulos usarão este espaço compartilhado.</p>
      `;
    case 'error':
      return `
        <p class="eyebrow">Casa indisponível</p>
        <h2>Não foi possível continuar</h2>
        <p class="form-message form-message--error" role="alert">
          ${escapeHtml(state.error?.message ?? 'Tente novamente em instantes.')}
        </p>
        <button class="secondary-button" type="button" data-household-retry>
          Tentar novamente
        </button>
      `;
    case 'loading':
      return `
        <div class="auth-card__loading" role="status">
          <span class="auth-card__spinner" aria-hidden="true"></span>
          <p>Carregando os dados da casa…</p>
        </div>
      `;
    case 'idle':
    default:
      return '';
  }
}

export function renderHouseholdView(root, state, { onRetry }) {
  root.hidden = state.status === 'idle';
  root.dataset.state = state.status;
  root.innerHTML = getHouseholdMarkup(state);
  root.querySelector('[data-household-retry]')?.addEventListener('click', onRetry);
}
