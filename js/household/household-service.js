import { unwrapSupabaseResult } from '../lib/supabase-result.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HOUSEHOLD_MESSAGES = Object.freeze({
  HOUSEHOLD_NOT_FOUND: 'Seu usuário ainda não está associado a uma casa.',
  INVALID_USER: 'Não foi possível identificar o usuário autenticado.',
  MULTIPLE_HOUSEHOLDS: 'Seu usuário está associado a mais de uma casa.',
});

export class HouseholdError extends Error {
  constructor(code, cause) {
    super(HOUSEHOLD_MESSAGES[code] ?? 'Não foi possível carregar os dados da casa.', cause ? { cause } : undefined);
    this.name = 'HouseholdError';
    this.code = code;
  }
}

export function validateUserId(userId) {
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    throw new HouseholdError('INVALID_USER');
  }

  return userId;
}

function ensureDatabaseClient(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('O cliente de banco do Supabase está incompleto.');
  }

  return client;
}

export function createHouseholdService(client) {
  const database = ensureDatabaseClient(client);

  return Object.freeze({
    async getActiveHousehold(userId) {
      const safeUserId = validateUserId(userId);
      const membershipsResult = await database
        .from('household_members')
        .select('household_id')
        .eq('user_id', safeUserId)
        .limit(2);
      const memberships = unwrapSupabaseResult(membershipsResult, {
        operation: 'buscar a casa do usuário',
      });

      if (!Array.isArray(memberships) || memberships.length === 0) {
        throw new HouseholdError('HOUSEHOLD_NOT_FOUND');
      }

      if (memberships.length > 1) {
        throw new HouseholdError('MULTIPLE_HOUSEHOLDS');
      }

      const householdId = memberships[0].household_id;
      const householdResult = await database
        .from('households')
        .select('id, name')
        .eq('id', householdId)
        .single();
      const household = unwrapSupabaseResult(householdResult, {
        operation: 'carregar os dados da casa',
      });

      if (!household?.id || !household?.name) {
        throw new HouseholdError('HOUSEHOLD_NOT_FOUND');
      }

      return Object.freeze({
        id: household.id,
        name: household.name,
      });
    },
  });
}
