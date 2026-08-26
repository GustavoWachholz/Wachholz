# Banco Supabase

## Aplicação das migrations

1. Abra o SQL Editor do projeto no Supabase.
2. Execute integralmente `migrations/001_initial_schema.sql`.
3. Execute integralmente `migrations/002_household_rls.sql`.
4. Confirme que as seis tabelas foram criadas no schema `public`.
5. Confirme que RLS aparece habilitado em todas elas.
6. Confirme que a função `private.is_household_member` não aparece entre as funções expostas pela Data API.

Execute os arquivos sempre na ordem numérica. Cada migration usa uma transação e deve terminar sem erros antes de seguir para a próxima.

## Estado de segurança

A primeira migration segue o princípio de negação por padrão. A segunda concede ao papel `authenticated` apenas os privilégios previstos e aplica policies explícitas por operação e household.

`households` e `household_members` permanecem somente leitura pelo navegador. As tabelas dos módulos permitem CRUD aos membros da household, com `created_by` validado no insert e campos de propriedade imutáveis no update.

Antes de liberar o uso, execute o roteiro de `RLS_TEST_PLAN.md` com três usuários de teste.

Nunca use uma chave `service_role` ou `sb_secret_*` no navegador ou em `js/config.js`.
