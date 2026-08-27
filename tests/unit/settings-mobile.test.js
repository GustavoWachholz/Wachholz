import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('configurações mobile first', () => {
  it('empilha os cards e mantém período e exportação confortáveis para toque', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.settings\s*{[\s\S]*?display:\s*grid/);
    assert.match(css, /\.settings-period\s*{[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 48px/);
    assert.match(css, /\.settings-period button\s*{[\s\S]*?min-height:\s*48px/);
    assert.match(css, /\.settings-export__button\s*{[\s\S]*?min-height:\s*48px/);
    assert.match(css, /@media \(min-width:\s*48rem\)[\s\S]*?\.settings\s*{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  });

  it('integra período financeiro, CSV e eventos ao shell sem armazenamento local', async () => {
    const app = await readFile('js/app.js', 'utf8');
    const shell = await readFile('js/shell/app-shell-view.js', 'utf8');

    assert.match(app, /route\?\.id === 'finance' \|\| route\?\.id === 'settings'/);
    assert.match(app, /onSettingsExport:[\s\S]*?downloadFinancialCsv/);
    assert.match(app, /transactions:\s*financeState\.transactions/);
    assert.match(shell, /getSettingsMarkup/);
    assert.match(shell, /bindSettingsView/);
    assert.doesNotMatch(app, /localStorage|sessionStorage/);
  });
});
