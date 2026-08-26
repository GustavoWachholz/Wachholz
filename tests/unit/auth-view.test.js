import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAuthMarkup } from '../../js/auth/auth-view.js';

describe('getAuthMarkup', () => {
  it('gera formulário mobile acessível para sessão ausente', () => {
    const markup = getAuthMarkup({ status: 'unauthenticated', error: null });

    assert.match(markup, /<label for="login-email">E-mail<\/label>/);
    assert.match(markup, /type="email"/);
    assert.match(markup, /autocomplete="email"/);
    assert.match(markup, /<label for="login-password">Senha<\/label>/);
    assert.match(markup, /autocomplete="current-password"/);
    assert.match(markup, /type="submit"/);
  });

  it('desabilita campos e botão durante autenticação', () => {
    const markup = getAuthMarkup({ status: 'authenticating' });

    assert.match(markup, /Entrando…/);
    assert.match(markup, /aria-busy="true"/);
    assert.equal((markup.match(/disabled/g) ?? []).length, 3);
  });

  it('mostra erro de login em região de alerta', () => {
    const markup = getAuthMarkup({
      status: 'unauthenticated',
      error: new Error('E-mail ou senha inválidos.'),
    });

    assert.match(markup, /role="alert"/);
    assert.match(markup, /E-mail ou senha inválidos\./);
  });

  it('escapa o e-mail exibido da sessão', () => {
    const markup = getAuthMarkup({
      status: 'authenticated',
      user: { email: '<img src=x onerror=alert(1)>' },
    });

    assert.doesNotMatch(markup, /<img/);
    assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(markup, /data-logout/);
  });

  it('gera estado de erro com ação de tentar novamente', () => {
    const markup = getAuthMarkup({
      status: 'error',
      error: new Error('Falha temporária.'),
    });

    assert.match(markup, /Falha temporária\./);
    assert.match(markup, /data-auth-retry/);
  });
});
