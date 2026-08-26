import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('shell mobile first', () => {
  it('declara superfícies pública e autenticada no HTML estático', async () => {
    const html = await readFile('index.html', 'utf8');

    assert.match(html, /data-public-root/);
    assert.match(html, /data-app-root[^>]*hidden/);
    assert.match(html, /data-public-footer/);
  });

  it('garante alvos de toque e navegação fixa na base do celular', async () => {
    const css = await readFile('css/components.css', 'utf8');

    assert.match(css, /\.app-nav__link[\s\S]*?min-width:\s*44px/);
    assert.match(css, /\.app-nav__link[\s\S]*?min-height:\s*48px/);
    assert.match(css, /\.app-nav--bottom[\s\S]*?position:\s*fixed/);
    assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  });

  it('troca a navegação inferior pela sidebar somente em telas maiores', async () => {
    const componentCss = await readFile('css/components.css', 'utf8');
    const layoutCss = await readFile('css/layout.css', 'utf8');

    assert.match(componentCss, /@media \(min-width:\s*48rem\)[\s\S]*?\.app-nav--bottom[\s\S]*?display:\s*none/);
    assert.match(layoutCss, /\.desktop-sidebar\s*{\s*display:\s*none/);
    assert.match(layoutCss, /@media \(min-width:\s*48rem\)[\s\S]*?\.desktop-sidebar[\s\S]*?display:\s*flex/);
  });
});
