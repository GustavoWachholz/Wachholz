import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config.js';
import { validatePublicConfig } from './public-config.js';

export const SUPABASE_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';

export class PublicConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicConfigError';
    this.code = 'INVALID_PUBLIC_CONFIG';
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded));
  } catch {
    return null;
  }
}

export function assertSafeBrowserConfig(config) {
  const validation = validatePublicConfig(config);

  if (!validation.isValid) {
    throw new PublicConfigError(validation.errors.join(' '));
  }

  const key = config.supabaseAnonKey.trim();
  const jwtPayload = decodeJwtPayload(key);

  if (key.startsWith('sb_secret_') || jwtPayload?.role === 'service_role') {
    throw new PublicConfigError(
      'Uma chave administrativa do Supabase não pode ser usada no navegador.',
    );
  }

  return {
    supabaseUrl: config.supabaseUrl.trim().replace(/\/$/, ''),
    supabaseAnonKey: key,
  };
}

export function createSupabaseClient({ config, createClient }) {
  const safeConfig = assertSafeBrowserConfig(config);

  if (typeof createClient !== 'function') {
    throw new TypeError('A função createClient do Supabase não foi carregada.');
  }

  return createClient(safeConfig.supabaseUrl, safeConfig.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
    db: {
      schema: 'public',
    },
  });
}

export async function initializeSupabaseClient({
  config,
  importModule = (moduleUrl) => import(moduleUrl),
  moduleUrl = SUPABASE_MODULE_URL,
}) {
  const safeConfig = assertSafeBrowserConfig(config);
  const module = await importModule(moduleUrl);

  return createSupabaseClient({
    config: safeConfig,
    createClient: module?.createClient,
  });
}

let clientPromise;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = initializeSupabaseClient({
      config: {
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
      },
    });
  }

  return clientPromise;
}
