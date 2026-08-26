import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getHouseholdMarkup } from '../../js/household/household-view.js';

describe('getHouseholdMarkup', () => {
  it('exibe a household ativa', () => {
    const markup = getHouseholdMarkup({
      status: 'ready',
      household: { id: '1', name: 'Nossa Casa' },
    });

    assert.match(markup, /Casa ativa/);
    assert.match(markup, /Nossa Casa/);
  });

  it('escapa o nome recebido do banco', () => {
    const markup = getHouseholdMarkup({
      status: 'ready',
      household: { id: '1', name: '<script>alert(1)</script>' },
    });

    assert.doesNotMatch(markup, /<script>/);
    assert.match(markup, /&lt;script&gt;/);
  });

  it('fornece status durante carregamento', () => {
    const markup = getHouseholdMarkup({ status: 'loading' });

    assert.match(markup, /role="status"/);
    assert.match(markup, /Carregando os dados da casa/);
  });

  it('fornece alerta e nova tentativa em caso de erro', () => {
    const markup = getHouseholdMarkup({
      status: 'error',
      error: new Error('Casa indisponível.'),
    });

    assert.match(markup, /role="alert"/);
    assert.match(markup, /data-household-retry/);
    assert.match(markup, /Casa indisponível\./);
  });

  it('não renderiza conteúdo enquanto estiver ocioso', () => {
    assert.equal(getHouseholdMarkup({ status: 'idle' }), '');
  });
});
