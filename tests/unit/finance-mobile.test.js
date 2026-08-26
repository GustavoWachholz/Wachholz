import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('fundação financeira mobile first', () => {
  it('mantém o seletor mensal compacto e com alvos de 48 pixels', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.finance-period\s*{[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 48px/);
    assert.match(css, /\.finance-period__button\s*{[\s\S]*?min-height:\s*48px/);
  });

  it('empilha categorias no celular e aprimora apenas em tela maior', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.finance-categories-panel__header\s*{[\s\S]*?display:\s*grid/);
    assert.match(css, /\.finance-type-selector button\s*{[\s\S]*?min-height:\s*44px/);
    assert.match(css, /@media \(min-width:\s*40rem\)[\s\S]*?\.finance-categories-panel__header[\s\S]*?grid-template-columns:/);
  });

  it('integra serviço, estado e eventos financeiros sem armazenamento local', async () => {
    const app = await readFile('js/app.js', 'utf8');
    const shell = await readFile('js/shell/app-shell-view.js', 'utf8');

    assert.match(app, /createFinancialCategoryService\(client\)/);
    assert.match(app, /createFinanceController/);
    assert.match(app, /route\?\.id === 'finance'[\s\S]*?financeController\.load/);
    assert.match(shell, /bindFinanceView/);
    assert.doesNotMatch(app, /localStorage|sessionStorage/);
  });
});
