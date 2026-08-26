function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadingMarkup(message = 'Verificando sua sessão…') {
  return `
    <div class="auth-card__loading" role="status">
      <span class="auth-card__spinner" aria-hidden="true"></span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function loginMarkup({ error, pending = false } = {}) {
  const errorMarkup = error
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(error.message)}</p>`
    : '';

  return `
    <div class="auth-card__header">
      <p class="eyebrow">Acesso da casa</p>
      <h2>Entrar</h2>
      <p>Use o e-mail e a senha cadastrados para sua household.</p>
    </div>
    <form class="auth-form" data-login-form novalidate>
      <div class="form-field">
        <label for="login-email">E-mail</label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          required
          ${pending ? 'disabled' : ''}
        >
      </div>
      <div class="form-field">
        <label for="login-password">Senha</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          ${pending ? 'disabled' : ''}
        >
      </div>
      ${errorMarkup}
      <button class="primary-button" type="submit" ${pending ? 'disabled aria-busy="true"' : ''}>
        ${pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  `;
}

function authenticatedMarkup(state) {
  const email = escapeHtml(state.user?.email ?? 'Usuário autenticado');
  const errorMarkup = state.error
    ? `<p class="form-message form-message--error" role="alert">${escapeHtml(state.error.message)}</p>`
    : '';

  return `
    <div class="auth-card__header">
      <p class="eyebrow">Sessão ativa</p>
      <h2>Você entrou</h2>
      <p class="account-email">${email}</p>
    </div>
    ${errorMarkup}
    <button class="secondary-button" type="button" data-logout>Sair deste dispositivo</button>
  `;
}

function errorMarkup(error) {
  return `
    <div class="auth-card__header">
      <p class="eyebrow">Acesso indisponível</p>
      <h2>Não foi possível verificar sua sessão</h2>
      <p class="form-message form-message--error" role="alert">
        ${escapeHtml(error?.message ?? 'Tente novamente em instantes.')}
      </p>
    </div>
    <button class="secondary-button" type="button" data-auth-retry>Tentar novamente</button>
  `;
}

export function getAuthMarkup(state) {
  switch (state.status) {
    case 'authenticated':
      return authenticatedMarkup(state);
    case 'authenticating':
      return loginMarkup({ pending: true });
    case 'unauthenticated':
      return loginMarkup({ error: state.error });
    case 'error':
      return errorMarkup(state.error);
    case 'loading':
    default:
      return loadingMarkup();
  }
}

export function renderAuthView(root, state, handlers) {
  root.className = 'auth-card';
  root.dataset.state = state.status;
  root.innerHTML = getAuthMarkup(state);

  const form = root.querySelector('[data-login-form]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    handlers.onLogin({
      email: formData.get('email'),
      password: formData.get('password'),
    });
  });

  root.querySelector('[data-logout]')?.addEventListener('click', handlers.onLogout);
  root.querySelector('[data-auth-retry]')?.addEventListener('click', handlers.onRetry);
}
