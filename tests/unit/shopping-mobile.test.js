import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('listas de compras mobile first', () => {
  it('empilha a criação no celular e só usa colunas em tela maior', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.shopping-list-form__controls\s*{[\s\S]*?display:\s*grid[\s\S]*?gap:/);
    assert.match(
      css,
      /@media \(min-width:\s*40rem\)[\s\S]*?\.shopping-list-form__controls[\s\S]*?grid-template-columns:/,
    );
  });

  it('mantém campo, cards e retorno com alvos amplos de toque', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.shopping-list-form input[\s\S]*?min-height:\s*48px/);
    assert.match(css, /\.shopping-list-card[\s\S]*?min-height:\s*64px/);
    assert.match(css, /\.shopping-back-link[\s\S]*?min-height:\s*44px/);
  });

  it('integra serviço e controlador ao ciclo autenticado', async () => {
    const app = await readFile('js/app.js', 'utf8');

    assert.match(app, /createShoppingListService\(client\)/);
    assert.match(app, /createShoppingListsController/);
    assert.match(app, /onShoppingCreate/);
    assert.match(app, /shoppingController\.clear\(\)/);
  });
});
