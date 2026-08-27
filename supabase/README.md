# Banco Supabase

## Estado remoto

O esquema está aplicado no projeto de desenvolvimento `GustavoWachholz's Project` (`dejctaugwnvhlwmndfli`), disponível em `https://dejctaugwnvhlwmndfli.supabase.co`.

Em 27/08/2026, as quatro migrations foram registradas no histórico remoto e a validação confirmou:

- seis tabelas no schema `public`, todas com RLS habilitado;
- 18 policies por operação e household;
- nenhum privilégio de tabela concedido ao papel `anon`;
- funções auxiliares restritas ao schema `private`;
- `shopping_items` na publicação `supabase_realtime` com `REPLICA IDENTITY FULL`;
- nenhum alerta no Security Advisor;
- limites textuais do navegador também protegidos por constraints no PostgreSQL;
- todas as chaves estrangeiras cobertas por índices.

O Performance Advisor apresenta somente recomendações informativas de índices ainda não utilizados. Isso é esperado enquanto o banco estiver vazio; as recomendações devem ser reavaliadas com dados e consultas reais antes de remover qualquer índice.

O arquivo `.mcp.json` limita o MCP a este projeto e aos grupos necessários ao desenvolvimento. Ele não contém tokens nem chaves.

## Aplicação das migrations

1. Abra o SQL Editor do projeto no Supabase.
2. Execute integralmente `migrations/001_initial_schema.sql`.
3. Execute integralmente `migrations/002_household_rls.sql`.
4. Execute integralmente `migrations/003_shopping_items_realtime.sql`.
5. Execute integralmente `migrations/004_persistence_hardening.sql`.
6. Confirme que as seis tabelas foram criadas no schema `public`.
7. Confirme que RLS aparece habilitado em todas elas.
8. Confirme que `shopping_items` pertence à publicação `supabase_realtime` e usa `REPLICA IDENTITY FULL`.
9. Confirme que a função `private.is_household_member` não aparece entre as funções expostas pela Data API.

Execute os arquivos sempre na ordem numérica. Cada migration usa uma transação e deve terminar sem erros antes de seguir para a próxima.

## Estado de segurança

A primeira migration segue o princípio de negação por padrão. A segunda concede ao papel `authenticated` apenas os privilégios previstos e aplica policies explícitas por operação e household. A terceira habilita a replicação dos itens de compras, inclusive a identidade necessária para filtrar eventos de exclusão por lista.

`households` e `household_members` permanecem somente leitura pelo navegador. As tabelas dos módulos permitem CRUD aos membros da household, com `created_by` validado no insert e campos de propriedade imutáveis no update.

Antes de liberar o uso, execute o roteiro de `RLS_TEST_PLAN.md` com três usuários de teste.

Nunca use uma chave `service_role` ou `sb_secret_*` no navegador ou em `js/config.js`.

A conexão do navegador usa em `js/config.js` somente a URL do projeto e uma chave moderna `sb_publishable_*`, que pode ser exposta em aplicações cliente. A chave `anon` JWT legada também funcionaria, mas não é necessária enquanto a chave publicável estiver ativa. O teste `public-browser-config.test.js` impede regressões para configuração vazia ou chave administrativa. Nenhuma credencial `sb_secret_*` ou `service_role` deve ser versionada.

## Preparação dos primeiros usuários

O cadastro público não faz parte do MVP. Antes do primeiro uso:

1. crie os usuários em **Authentication > Users**;
2. copie os UUIDs gerados pelo Auth;
3. crie uma household e associe os usuários em `household_members`;
4. crie ao menos uma categoria ativa de receita e uma de despesa para essa household.

Exemplo para executar no SQL Editor, substituindo os UUIDs:

```sql
do $$
declare
  new_household_id uuid := gen_random_uuid();
begin
  insert into public.households (id, name)
  values (new_household_id, 'Minha Casa');

  insert into public.household_members (household_id, user_id)
  values
    (new_household_id, 'UUID_DO_USUARIO_A'::uuid),
    (new_household_id, 'UUID_DO_USUARIO_B'::uuid);

  insert into public.financial_categories (household_id, name, type)
  values
    (new_household_id, 'Salário', 'income'),
    (new_household_id, 'Extra', 'income'),
    (new_household_id, 'Moradia', 'expense'),
    (new_household_id, 'Alimentação', 'expense'),
    (new_household_id, 'Transporte', 'expense'),
    (new_household_id, 'Outros', 'expense');
end;
$$;
```

Esse bootstrap é administrativo e deve ser executado apenas no painel. O navegador continua sem permissão para criar households ou memberships.
