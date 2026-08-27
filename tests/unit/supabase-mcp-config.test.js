import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const configUrl = new URL('../../.mcp.json', import.meta.url);
const expectedFeatures = [
  'database',
  'debugging',
  'development',
  'docs',
  'functions',
];

async function readMcpConfig() {
  return JSON.parse(await readFile(configUrl, 'utf8'));
}

describe('configuração MCP do Supabase', () => {
  it('restringe o conector ao projeto e aos grupos necessários', async () => {
    const config = await readMcpConfig();
    const server = config.mcpServers?.supabase;
    const endpoint = new URL(server?.url);
    const features = endpoint.searchParams.get('features')?.split(',').sort();

    assert.deepEqual(Object.keys(config.mcpServers), ['supabase']);
    assert.equal(server.type, 'http');
    assert.equal(endpoint.origin, 'https://mcp.supabase.com');
    assert.equal(endpoint.pathname, '/mcp');
    assert.equal(endpoint.searchParams.get('project_ref'), 'dejctaugwnvhlwmndfli');
    assert.deepEqual(features, expectedFeatures);
  });

  it('não versiona credenciais no endpoint MCP', async () => {
    const config = await readMcpConfig();
    const endpoint = new URL(config.mcpServers.supabase.url);
    const forbiddenParameters = [
      'access_token',
      'apikey',
      'authorization',
      'key',
      'password',
      'token',
    ];

    for (const parameter of forbiddenParameters) {
      assert.equal(endpoint.searchParams.has(parameter), false);
    }
  });
});
