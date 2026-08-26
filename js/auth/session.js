function createState(status, { session = null, error = null } = {}) {
  return Object.freeze({
    status,
    session,
    user: session?.user ?? null,
    error,
  });
}

export function createSessionController({ authService, onStateChange = () => {} }) {
  if (!authService) {
    throw new TypeError('O serviço de autenticação é obrigatório.');
  }

  let state = createState('loading');
  let unsubscribe = null;
  let stopped = false;
  let authEventVersion = 0;

  function emit(nextState) {
    if (stopped) {
      return;
    }

    state = nextState;
    onStateChange(state);
  }

  function applySession(session) {
    emit(createState(session ? 'authenticated' : 'unauthenticated', { session }));
  }

  async function start() {
    stopped = false;
    unsubscribe?.();
    emit(createState('loading'));

    try {
      unsubscribe = authService.onAuthStateChange(({ session }) => {
        authEventVersion += 1;
        applySession(session);
      });

      const requestVersion = authEventVersion;
      const session = await authService.getSession();

      if (requestVersion === authEventVersion) {
        applySession(session);
      }
    } catch (error) {
      emit(createState('error', { error }));
    }

    return state;
  }

  async function login(credentials) {
    emit(createState('authenticating'));

    try {
      const session = await authService.signIn(credentials);
      applySession(session);
    } catch (error) {
      emit(createState('unauthenticated', { error }));
    }

    return state;
  }

  async function logout() {
    const previousSession = state.session;
    emit(createState('loading'));

    try {
      await authService.signOut();
      applySession(null);
    } catch (error) {
      emit(createState('authenticated', { session: previousSession, error }));
    }

    return state;
  }

  function stop() {
    stopped = true;
    unsubscribe?.();
    unsubscribe = null;
  }

  return Object.freeze({
    getState: () => state,
    login,
    logout,
    start,
    stop,
  });
}
