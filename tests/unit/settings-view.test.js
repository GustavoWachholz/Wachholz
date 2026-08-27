import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindSettingsView, getSettingsMarkup } from '../../js/modules/settings/settings-view.js';

const PERIOD = Object.freeze({ year: 2026, month: 8 });

function financeState(overrides = {}) {
  return {
    status: 'ready',
    period: PERIOD,
    transactions: [{ id: '1' }, { id: '2' }],
    error: null,
    ...overrides,
  };
}

describe('getSettingsMarkup', () => {
  it('exibe household, conta, mês e exportação pronta', () => {
    const markup = getSettingsMarkup({
      household: { name: 'Casa Wachholz' },
      user: { email: 'pessoa@example.com' },
      financeState: financeState(),
    });

    assert.match(markup, /Casa Wachholz/);
    assert.match(markup, /pessoa@example\.com/);
    assert.match(markup, /datetime="2026-08">Agosto de 2026/);
    assert.match(markup, /2 lançamentos serão exportados/);
    assert.match(markup, /data-settings-export(?![^>]*disabled)/);
    assert.match(markup, /data-app-logout/);
  });

  it('trata vazio, loading, erro e conteúdo escapado', () => {
    const empty = getSettingsMarkup({ financeState: financeState({ transactions: [] }) });
    const loading = getSettingsMarkup({ financeState: financeState({ status: 'loading' }) });
    const error = getSettingsMarkup({
      household: { name: '<script>ruim</script>' },
      user: { email: '<b>conta</b>' },
      financeState: financeState({ status: 'error', error: new Error('<i>Falha</i>') }),
    });

    assert.match(empty, /Nenhum lançamento neste mês/);
    assert.match(empty, /data-settings-export disabled/);
    assert.match(loading, /role="status"/);
    assert.match(error, /data-feedback-action/);
    assert.doesNotMatch(error, /<script>|<b>conta|<i>Falha/);
  });
});

describe('bindSettingsView', () => {
  it('conecta navegação mensal, exportação e nova tentativa', () => {
    function element() {
      return {
        addEventListener(type, listener) { this.listeners ??= {}; this.listeners[type] = listener; },
      };
    }
    const previous = element();
    const next = element();
    const exportButton = element();
    const retry = element();
    const root = {
      querySelector(selector) {
        return new Map([
          ['[data-settings-previous-month]', previous],
          ['[data-settings-next-month]', next],
          ['[data-settings-export]', exportButton],
          ['[data-settings-export-feedback] [data-feedback-action]', retry],
        ]).get(selector) ?? null;
      },
    };
    const calls = [];

    bindSettingsView(root, {
      onPreviousMonth: () => calls.push('previous'),
      onNextMonth: () => calls.push('next'),
      onExport: () => calls.push('export'),
      onRetry: () => calls.push('retry'),
    });
    previous.listeners.click();
    next.listeners.click();
    exportButton.listeners.click();
    retry.listeners.click();

    assert.deepEqual(calls, ['previous', 'next', 'export', 'retry']);
  });
});
