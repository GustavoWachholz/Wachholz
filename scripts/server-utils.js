import path from 'node:path';

export function resolveStaticPath(requestUrl, rootDirectory) {
  let pathname;

  try {
    const rawPathname = String(requestUrl).split(/[?#]/, 1)[0];
    pathname = decodeURIComponent(rawPathname).replaceAll('\\', '/');
  } catch {
    return null;
  }

  if (!pathname.startsWith('/')) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  if (segments.some((segment) => segment.startsWith('.'))) {
    return null;
  }

  const requestedPath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const absolutePath = path.resolve(rootDirectory, `.${requestedPath}`);
  const relativePath = path.relative(rootDirectory, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

export function getContentType(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };

  return types[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}
