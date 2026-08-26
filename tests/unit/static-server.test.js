import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { getContentType, resolveStaticPath } from '../../scripts/server-utils.js';

describe('resolveStaticPath', () => {
  const rootDirectory = path.resolve('project-root');

  it('resolve a raiz para index.html', () => {
    assert.equal(
      resolveStaticPath('/', rootDirectory),
      path.join(rootDirectory, 'index.html'),
    );
  });

  it('preserva caminhos de assets e ignora query strings', () => {
    assert.equal(
      resolveStaticPath('/css/base.css?v=1', rootDirectory),
      path.join(rootDirectory, 'css', 'base.css'),
    );
  });

  it('bloqueia arquivos ocultos', () => {
    assert.equal(resolveStaticPath('/.git/config', rootDirectory), null);
  });

  it('bloqueia travessia de diretórios codificada', () => {
    assert.equal(resolveStaticPath('/%2e%2e/secret.txt', rootDirectory), null);
    assert.equal(resolveStaticPath('/..%5csecret.txt', rootDirectory), null);
  });
});

describe('getContentType', () => {
  it('retorna os tipos corretos para HTML, CSS e JavaScript', () => {
    assert.equal(getContentType('index.html'), 'text/html; charset=utf-8');
    assert.equal(getContentType('base.css'), 'text/css; charset=utf-8');
    assert.equal(getContentType('app.js'), 'text/javascript; charset=utf-8');
  });

  it('usa tipo binário para extensão desconhecida', () => {
    assert.equal(getContentType('arquivo.xyz'), 'application/octet-stream');
  });
});
