import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DataAccessError,
  unwrapSupabaseResult,
} from '../../js/lib/supabase-result.js';

describe('unwrapSupabaseResult', () => {
  it('retorna os dados de uma resposta bem-sucedida', () => {
    const rows = [{ id: '1' }];

    assert.equal(unwrapSupabaseResult({ data: rows, error: null }), rows);
  });

  it('preserva null como resultado válido', () => {
    assert.equal(unwrapSupabaseResult({ data: null, error: null }), null);
  });

  it('converte erro conhecido em mensagem legível', () => {
    assert.throws(
      () =>
        unwrapSupabaseResult(
          {
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          },
          { operation: 'criar categoria' },
        ),
      (error) => {
        assert.ok(error instanceof DataAccessError);
        assert.equal(error.code, '23505');
        assert.equal(error.operation, 'criar categoria');
        assert.equal(error.message, 'Este registro já existe.');
        assert.equal(error.cause.message, 'duplicate key value');
        return true;
      },
    );
  });

  it('não expõe mensagem crua de erro desconhecido', () => {
    assert.throws(
      () =>
        unwrapSupabaseResult({
          data: null,
          error: { code: 'XX000', message: 'internal database details' },
        }),
      (error) => {
        assert.equal(error.message, 'Não foi possível acessar os dados. Tente novamente.');
        assert.doesNotMatch(error.message, /database details/);
        return true;
      },
    );
  });

  it('rejeita respostas fora do contrato esperado', () => {
    assert.throws(() => unwrapSupabaseResult(undefined), DataAccessError);
  });
});
