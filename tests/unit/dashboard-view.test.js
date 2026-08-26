import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDashboardMarkup } from '../../js/modules/dashboard/dashboard-view.js';

describe('getDashboardMarkup', () => {
  it('renderiza os cards estruturais com atalhos de toque', () => {
    const markup = getDashboardMarkup({
      household: { name: 'Casa Wachholz' },
      dashboardState: { status: 'empty' },
    });

    assert.match(markup, /summary-card--finance/);
    assert.match(markup, /summary-card--shopping/);
    assert.match(markup, /href="#\/financeiro"/);
    assert.match(markup, /href="#\/compras"/);
    assert.match(markup, /Sua casa está pronta/);
  });

  it('exibe e formata o contrato de resumo pronto', () => {
    const markup = getDashboardMarkup({
      dashboardState: {
        status: 'ready',
        summary: {
          finance: { income: 2000, expenses: 750, transactionCount: 3 },
          shopping: { pendingItems: 8, activeLists: 2 },
        },
      },
    });

    assert.match(markup, /R\$[\s\u00a0]2\.000,00/);
    assert.match(markup, /R\$[\s\u00a0]750,00/);
    assert.match(markup, /R\$[\s\u00a0]1\.250,00/);
    assert.match(markup, /<strong>8<\/strong> itens pendentes/);
    assert.doesNotMatch(markup, /Sua casa está pronta/);
  });

  it('renderiza loading e erro com feedback acessível', () => {
    const loading = getDashboardMarkup({ dashboardState: { status: 'loading' } });
    const error = getDashboardMarkup({
      dashboardState: { status: 'error', error: new Error('Falha temporária') },
    });

    assert.match(loading, /role="status"/);
    assert.match(loading, /Montando o resumo da casa/);
    assert.match(error, /role="alert"/);
    assert.match(error, /data-feedback-action/);
  });

  it('escapa o nome da household', () => {
    const markup = getDashboardMarkup({
      household: { name: '<script>ruim</script>' },
      dashboardState: { status: 'empty' },
    });

    assert.doesNotMatch(markup, /<script>/);
    assert.match(markup, /&lt;script&gt;ruim&lt;\/script&gt;/);
  });
});
