import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('fundação estática', () => {
  it('declara viewport mobile e carrega apenas assets estáticos locais', async () => {
    const html = await readFile('index.html', 'utf8');

    assert.match(
      html,
      /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/,
    );
    assert.match(html, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
    assert.match(html, /href="\.\/css\/base\.css"/);
    assert.doesNotMatch(html, /https?:\/\//);
  });

  it('protege a largura mínima suportada contra rolagem horizontal', async () => {
    const css = await readFile('css/base.css', 'utf8');

    assert.match(css, /min-width:\s*320px/);
    assert.match(css, /overflow-x:\s*hidden/);
  });

  it('não declara dependências nem etapa de build', async () => {
    const packageFile = JSON.parse(await readFile('package.json', 'utf8'));

    assert.equal(packageFile.type, 'module');
    assert.equal(packageFile.dependencies, undefined);
    assert.equal(packageFile.devDependencies, undefined);
    assert.equal(packageFile.scripts, undefined);
  });
});
