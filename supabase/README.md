# Banco Supabase

## Estado remoto

O esquema está aplicado no projeto de desenvolvimento `GustavoWachholz's Project` (`dejctaugwnvhlwmndfli`), disponível em `https://dejctaugwnvhlwmndfli.supabase.co`.

Em 27/08/2026, as três migrations foram registradas no histórico remoto e a validação confirmou:

- seis tabelas no schema `public`, todas com RLS habilitado;
- 18 policies por operação e household;
- nenhum privilégio de tabela concedido ao papel `anon`;
- funções auxiliares restritas ao schema `private`;
- `shopping_items` na publicação `supabase_realtime` com `REPLICA IDENTITY FULL`;
- nenhum alerta no Security Advisor.

O Performance Advisor apresenta somente recomendações informativas: seis chaves estrangeiras sem índice dedicado e sete índices ainda não utilizados. Os índices não utilizados são esperados enquanto o banco estiver vazio; as recomendações devem ser reavaliadas com dados e consultas reais antes de alterar a estratégia de índices.

O arquivo `.mcp.json` limita o MCP a este projeto e aos grupos necessários ao desenvolvimento. Ele não contém tokens nem chaves.

## Aplicação das migrations

1. Abra o SQL Editor do projeto no Supabase.
2. Execute integralmente `migrations/001_initial_schema.sql`.
3. Execute integralmente `migrations/002_household_rls.sql`.
4. Execute integralmente `migrations/003_shopping_items_realtime.sql`.
5. Confirme que as seis tabelas foram criadas no schema `public`.
6. Confirme que RLS aparece habilitado em todas elas.
7. Confirme que `shopping_items` pertence à publicação `supabase_realtime` e usa `REPLICA IDENTITY FULL`.
8. Confirme que a função `private.is_household_member` não aparece entre as funções expostas pela Data API.

Execute os arquivos sempre na ordem numérica. Cada migration usa uma transação e deve terminar sem erros antes de seguir para a próxima.

## Estado de segurança

A primeira migration segue o princípio de negação por padrão. A segunda concede ao papel `authenticated` apenas os privilégios previstos e aplica policies explícitas por operação e household. A terceira habilita a replicação dos itens de compras, inclusive a identidade necessária para filtrar eventos de exclusão por lista.

`households` e `household_members` permanecem somente leitura pelo navegador. As tabelas dos módulos permitem CRUD aos membros da household, com `created_by` validado no insert e campos de propriedade imutáveis no update.

Antes de liberar o uso, execute o roteiro de `RLS_TEST_PLAN.md` com três usuários de teste.

Nunca use uma chave `service_role` ou `sb_secret_*` no navegador ou em `js/config.js`.

A conexão do navegador permanece pendente até `js/config.js` receber somente a URL do projeto e uma chave pública ativa. Nenhuma credencial administrativa deve ser versionada.
