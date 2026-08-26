import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getShoppingItemsMarkup } from '../../js/modules/shopping/shopping-items-view.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';

function item(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Leite',
    quantity: 2.5,
    unit: 'L',
    notes: 'Integral',
    isChecked: false,
    createdBy: USER_ID,
    ...overrides,
  };
}

describe('getShoppingItemsMarkup', () => {
  it('renderiza loading e erro com nova tentativa', () => {
    const loading = getShoppingItemsMarkup({ status: 'loading', items: [] });
    const error = getShoppingItemsMarkup({
      status: 'error',
      items: [],
      error: new Error('Falha temporária'),
    });

    assert.match(loading, /Carregando os itens/);
    assert.match(error, /role="alert"/);
    assert.match(error, /data-shopping-items-feedback/);
    assert.match(error, /data-feedback-action/);
  });

  it('oferece campo rápido que envia por Enter e detalhes opcionais', () => {
    const markup = getShoppingItemsMarkup({ status: 'ready', items: [] });

    assert.match(markup, /data-shopping-item-form/);
    assert.match(markup, /enterkeyhint="done"/);
    assert.match(markup, /type="submit"/);
    assert.match(markup, /inputmode="decimal"/);
    assert.match(markup, /<details class="shopping-item-form__details">/);
    assert.match(markup, /Nenhum item adicionado/);
  });

  it('exibe quantidade, unidade, observação e autor atual', () => {
    const markup = getShoppingItemsMarkup(
      { status: 'ready', items: [item()] },
      { currentUserId: USER_ID },
    );

    assert.match(markup, /2,5 L/);
    assert.match(markup, /Integral/);
    assert.match(markup, /Adicionado por você/);
    assert.match(markup, /type="checkbox"/);
    assert.match(markup, /data-shopping-item-toggle/);
    assert.match(markup, /data-shopping-item-edit/);
    assert.match(markup, /data-shopping-item-delete/);
  });

  it('diferencia concluído e outro membro sem expor o UUID', () => {
    const otherUserId = '55555555-5555-4555-8555-555555555555';
    const markup = getShoppingItemsMarkup(
      {
        status: 'ready',
        items: [item({ isChecked: true, createdBy: otherUserId, checkedBy: otherUserId })],
      },
      { currentUserId: USER_ID },
    );

    assert.match(markup, /shopping-item--checked/);
    assert.match(markup, /checked/);
    assert.doesNotMatch(markup, /data-shopping-item-toggle[\s\S]*?disabled/);
    assert.match(markup, /Adicionado por outro membro/);
    assert.match(markup, /Comprado por outro membro/);
    assert.doesNotMatch(markup, new RegExp(otherUserId));
  });

  it('abre edição preenchida com ações grandes de salvar e cancelar', () => {
    const currentItem = item();
    const markup = getShoppingItemsMarkup({
      status: 'ready',
      items: [currentItem],
      editingItemId: currentItem.id,
    });

    assert.match(markup, /data-shopping-item-edit-form/);
    assert.match(markup, /value="Leite"/);
    assert.match(markup, /value="2,5"/);
    assert.match(markup, /data-shopping-item-edit-cancel/);
    assert.match(markup, />\s*Salvar\s*</);
    assert.doesNotMatch(markup, /data-shopping-item-delete/);
  });

  it('desabilita ações durante mutação e anuncia falha contextual', () => {
    const currentItem = item();
    const markup = getShoppingItemsMarkup({
      status: 'ready',
      items: [currentItem],
      pendingItemId: currentItem.id,
      operationError: new Error('Não foi possível excluir'),
    });

    assert.match(markup, /shopping-item--pending/);
    assert.match(markup, /role="alert">Não foi possível excluir/);
    assert.match(markup, /data-shopping-item-edit[^>]*disabled/);
    assert.match(markup, /data-shopping-item-delete[^>]*disabled/);
  });

  it('escapa todos os campos textuais recebidos do banco', () => {
    const markup = getShoppingItemsMarkup({
      status: 'ready',
      items: [item({
        name: '<script>nome</script>',
        unit: '<b>kg</b>',
        notes: '<img src=x>',
      })],
    });

    assert.doesNotMatch(markup, /<script>|<b>|<img/);
    assert.match(markup, /&lt;script&gt;nome&lt;\/script&gt;/);
    assert.match(markup, /&lt;b&gt;kg&lt;\/b&gt;/);
  });
});
