# SPEC — Plataforma Doméstica / MVP 0.1

## 1. Visão geral

A aplicação será uma plataforma doméstica modular, acessível pela web e destinada ao uso compartilhado por membros de uma mesma casa. O produto é **mobile first**: seu contexto principal de uso é o celular, inclusive durante tarefas rápidas e em movimento, como consultar gastos ou marcar itens no mercado. O desktop é um contexto complementar.

O MVP 0.1 terá dois módulos:

- **Financeiro**
- **Lista de compras**

A arquitetura deve permitir a inclusão futura de novos módulos sem alterar a fundação de autenticação, autorização, navegação e compartilhamento de dados.

---

## 2. Objetivos do produto

### Objetivo principal

Centralizar informações domésticas em uma aplicação web simples, gratuita e projetada prioritariamente para uso em smartphones, sem impedir o uso em telas maiores.

### Objetivos do MVP

1. Validar autenticação e compartilhamento de dados.
2. Validar persistência com Supabase.
3. Validar sincronização entre dispositivos.
4. Entregar uma lista de compras realmente utilizável.
5. Entregar controle financeiro mensal básico.
6. Criar uma base técnica reutilizável.
7. Manter uma suíte unitária obrigatória e executável sem dependências externas.

---

## 3. Personas

### Membro da household

Usuário autenticado que pode acessar os dados compartilhados da casa.

No MVP não haverá diferenciação entre administrador e membro.

Todos os membros da household terão permissão para:

- visualizar
- criar
- editar
- excluir

registros dos módulos do MVP.

---

## 4. Princípios de produto

### Mobile first

O celular é a plataforma principal do produto e deve orientar as decisões de UX, layout, hierarquia de informação, performance e testes. Todas as telas e fluxos devem ser desenhados primeiro para uma viewport estreita e interação por toque; layouts de tablet e desktop devem ser evoluções progressivas dessa base, e não o ponto de partida.

### Poucos passos

Operações frequentes devem exigir o menor número possível de interações.

### Dados compartilhados

A household, e não o usuário individual, é a principal unidade de propriedade dos dados.

### Segurança por padrão

Nenhuma tabela do aplicativo deve ficar acessível sem RLS.

### Modularidade

Cada módulo deve ser relativamente independente no front-end.

### Evolução incremental

Não antecipar funcionalidades complexas do financeiro no MVP.

---

## 5. Arquitetura

```text
Browser mobile (principal) / desktop (complementar)
   │
   ▼
GitHub Pages
   │
   │ HTTPS
   ▼
Supabase
├── Auth
├── PostgreSQL
├── RLS
└── Realtime
```

### Front-end

- HTML5 semântico
- CSS3 mobile first
- JavaScript moderno puro, usando ES Modules
- roteamento por hash implementado com APIs nativas do navegador
- Supabase JavaScript Client `2.111.0`, carregado sob demanda como dependência externa isolada e com versão fixada

### Regra obrigatória de tecnologia

O front-end deve ser composto exclusivamente por **HTML, CSS e JavaScript puros**. Não utilizar React, Vue, Angular, Svelte, TypeScript, JSX, Vite, Webpack, Babel ou qualquer framework, transpilador ou bundler equivalente.

Os arquivos publicados devem ser executáveis diretamente pelo navegador, sem compilação ou etapa de build. APIs nativas da Web devem ser preferidas. O Supabase JavaScript Client é permitido apenas como SDK de acesso ao serviço e não altera essa regra.

### Backend

O front-end acessará diretamente o Supabase usando a chave pública destinada ao browser.

É proibido incluir no front-end:

- `service_role`
- secret keys
- credenciais administrativas
- senhas de banco

---

## 6. Rotas

### Públicas

```text
/#/login
```

### Protegidas

```text
/#/
/#/financeiro
/#/compras
/#/compras/:listId
/#/configuracoes
```

Usuário não autenticado que tentar acessar rota protegida deve ser direcionado ao login.

---

## 7. Modelo de dados

## 7.1 households

Representa uma unidade doméstica.

```sql
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
```

---

## 7.2 household_members

Relaciona usuários autenticados às households.

```sql
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
```

---

## 7.3 financial_categories

Categorias de receitas ou despesas.

```sql
create table financial_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### Exemplos

Receitas:

- Salário
- Venda
- Extra

Despesas:

- Moradia
- Alimentação
- Saúde
- Transporte
- Assinaturas
- Outros

---

## 7.4 financial_transactions

Representa um lançamento financeiro.

```sql
create table financial_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references financial_categories(id),
  created_by uuid not null references auth.users(id),
  type text not null check (type in ('income', 'expense')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Regras

- `amount` sempre positivo
- tipo define se é receita ou despesa
- categoria deve corresponder ao tipo do lançamento
- saldo é calculado, não armazenado

---

## 7.5 shopping_lists

Representa uma lista.

```sql
create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
```

---

## 7.6 shopping_items

Representa um item de lista.

```sql
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity numeric(10,2),
  unit text,
  notes text,
  is_checked boolean not null default false,
  created_by uuid not null references auth.users(id),
  checked_by uuid references auth.users(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Regras

Ao marcar:

```text
is_checked = true
checked_by = usuário atual
checked_at = agora
```

Ao desmarcar:

```text
is_checked = false
checked_by = null
checked_at = null
```

---

## 8. Row Level Security

Todas as tabelas devem ter RLS ativado.

### Função auxiliar obrigatória

```sql
create schema if not exists private;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
```

A função `security definer` deve ficar em schema não exposto pela Data API, usar `search_path` vazio e referenciar objetos com o schema explícito.

### Política conceitual

Para registros com `household_id`:

```text
SELECT
permitir se private.is_household_member(household_id)

INSERT
permitir se private.is_household_member(household_id)

UPDATE
permitir se private.is_household_member(household_id)

DELETE
permitir se private.is_household_member(household_id)
```

As policies devem ser criadas explicitamente em cada tabela.

### Segurança adicional

No `INSERT`, validar também:

```text
created_by = auth.uid()
```

quando aplicável.

`household_id`, `created_by` e outros campos de propriedade não podem ser alterados depois da criação do registro. Essa imutabilidade deve ser protegida no banco, e não apenas ocultada na interface.

---

## 9. Autenticação

### MVP

- e-mail
- senha
- login
- logout
- persistência automática de sessão

### Não incluído

- cadastro público
- login social
- convite automatizado
- MFA
- níveis de acesso

Os usuários iniciais podem ser criados manualmente no Supabase.

---

## 10. Estado da household no front-end

Após login:

1. obter `auth.uid()`
2. buscar membership
3. identificar household ativa
4. armazenar `householdId` em contexto da aplicação
5. usar esse ID em todas as queries

No MVP assume-se que cada usuário participa de apenas uma household.

O banco, porém, deve aceitar múltiplas para permitir evolução futura.

---

# 11. Módulo — Lista de compras

## 11.1 Tela de listas

Deve exibir:

- nome
- quantidade de itens pendentes
- ação para abrir
- ação para criar nova lista

### Estado vazio

```text
Nenhuma lista criada.
Crie sua primeira lista de compras.
```

---

## 11.2 Tela de uma lista

### Cabeçalho

- nome da lista
- contador de pendentes
- voltar

### Campo rápido

Campo de texto sempre visível e facilmente alcançável com o polegar, sem ser encoberto pelo teclado virtual:

```text
[ Adicionar item... ] [+]
```

Enter deve adicionar.

### Item

Exibir:

- checkbox
- nome
- quantidade/unidade quando existentes
- observação quando existente
- editar
- excluir

No celular, o item deve usar toda a largura disponível, manter o checkbox e a ação principal em alvos de toque amplos e acomodar as ações secundárias sem causar rolagem horizontal.

Itens concluídos:

- visualmente diferenciados
- posicionados após os pendentes

### Ordenação

1. `is_checked = false`
2. `created_at ASC`

Depois:

1. `is_checked = true`
2. `checked_at DESC`

---

## 11.3 Cadastro de item

### Obrigatório

- nome

### Opcional

- quantidade
- unidade
- observação

### Validação

- nome não pode ser vazio
- quantidade, quando informada, deve ser maior que zero

---

## 11.4 Realtime

A aplicação deve escutar:

- INSERT
- UPDATE
- DELETE

em `shopping_items`.

Após evento relevante:

- validar que o evento pertence à household e à lista abertas
- atualizar estado local
- evitar duplicidade
- manter ordenação
- aceitar que, com RLS, um evento `DELETE` contenha somente o identificador antigo

A assinatura deve ser cancelada ao trocar de lista, sair da tela, encerrar a sessão ou fechar a página. Uma indisponibilidade temporária do canal deve ser informada sem bloquear o CRUD persistido.

Objetivo:

> Dois dispositivos com a mesma lista aberta devem convergir para o mesmo estado sem reload manual.

---

# 12. Módulo — Financeiro

## 12.1 Tela principal

### Seletor de mês

Exemplo:

```text
< Agosto 2026 >
```

A troca do mês deve atualizar indicadores e lançamentos.

### Indicadores

```text
Receitas
Despesas
Saldo
```

### Fórmulas

```text
receitas = soma(amount where type = 'income')
despesas = soma(amount where type = 'expense')
saldo = receitas - despesas
```

---

## 12.2 Lista de lançamentos

Exibir:

- data
- descrição
- categoria
- tipo
- valor
- ações

No celular, os lançamentos devem ser apresentados em lista ou cards legíveis, com as informações essenciais priorizadas. Uma tabela larga não deve ser requisito para operar o módulo, e nenhuma ação pode depender de rolagem horizontal.

Ordenação padrão:

```text
transaction_date DESC
created_at DESC
```

---

## 12.3 Cadastro de lançamento

### Campos

- tipo
- descrição
- valor
- data
- categoria
- observação

### Tipo

```text
Receita
Despesa
```

### Regras

- descrição obrigatória
- valor > 0
- data obrigatória
- categoria obrigatória
- categoria deve ser compatível com o tipo

### Valor

Entrada aceita em formato brasileiro.

Exemplo:

```text
1.234,56
```

Antes de enviar ao banco, normalizar para valor decimal compatível com PostgreSQL.

---

## 12.4 Edição

Todos os campos editáveis.

`updated_at` deve ser atualizado.

---

## 12.5 Exclusão

Exigir confirmação antes de excluir lançamento.

Exemplo:

```text
Excluir "Supermercado" no valor de R$ 183,49?
```

---

## 12.6 Filtros

### Obrigatórios no MVP

- mês
- tipo
- categoria

Filtro por texto fica opcional.

---

# 13. Dashboard

Tela inicial da aplicação.

## Card financeiro

Exibir mês atual:

```text
Receitas
Despesas
Saldo
```

Botão:

```text
Abrir financeiro
```

## Card compras

Exibir:

```text
Itens pendentes
```

Botão:

```text
Abrir lista
```

Se houver mais de uma lista, somar itens das listas ativas.

---

# 14. Configurações

No MVP:

- nome da household, somente leitura
- e-mail do usuário
- botão de logout
- exportar financeiro em CSV

Não é necessário permitir gestão de membros.

---

# 15. Exportação CSV

## Nome sugerido

```text
financeiro-2026-08.csv
```

### Colunas

```text
data
tipo
descricao
categoria
valor
observacao
```

### Regras

- exportar mês atualmente selecionado
- codificação UTF-8
- valores em formato legível
- nenhuma informação sensível de autenticação

---

# 16. Formatação brasileira

### Moeda

```text
R$ 1.234,56
```

Usar:

```ts
new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})
```

### Datas

Interface:

```text
24/08/2026
```

Banco:

```text
2026-08-24
```

---

# 17. UX mobile first e adaptação responsiva

## Mobile — experiência principal

O layout base deve ser implementado para smartphones e funcionar integralmente a partir de **320 px de largura**, com validação prioritária nas larguras mais comuns entre **360 px e 430 px**.

- barra de navegação inferior, persistente e compatível com a área segura do aparelho
- conteúdo em uma única coluna e sem rolagem horizontal
- alvos de toque com pelo menos `44 × 44 px`
- espaçamento suficiente para evitar toques acidentais
- formulários em coluna única, com tipo de teclado adequado ao campo (`email`, decimal, data etc.)
- ações principais visíveis e acessíveis com uma mão
- modais, menus e formulários compatíveis com teclado virtual e diferentes alturas de viewport
- textos essenciais legíveis sem zoom manual
- feedback imediato após toques e envios
- nenhuma funcionalidade dependente de `hover`, clique com botão direito ou ponteiro de alta precisão

Os fluxos mais frequentes — adicionar e marcar um item, consultar o saldo e cadastrar um lançamento — devem exigir poucos toques e ser concluídos confortavelmente no celular.

## Tablet e desktop — aprimoramento progressivo

Telas maiores podem aproveitar o espaço adicional sem alterar a lógica principal dos fluxos:

- sidebar lateral no lugar da navegação inferior
- conteúdo centralizado com largura máxima adequada
- mais colunas ou maior densidade de informação quando isso melhorar a leitura
- atalhos de teclado e estados de `hover` apenas como melhorias opcionais

A versão desktop não pode introduzir funcionalidades obrigatórias que estejam ausentes no celular.

### Breakpoint de referência

```text
768px
```

A implementação pode ajustar o breakpoint caso necessário.

---

# 18. Estados de interface

Toda tela que consulta banco deve possuir:

### Loading

```text
Carregando...
```

### Erro

Mensagem legível e ação de tentar novamente quando aplicável.

### Vazio

Explicar o que falta e apresentar CTA.

Exemplo:

```text
Ainda não há lançamentos neste mês.
Adicionar lançamento
```

---

# 19. Tratamento de erros

Não mostrar erros crus do PostgreSQL ao usuário.

### Exemplo

Interno:

```text
23503 foreign key violation
```

Usuário:

```text
Não foi possível salvar o lançamento.
Tente novamente.
```

Erros detalhados podem ser enviados ao `console.error` durante o MVP.

---

# 20. Acessibilidade mínima

- inputs com label
- botões com texto ou `aria-label`
- foco visível
- navegação por teclado
- contraste suficiente
- checkbox utilizável por teclado
- não depender apenas de cor para estado

---

# 21. Performance

O volume esperado é pequeno.

Ainda assim:

- priorizar carregamento e interação eficientes em rede móvel
- filtrar financeiro por intervalo de datas no banco
- não carregar todo o histórico em cada abertura
- carregar somente itens da lista atual
- evitar subscriptions Realtime duplicadas
- cancelar subscription ao sair da tela

---

# 22. Queries principais

## Financeiro por mês

Conceitualmente:

```text
transaction_date >= primeiro_dia
AND
transaction_date < primeiro_dia_mes_seguinte
AND
household_id = household_atual
```

## Lista de compras

```text
shopping_list_id = lista_atual
AND
household_id = household_atual
```

---

# 23. Integridade de dados

## Índices recomendados

```sql
create index idx_household_members_user
on household_members(user_id);

create index idx_financial_transactions_household_date
on financial_transactions(household_id, transaction_date);

create index idx_financial_transactions_category
on financial_transactions(category_id);

create index idx_shopping_lists_household
on shopping_lists(household_id);

create index idx_shopping_items_list
on shopping_items(shopping_list_id);

create index idx_shopping_items_household_checked
on shopping_items(household_id, is_checked);
```

---

# 24. Critérios de aceitação

## Autenticação

- Given usuário válido
- When informa credenciais corretas
- Then entra no sistema

- Given usuário não autenticado
- When acessa rota protegida
- Then é enviado ao login

---

## Household

- Given dois usuários da mesma household
- When um cria um registro
- Then o outro consegue visualizá-lo

- Given usuário de outra household
- When tenta acessar o registro
- Then o banco nega o acesso

---

## Lista de compras

- Given lista aberta
- When usuário adiciona "Leite"
- Then "Leite" aparece como pendente

- Given dois dispositivos com a lista aberta
- When dispositivo A conclui "Leite"
- Then dispositivo B recebe a alteração

- Given item concluído
- When usuário desmarca
- Then item retorna aos pendentes

---

## Financeiro

- Given mês com receitas de R$ 5.000 e despesas de R$ 3.000
- When tela é carregada
- Then saldo exibido é R$ 2.000

- Given lançamento de despesa
- When usuário altera valor
- Then totais do mês são recalculados

- Given mudança de agosto para setembro
- When mês muda
- Then apenas lançamentos de setembro são considerados

---

# 25. Segurança

## Obrigatório

- HTTPS
- RLS
- chave `anon` apenas
- nenhuma secret no GitHub
- configuração do navegador limitada à URL e à chave pública `anon` do Supabase
- nenhuma `service_role`, secret key ou credencial administrativa nos arquivos estáticos
- validação no cliente
- constraints no banco

### Observação

Validação de front-end melhora UX, mas nunca substitui proteção no banco.

---

# 26. Deploy

## Desenvolvimento

Servir os arquivos estáticos localmente para que ES Modules funcionem corretamente. O projeto fornece um servidor de desenvolvimento sem dependências externas:

```text
node scripts/serve.js
```

Então acessar:

```text
http://localhost:8000
```

Não deve existir etapa de build, compilação ou geração de `dist`.

## GitHub Pages

O GitHub Pages deve publicar diretamente os arquivos estáticos do projeto. Caso seja usado GitHub Actions, o workflow deve apenas:

1. obter o conteúdo do repositório
2. executar a suíte completa com `node --test`
3. interromper a publicação se qualquer teste falhar
4. enviar os arquivos HTML, CSS, JavaScript e assets como artefato do Pages
5. publicar o artefato sem transformação

Todos os caminhos de assets e imports devem funcionar sob o subdiretório do repositório no GitHub Pages, preferencialmente com caminhos relativos.

---

# 27. Configuração do Supabase

Como não existe build nem processamento de variáveis de ambiente, a configuração pública deve ficar em um módulo JavaScript dedicado e versionado. Exemplo de `js/config.js`:

```js
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
```

A URL e a chave pública `anon` do Supabase podem ser usadas no navegador e publicadas no GitHub Pages desde que as policies RLS estejam corretas.

Nunca adicionar `service_role`, secret keys, senhas de banco ou outras credenciais administrativas aos arquivos JavaScript ou ao repositório.

---

# 28. Seed inicial

Criar manualmente ou por script:

### Household

```text
Nossa Casa
```

### Categorias de receita

- Salário
- Venda
- Extra
- Outros

### Categorias de despesa

- Moradia
- Alimentação
- Saúde
- Transporte
- Telefone
- Assinaturas
- Lazer
- Compras
- Outros

### Lista

```text
Mercado
```

---

# 29. Convenções de código

### Arquivos

Usar nomes em kebab-case e extensões nativas:

```text
financial-summary.js
shopping-item.js
shopping-list.css
```

### Módulos JavaScript

Organizar o comportamento em ES Modules com responsabilidades claras. Manipular a interface com APIs nativas do DOM e manter estado explícito em módulos JavaScript, sem abstrações específicas de frameworks.

### Services

Funções responsáveis por acesso ao Supabase.

Evitar queries espalhadas diretamente pelos controladores de tela.

Exemplo:

```text
js/modules/finance/services/transactions.js
js/modules/shopping/services/items.js
```

---

# 30. Testes automatizados obrigatórios

## Regra por implementação

Toda implementação, correção de defeito ou alteração de comportamento deve incluir, na mesma entrega, testes unitários que cubram o comportamento novo ou alterado. Código de produção sem os respectivos testes não é considerado concluído.

Os módulos devem ser pequenos e testáveis isoladamente. Regras de negócio não devem depender diretamente do DOM, da rede, do relógio ou de uma instância real do Supabase. Essas dependências devem ser recebidas por parâmetro ou encapsuladas para permitir o uso de mocks e dados determinísticos.

## Ferramentas

Usar o test runner nativo do Node.js:

```text
node --test
```

Os testes devem usar `node:test` e `node:assert/strict`, sem Jest, Vitest ou outras dependências externas. Os arquivos devem ficar em `tests/unit/` e usar o sufixo `.test.js`.

## Cobertura funcional mínima

Devem possuir testes unitários, quando aplicável:

- resolução de rotas e proteção de acesso
- validação e normalização de formulários
- formatação e conversão de moeda e datas
- ordenação e transição de estado dos itens de compras
- cálculo de receitas, despesas e saldo
- filtros por mês, tipo e categoria
- geração e escape do CSV
- transformação de respostas e erros do Supabase, usando clientes simulados
- tratamento de eventos Realtime, incluindo deduplicação

Testes unitários não substituem testes de integração, validação de RLS, acessibilidade ou inspeção visual mobile.

## Gate obrigatório por fase

Ao final de **cada fase de desenvolvimento**, a suíte unitária completa deve ser executada, e não apenas os testes adicionados naquela fase. Qualquer falha bloqueia o encerramento da fase e o início da seguinte.

O resultado esperado é:

```text
node --test
→ todos os testes aprovados
→ zero testes ignorados ou marcados como exclusivos
```

A suíte completa também deve ser executada no workflow de integração contínua e imediatamente antes da publicação no GitHub Pages.

---

# 31. Não objetivos arquiteturais do MVP

Não implementar agora:

- backend próprio
- microserviços
- SSR
- filas
- caches distribuídos
- API intermediária
- sistema de permissões complexo
- banco offline próprio
- abstrações genéricas para módulos que ainda não existem

O MVP deve permanecer simples.

---

# 32. Preparação para o MVP 0.2

A arquitetura deve deixar espaço para:

```text
accounts
credit_cards
credit_card_invoices
installment_plans
installments
recurring_transactions
financial_goals
budgets
```

Nenhuma dessas tabelas precisa existir no MVP 0.1.

O modelo de `household_id` deve ser mantido em todos os módulos futuros.

---

# 33. Definition of Done

Uma funcionalidade só é considerada pronta quando:

- [ ] possui testes unitários para todo comportamento novo ou alterado
- [ ] todos os testes unitários relacionados passam isoladamente
- [ ] a suíte completa foi executada e aprovada ao final da fase
- [ ] funciona integralmente no celular, por toque, a partir de 320 px e sem rolagem horizontal
- [ ] foi validada prioritariamente em viewport entre 360 px e 430 px
- [ ] permanece utilizável com o teclado virtual aberto, quando houver formulários
- [ ] adapta-se corretamente ao desktop como aprimoramento progressivo
- [ ] trata loading
- [ ] trata erro
- [ ] trata estado vazio
- [ ] possui validação
- [ ] respeita RLS
- [ ] não expõe segredo
- [ ] foi testada com pelo menos dois usuários da mesma household
- [ ] foi testada após reload da página
- [ ] está publicada no ambiente do GitHub Pages

---

# 34. Resultado esperado do MVP

Ao final do MVP 0.1, a plataforma deve permitir este fluxo:

```text
Login
  ↓
Dashboard
  ├── Financeiro
  │     ├── visualizar mês
  │     ├── adicionar receita
  │     ├── adicionar despesa
  │     ├── editar
  │     ├── excluir
  │     └── exportar CSV
  │
  └── Compras
        ├── abrir lista
        ├── adicionar item
        ├── editar
        ├── marcar
        ├── excluir
        └── sincronizar entre dispositivos
```

Esse MVP será a fundação técnica e funcional para os módulos domésticos futuros.
