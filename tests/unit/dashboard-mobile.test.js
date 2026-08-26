import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('dashboard mobile first', () => {
  it('empilha os cards por padrão e amplia somente em telas maiores', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(
      css,
      /\.dashboard-grid\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    assert.match(
      css,
      /@media \(min-width:\s*48rem\)[\s\S]*?\.dashboard-grid[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it('mantém os atalhos dos cards confortáveis para toque', async () => {
    const css = await readFile('css/pages.css', 'utf8');

    assert.match(css, /\.card-link\s*{[\s\S]*?min-width:\s*44px/);
    assert.match(css, /\.card-link\s*{[\s\S]*?min-height:\s*44px/);
  });

  it('fornece foco programático ao conteúdo trocado pela rota', async () => {
    const shell = await readFile('js/shell/app-shell-view.js', 'utf8');
    const app = await readFile('js/app.js', 'utf8');

    assert.match(shell, /id="route-content" tabindex="-1"/);
    assert.match(app, /renderAuthenticatedSurface\(\{ focusContent: true \}\)/);
    assert.match(app, /querySelector\('\#route-content'\)\?\.focus\(\)/);
  });
});
