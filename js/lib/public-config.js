function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function validatePublicConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return {
      isValid: false,
      errors: ['Configuração pública ausente.'],
    };
  }

  if (!isValidHttpUrl(config.supabaseUrl)) {
    errors.push('SUPABASE_URL deve ser uma URL HTTPS válida.');
  }

  if (
    typeof config.supabaseAnonKey !== 'string' ||
    config.supabaseAnonKey.trim().length === 0
  ) {
    errors.push('SUPABASE_ANON_KEY deve ser informada.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
