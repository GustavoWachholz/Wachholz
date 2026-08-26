import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentType, resolveStaticPath } from './server-utils.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.WACHHOLZ_DEV_PORT ?? '8000', 10);

const server = createServer(async (request, response) => {
  const filePath = resolveStaticPath(request.url ?? '/', projectRoot);

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Não encontrado');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new Error('O caminho solicitado não é um arquivo.');
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(filePath),
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Não encontrado');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Nossa Casa disponível em http://127.0.0.1:${port}\n`);
});
