# Plano de teste de integração — Household e RLS

## Pré-requisitos

Crie manualmente no Supabase Auth três usuários exclusivos para teste:

- Usuário A: membro da Casa 1
- Usuário B: membro da Casa 1
- Usuário C: membro da Casa 2

Crie as duas households e suas memberships pelo SQL Editor, usando os UUIDs gerados pelo Auth. Não registre senhas, access tokens ou refresh tokens neste arquivo ou no repositório.

## Matriz obrigatória

### Usuários da mesma household

1. Entre como Usuário A.
2. Crie uma categoria ou registro ligado à Casa 1.
3. Entre como Usuário B em outro navegador ou perfil.
4. Confirme que o registro da Casa 1 pode ser consultado, editado e excluído.

Resultado esperado: operações permitidas.

### Usuário de outra household

1. Entre como Usuário C.
2. Tente consultar o ID do registro criado na Casa 1.
3. Tente inserir um registro com `household_id` da Casa 1.
4. Tente atualizar ou excluir o registro da Casa 1.

Resultado esperado: nenhuma linha da Casa 1 é retornada e todas as mutações são negadas.

### Autoria e propriedade

1. Entre como Usuário A e crie um registro usando `created_by` do Usuário A.
2. Tente criar outro registro informando o UUID do Usuário B em `created_by`.
3. Tente alterar `created_by`, `household_id` ou `shopping_list_id` de um registro existente.

Resultado esperado: o insert legítimo é permitido; autoria falsa e alterações de propriedade são negadas.

### Acesso anônimo

Sem sessão autenticada, tente consultar cada uma das seis tabelas pela Data API.

Resultado esperado: nenhum dado é acessível.

### Marcação de item

1. Entre como Usuário A e marque um item como concluído.
2. Confirme no banco que `checked_by` recebeu o UUID do Usuário A e `checked_at` foi preenchido.
3. Desmarque o item.
4. Confirme que os dois campos voltaram a `null`.

Resultado esperado: os metadados são definidos pelo banco de forma consistente com `is_checked`.

## Gate da fase

A Fase 3 só pode ser considerada validada no ambiente integrado quando todos os cenários acima passarem e a suíte local `node --test` também estiver aprovada.
