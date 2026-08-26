const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_MESSAGES = Object.freeze({
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  invalid_credentials: 'E-mail ou senha inválidos.',
  invalid_email: 'Informe um e-mail válido.',
  invalid_grant: 'E-mail ou senha inválidos.',
  invalid_login_credentials: 'E-mail ou senha inválidos.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  password_required: 'Informe sua senha.',
  user_not_found: 'E-mail ou senha inválidos.',
});

export class AuthFlowError extends Error {
  constructor({ code = 'AUTH_ERROR', cause } = {}) {
    super(AUTH_MESSAGES[code] ?? 'Não foi possível entrar. Tente novamente.', cause ? { cause } : undefined);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

export function validateLoginCredentials(credentials) {
  const email = credentials?.email?.trim() ?? '';
  const password = credentials?.password ?? '';

  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthFlowError({ code: 'invalid_email' });
  }

  if (typeof password !== 'string' || password.length === 0) {
    throw new AuthFlowError({ code: 'password_required' });
  }

  return { email, password };
}

export function normalizeAuthError(error) {
  if (error instanceof AuthFlowError) {
    return error;
  }

  return new AuthFlowError({
    code: error?.code,
    cause: error,
  });
}

function ensureAuthClient(client) {
  const auth = client?.auth;
  const requiredMethods = ['getSession', 'onAuthStateChange', 'signInWithPassword', 'signOut'];

  if (!auth || requiredMethods.some((method) => typeof auth[method] !== 'function')) {
    throw new TypeError('O cliente Supabase Auth está incompleto.');
  }

  return auth;
}

export function createAuthService(client) {
  const auth = ensureAuthClient(client);

  return Object.freeze({
    async getSession() {
      const { data, error } = await auth.getSession();

      if (error) {
        throw normalizeAuthError(error);
      }

      return data?.session ?? null;
    },

    onAuthStateChange(handler) {
      const result = auth.onAuthStateChange((event, session) => {
        handler({ event, session: session ?? null });
      });
      const subscription = result?.data?.subscription;

      if (!subscription || typeof subscription.unsubscribe !== 'function') {
        throw new TypeError('A subscription de autenticação não foi criada.');
      }

      return () => subscription.unsubscribe();
    },

    async signIn(credentials) {
      const safeCredentials = validateLoginCredentials(credentials);
      const { data, error } = await auth.signInWithPassword(safeCredentials);

      if (error) {
        throw normalizeAuthError(error);
      }

      return data?.session ?? null;
    },

    async signOut() {
      const { error } = await auth.signOut({ scope: 'local' });

      if (error) {
        throw normalizeAuthError(error);
      }
    },
  });
}
