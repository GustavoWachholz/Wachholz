import { resolveRoute } from './app-routes.js';

export function createHashRouter({ windowTarget, onRouteChange = () => {} }) {
  if (
    !windowTarget?.location
    || typeof windowTarget.addEventListener !== 'function'
    || typeof windowTarget.removeEventListener !== 'function'
  ) {
    throw new TypeError('Uma janela compatível é obrigatória para o roteador.');
  }

  let started = false;

  const emit = () => onRouteChange(resolveRoute(windowTarget.location.hash));

  function start() {
    if (!started) {
      windowTarget.addEventListener('hashchange', emit);
      started = true;
    }

    emit();
  }

  function stop() {
    if (!started) {
      return;
    }

    windowTarget.removeEventListener('hashchange', emit);
    started = false;
  }

  return Object.freeze({ start, stop });
}
