import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('itens de compras mobile first', () => {
  it('mantém o formulário rápido visível acima da navegação móvel', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.shopping-item-form\s*{[\s\S]*?position:\s*sticky/);
    assert.match(css, /bottom:\s*calc\(4\.9rem \+ env\(safe-area-inset-bottom\)\)/);
  });

  it('garante alvos de 44 pixels para checkbox e detalhes', async () => {
    const css = await readFile('css/pages.css', 'utf8');
    const componentsCss = await readFile('css/components.css', 'utf8');

    assert.match(css, /\.shopping-item__check\s*{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
    assert.match(css, /\.shopping-item-form__details summary[\s\S]*?min-height:\s*44px/);
    assert.match(css, /\.shopping-items__sync-warning\s*{[\s\S]*?padding:/);
    assert.match(css, /\.shopping-item__actions,[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(componentsCss, /\.secondary-button\s*{[\s\S]*?min-height:\s*44px/);
  });

  it('integra serviço e controlador de itens sem armazenamento local', async () => {
    const app = await readFile('js/app.js', 'utf8');

    assert.match(app, /createShoppingItemService\(client\)/);
    assert.match(app, /createShoppingItemsRealtime\(client\)/);
    assert.match(app, /createShoppingItemsController/);
    assert.match(app, /realtimeService:\s*shoppingItemsRealtime/);
    assert.match(app, /onShoppingItemCreate/);
    assert.match(app, /onShoppingItemUpdate/);
    assert.match(app, /onShoppingItemToggle/);
    assert.match(app, /requestShoppingItemDeletion/);
    assert.match(app, /openConfirmationDialog[\s\S]*?Excluir este item\?/);
    assert.match(app, /route\?\.id !== 'shopping-list'[\s\S]*?shoppingItemsController\.clear\(\)/);
    assert.match(app, /pagehide[\s\S]*?shoppingItemsController\.clear\(\)/);
    assert.doesNotMatch(app, /localStorage|sessionStorage/);
  });
});
