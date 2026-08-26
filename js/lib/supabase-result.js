const USER_MESSAGES = Object.freeze({
  '23503': 'Este registro está relacionado a outro dado e não pode ser alterado.',
  '23505': 'Este registro já existe.',
  '42501': 'Você não tem permissão para realizar esta operação.',
  PGRST116: 'O registro solicitado não foi encontrado.',
});

export class DataAccessError extends Error {
  constructor({ code = 'DATA_ACCESS_ERROR', operation = 'acessar os dados', cause } = {}) {
    const userMessage =
      USER_MESSAGES[code] ?? 'Não foi possível acessar os dados. Tente novamente.';

    super(userMessage, cause ? { cause } : undefined);
    this.name = 'DataAccessError';
    this.code = code;
    this.operation = operation;
  }
}

export function unwrapSupabaseResult(result, { operation } = {}) {
  if (!result || typeof result !== 'object') {
    throw new DataAccessError({ operation });
  }

  if (result.error) {
    throw new DataAccessError({
      code: result.error.code,
      operation,
      cause: result.error,
    });
  }

  return result.data;
}
