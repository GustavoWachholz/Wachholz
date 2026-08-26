import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getFeedbackMarkup, renderFeedback } from '../../js/ui/feedback.js';

describe('getFeedbackMarkup', () => {
  it('renderiza loading com status e spinner', () => {
    const markup = getFeedbackMarkup({ status: 'loading' });

    assert.match(markup, /role="status"/);
    assert.match(markup, /feedback-state__spinner/);
    assert.match(markup, /Carregando/);
  });

  it('renderiza erro como alerta com ação', () => {
    const markup = getFeedbackMarkup({
      status: 'error',
      message: 'Falha temporária',
      actionLabel: 'Tentar novamente',
    });

    assert.match(markup, /role="alert"/);
    assert.match(markup, /data-feedback-action/);
    assert.match(markup, /Tentar novamente/);
  });

  it('oferece estados vazio e sucesso com padrões legíveis', () => {
    assert.match(getFeedbackMarkup({ status: 'empty' }), /Nada por aqui ainda/);
    assert.match(getFeedbackMarkup({ status: 'success' }), /Tudo certo/);
  });

  it('escapa título, mensagem e rótulo da ação', () => {
    const markup = getFeedbackMarkup({
      status: 'error',
      title: '<b>Erro</b>',
      message: '<script>ruim</script>',
      actionLabel: '<img>',
    });

    assert.doesNotMatch(markup, /<b>|<script>|<img>/);
    assert.match(markup, /&lt;b&gt;Erro&lt;\/b&gt;/);
  });
});

describe('renderFeedback', () => {
  it('conecta a ação ao botão renderizado', () => {
    let listener;
    let calls = 0;
    const root = {
      innerHTML: '',
      querySelector: () => ({
        addEventListener(type, callback) {
          assert.equal(type, 'click');
          listener = callback;
        },
      }),
    };

    renderFeedback(
      root,
      { status: 'error', actionLabel: 'Repetir' },
      { onAction: () => { calls += 1; } },
    );
    listener();

    assert.equal(calls, 1);
    assert.match(root.innerHTML, /Repetir/);
  });

  it('exige um elemento raiz', () => {
    assert.throws(() => renderFeedback(null, { status: 'empty' }), /obrigatório/i);
  });
});
