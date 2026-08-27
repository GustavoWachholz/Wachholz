import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('financeiro mobile first', () => {
  it('mantém o seletor mensal compacto e com alvos de 48 pixels', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.finance-period\s*{[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 48px/);
    assert.match(css, /\.finance-period__button\s*{[\s\S]*?min-height:\s*48px/);
  });

  it('empilha formulário e cards no celular e aprimora apenas em tela maior', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.finance-type-selector button\s*{[\s\S]*?min-height:\s*44px/);
    assert.match(css, /\.financial-entry-form\s*{[\s\S]*?display:\s*grid[\s\S]*?gap:/);
    assert.match(css, /\.financial-entry-form input,[\s\S]*?min-height:\s*48px/);
    assert.match(css, /\.financial-transaction\s*{[\s\S]*?display:\s*grid[\s\S]*?min-width:\s*0/);
    assert.match(css, /@media \(min-width:\s*40rem\)[\s\S]*?\.financial-entry-form\s*{[\s\S]*?grid-template-columns:/);
    assert.match(css, /@media \(min-width:\s*40rem\)[\s\S]*?\.financial-transaction\s*{[\s\S]*?grid-template-columns:/);
    assert.match(css, /\.financial-transaction__actions button,[\s\S]*?min-height:\s*44px/);
    assert.match(css, /\.financial-transaction-edit\s*{[\s\S]*?grid-column:\s*1 \/ -1/);
    assert.match(css, /\.financial-filters\s*{[\s\S]*?display:\s*grid/);
    assert.doesNotMatch(css, /\.financial-transactions\s+table|\.financial-transaction\s*{[^}]*width:\s*\d{3,}px/);
  });

  it('integra categorias, lançamentos e eventos sem armazenamento local', async () => {
    const app = await readFile('js/app.js', 'utf8');
    const shell = await readFile('js/shell/app-shell-view.js', 'utf8');

    assert.match(app, /createFinancialCategoryService\(client\)/);
    assert.match(app, /createFinancialTransactionService\(client\)/);
    assert.match(app, /createFinanceController/);
    assert.match(app, /transactionService:\s*financialTransactionService/);
    assert.match(app, /route\?\.id === 'finance'[\s\S]*?financeController\.load/);
    assert.match(app, /requestFinancialTransactionDeletion[\s\S]*?financeController\.remove/);
    assert.match(app, /onFinanceUpdate:\s*\(input\) => financeController\.update/);
    assert.match(shell, /bindFinanceView/);
    assert.match(shell, /onCreate:\s*onFinanceCreate/);
    assert.doesNotMatch(app, /localStorage|sessionStorage/);
  });
});
