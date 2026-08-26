import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getShoppingListDetailMarkup,
  getShoppingListsMarkup,
} from '../../js/modules/shopping/shopping-lists-view.js';

const LIST_ID = '33333333-3333-4333-8333-333333333333';
const LIST = Object.freeze({ id: LIST_ID, name: 'Mercado', pendingItems: 2 });

describe('getShoppingListsMarkup', () => {
  it('renderiza loading e erro acessíveis', () => {
    const loading = getShoppingListsMarkup({ status: 'loading', lists: [] });
    const error = getShoppingListsMarkup({
      status: 'error',
      lists: [],
      error: new Error('Falha temporária'),
    });

    assert.match(loading, /role="status"/);
    assert.match(error, /role="alert"/);
    assert.match(error, /data-feedback-action/);
  });

  it('exibe formulário e estado vazio com a cópia especificada', () => {
    const markup = getShoppingListsMarkup({ status: 'ready', lists: [] });

    assert.match(markup, /data-shopping-list-form/);
    assert.match(markup, /maxlength="80"/);
    assert.match(markup, /Nenhuma lista criada/);
    assert.match(markup, /Crie sua primeira lista de compras/);
  });

  it('renderiza contagem e link de abertura por toque', () => {
    const markup = getShoppingListsMarkup({
      status: 'ready',
      lists: [LIST],
      notice: 'Lista criada com sucesso.',
    });

    assert.match(markup, new RegExp(`href="#/compras/${LIST_ID}"`));
    assert.match(markup, /2 itens pendentes/);
    assert.match(markup, /role="status">Lista criada com sucesso/);
  });

  it('usa singular e escapa nomes e erros do formulário', () => {
    const markup = getShoppingListsMarkup({
      status: 'ready',
      lists: [{ ...LIST, name: '<script>ruim</script>', pendingItems: 1 }],
      formError: new Error('<b>erro</b>'),
    });

    assert.match(markup, /1 item pendente/);
    assert.match(markup, /&lt;script&gt;ruim&lt;\/script&gt;/);
    assert.match(markup, /&lt;b&gt;erro&lt;\/b&gt;/);
    assert.doesNotMatch(markup, /<script>|<b>erro<\/b>/);
  });
});

describe('getShoppingListDetailMarkup', () => {
  it('abre a lista selecionada com nome, contador e retorno', () => {
    const markup = getShoppingListDetailMarkup(
      { status: 'ready', lists: [LIST] },
      LIST_ID,
    );

    assert.match(markup, /<h1 id="route-heading">Mercado<\/h1>/);
    assert.match(markup, /2 itens pendentes/);
    assert.match(markup, /href="#\/compras"/);
    assert.match(markup, /Carregando os itens/i);
  });

  it('trata identificador ausente sem revelar outra lista', () => {
    const markup = getShoppingListDetailMarkup(
      { status: 'ready', lists: [LIST] },
      '44444444-4444-4444-8444-444444444444',
    );

    assert.match(markup, /Lista não encontrada/);
    assert.doesNotMatch(markup, /Mercado/);
  });

  it('não exibe itens mantidos no estado de outra lista', () => {
    const markup = getShoppingListDetailMarkup(
      { status: 'ready', lists: [LIST] },
      LIST_ID,
      {
        itemsState: {
          status: 'ready',
          listId: '44444444-4444-4444-8444-444444444444',
          items: [{ name: 'Item de outra lista' }],
        },
      },
    );

    assert.match(markup, /Carregando os itens/);
    assert.doesNotMatch(markup, /Item de outra lista/);
  });
});
