# Plano de Implementação — MVP

## 1. Objetivo

Implementar a primeira versão utilizável de uma plataforma doméstica modular, hospedada no GitHub Pages e integrada ao Supabase.

O MVP deve validar a arquitetura que será reutilizada pelos módulos futuros e entregar duas funcionalidades iniciais:

1. **Lista de compras compartilhada**
2. **Controle financeiro básico**

O sistema será utilizado majoritariamente pelo celular. Por isso, deve ser concebido, implementado e testado primeiro para smartphones e interação por toque. O desktop será uma adaptação complementar para telas maiores. Em ambos os casos, o sistema deve permitir acesso autenticado por mais de um membro da mesma casa e persistir os dados entre dispositivos.

---

## 2. Escopo do MVP

### Incluído

- Autenticação de usuários
- Estrutura de household/família
- Associação de usuários à mesma household
- Dashboard inicial
- Navegação entre módulos
- Lista de compras compartilhada
- Cadastro de receitas e despesas
- Categorias financeiras
- Visualização financeira mensal
- Cálculo de receitas, despesas e saldo do mês
- Sincronização dos dados pelo Supabase
- Proteção do banco com Row Level Security
- Interface mobile first, responsiva e otimizada para toque
- Testes unitários obrigatórios para cada implementação
- Execução da suíte completa ao final de cada fase e na integração contínua
- Deploy no GitHub Pages

### Fora do MVP

- Cartões de crédito
- Faturas
- Parcelamentos
- Recorrências
- Projeção de meses futuros
- Orçamentos por categoria
- Metas financeiras
- Anexos/comprovantes
- Importação automática da planilha atual
- Integração entre compras e financeiro
- Notificações
- Outros módulos domésticos

Esses itens ficam previstos para versões posteriores.

---

## 3. Stack proposta

### Front-end

- HTML5 semântico
- CSS3
- JavaScript moderno puro com ES Modules
- APIs nativas do navegador para DOM, eventos, estado e roteamento por hash
- Supabase JavaScript Client como SDK externo isolado
- CSS mobile first, com estilos base para smartphones e media queries de aprimoramento para telas maiores

### Regra obrigatória

Todo o front-end deve ser implementado exclusivamente com **HTML, CSS e JavaScript puros**. Não utilizar React, Vue, Angular, Svelte, TypeScript, JSX, Vite, Webpack, Babel ou qualquer framework, transpilador ou bundler equivalente.

O projeto deve funcionar diretamente no navegador e ser publicável como arquivos estáticos, sem instalação de dependências, compilação ou etapa de build. APIs nativas da Web devem ser preferidas. O cliente JavaScript do Supabase é a única biblioteca prevista no MVP e deve ficar encapsulado no módulo de acesso a dados.

### Backend / dados

- Supabase
  - PostgreSQL
  - Auth
  - Row Level Security
  - Realtime para lista de compras

### Hospedagem

- GitHub
- GitHub Pages
- GitHub Actions para executar a suíte unitária e publicar os arquivos estáticos sem build

### Testes

- `node:test`
- `node:assert/strict`
- `node --test` para executar a suíte completa
- nenhum framework ou dependência externa de testes

### Estratégia de roteamento

Implementar um roteador simples com `window.location.hash` e o evento `hashchange`, evitando problemas de rotas diretas no GitHub Pages e sem depender de biblioteca de roteamento.

Exemplo:

- `/#/`
- `/#/financeiro`
- `/#/compras`
- `/#/configuracoes`

---

## 4. Estrutura de implementação

As fases foram deliberadamente reduzidas para que cada entrega seja pequena, revisável e reversível.

### Regra de saída de todas as fases

Para concluir qualquer fase, é obrigatório:

1. implementar os testes unitários de todo comportamento criado ou alterado
2. executar os testes diretamente relacionados durante o desenvolvimento
3. executar a suíte completa com `node --test` ao terminar a fase
4. corrigir todas as falhas; uma fase com teste falhando não pode ser encerrada
5. executar o critério de aceitação manual ou de integração indicado para a fase

Os testes usarão apenas `node:test` e `node:assert/strict`, sem instalar framework de testes. Dependências como Supabase, relógio e navegador devem ser simuladas ou injetadas nos testes unitários.

### Fase 0 — Fundação estática e testes

Objetivo: criar a menor base executável e estabelecer o gate de qualidade.

Estado: implementação local concluída, incluindo servidor estático, integração contínua e workflow de publicação sem build.

- inicializar o repositório Git
- criar `index.html`, CSS mobile first e o ponto de entrada `js/app.js`
- criar `package.json` apenas com metadados e `"type": "module"`, sem dependências ou scripts de build
- configurar `viewport`, estrutura de pastas e convenções
- criar `js/config.js` somente com configuração pública
- criar `tests/unit/` e o primeiro teste com o runner nativo do Node
- configurar integração contínua para executar `node --test`
- preparar a publicação estática no GitHub Pages, sem build

Testes da fase: carregamento e validação da configuração pública, resolução segura de caminhos e tipos de conteúdo do servidor estático local.

Critério de aceitação: a página abre localmente em 320 px sem rolagem horizontal, e a suíte completa passa.

### Fase 1 — Cliente Supabase e esquema inicial

Objetivo: preparar acesso a dados e estrutura persistente sem incluir autenticação visual.

Estado: concluída. As migrations `001`, `002`, `003` e `004` foram aplicadas e registradas no projeto Supabase remoto em 27/08/2026; as seis tabelas, o RLS, os privilégios, as constraints e os índices de chaves estrangeiras foram verificados. O navegador inicializa com a URL HTTPS e a chave moderna `sb_publishable_*` versionadas em `js/config.js`, protegidas por teste contra chave administrativa.

- encapsular a criação do cliente Supabase
- criar scripts SQL de tabelas, constraints e índices
- padronizar transformação de respostas e erros
- impedir uso de chaves administrativas

Testes da fase: configuração ausente ou inválida, criação do cliente e transformação de respostas usando mocks.

Critério de aceitação: cliente inicializa com a chave pública e o esquema pode ser aplicado ao projeto Supabase.

### Fase 2 — Autenticação e sessão

Objetivo: implementar exclusivamente o ciclo de autenticação.

Estado: implementação local concluída e cliente público conectado ao banco remoto. O teste com sessão real permanece pendente porque o projeto ainda não possui usuários de teste.

- login por e-mail e senha
- recuperação e observação de sessão
- logout
- mensagens de erro legíveis

Testes da fase: validação do formulário, estados de autenticação, erros e chamadas ao cliente simulado.

Critério de aceitação: usuário válido entra e mantém a sessão após recarregar; usuário deslogado não acessa a aplicação.

### Fase 3 — Household e RLS

Objetivo: estabelecer o isolamento de dados da casa.

Estado: implementação local concluída. As migrations e a estrutura de RLS foram validadas no banco remoto, com 18 policies, RLS nas seis tabelas e nenhum privilégio para `anon`. O cenário integrado permanece pendente até que os três usuários descritos em `supabase/RLS_TEST_PLAN.md` estejam disponíveis.

- buscar a household do usuário autenticado
- manter `householdId` no estado da aplicação
- ativar e configurar RLS em todas as tabelas
- validar `created_by` quando aplicável
- preparar usuários de teste de households iguais e diferentes

Testes da fase: seleção e validação da household com repositório simulado, verificação estática das policies e execução do roteiro de integração com usuários da mesma household e de households diferentes.

Critério de aceitação: testes de integração comprovam compartilhamento dentro da mesma household e negação fora dela.

### Fase 4 — Roteamento e shell mobile

Objetivo: entregar a navegação protegida e a estrutura visual comum.

Estado: implementação local concluída, com rotas protegidas, estados globais e navegação mobile first cobertos por testes automatizados.

- implementar roteamento nativo por hash
- criar cabeçalho compacto e navegação inferior
- criar sidebar como aprimoramento para telas maiores
- implementar rota inexistente, loading e erro global
- criar rotas de dashboard, financeiro, compras e configurações

Testes da fase: normalização, resolução e proteção de rotas.

Critério de aceitação: todas as rotas são operáveis por toque a partir de 320 px, sem zoom ou rolagem horizontal.

### Fase 5 — Estados comuns e dashboard estrutural

Objetivo: padronizar renderização antes dos módulos de negócio.

Estado: implementação local concluída, com componentes de feedback, confirmação nativa, cards mobile first e contrato normalizado para os resumos futuros.

- criar componentes funcionais de loading, erro, vazio e confirmação usando DOM nativo
- criar cards estruturais do dashboard
- definir contrato para carregar resumos financeiros e de compras
- garantir foco, labels, `aria-live` e feedback de ações

Testes da fase: seleção de estados de tela, mensagens e transformação dos dados de resumo.

Critério de aceitação: cada estado é legível e acessível no celular e a navegação permanece funcional.

### Fase 6 — Listas de compras

Objetivo: implementar apenas o gerenciamento das listas.

Estado: implementação local concluída, com listagem ativa, criação atribuída ao usuário, contagem de pendentes e rota protegida para abrir cada lista. A validação integrada depende da criação dos usuários de teste.

- listar listas ativas
- criar uma lista
- abrir uma lista pela rota `/#/compras/:listId`
- exibir quantidade de itens pendentes
- tratar loading, erro e estado vazio

Testes da fase: validação do nome, mapeamento de respostas, contagem de pendentes e serviço com cliente simulado.

Critério de aceitação: uma lista pode ser criada e aberta por toque no celular.

### Fase 7 — Inclusão e exibição de itens

Objetivo: entregar o fluxo rápido principal da lista de compras.

Estado: implementação local concluída, com inclusão rápida por toque ou Enter, detalhes opcionais, autoria, ordenação e sincronização imediata da contagem de pendentes. A validação integrada depende da criação dos usuários de teste.

- adicionar item por toque ou Enter
- validar nome, quantidade, unidade e observação
- exibir dados e autor do item
- ordenar pendentes antes dos concluídos
- manter o campo acessível com teclado virtual aberto

Testes da fase: validação, normalização, criação do payload e ordenação dos itens.

Critério de aceitação: adicionar um item exige poucos toques e atualiza a lista imediatamente.

### Fase 8 — Manutenção de itens

Objetivo: concluir o CRUD local e persistido dos itens.

Estado: implementação local concluída, com edição inline, marcação e desmarcação, metadados de compra atribuídos pelo banco, exclusão confirmada e ações mobile first protegidas contra toques concorrentes. A validação integrada depende da criação dos usuários de teste.

- editar item
- marcar e desmarcar como comprado
- preencher ou limpar `checked_by` e `checked_at` exclusivamente pelo trigger do banco; o cliente envia apenas `is_checked`
- excluir com confirmação
- impedir toques acidentais nas ações

Testes da fase: transições de estado, payloads de edição, confirmação e remoção.

Critério de aceitação: CRUD completo funciona no celular e mantém a ordenação especificada.

### Fase 9 — Realtime de compras

Objetivo: sincronizar a lista entre dispositivos.

Estado: implementação local concluída, com canais filtrados por lista, reconciliação segura e ordenada dos três tipos de evento, aviso não bloqueante em caso de falha e descarte da assinatura ao trocar de tela, lista, sessão ou página. A migration `003_shopping_items_realtime.sql` foi aplicada e a publicação Realtime com identidade completa foi verificada. A validação entre dois dispositivos depende dos usuários de teste.

- assinar `INSERT`, `UPDATE` e `DELETE`
- filtrar eventos pela lista ou household atual
- deduplicar e ordenar o estado após eventos
- cancelar a subscription ao sair da tela

Testes da fase: redução de cada tipo de evento, deduplicação, filtro e descarte da subscription usando mocks.

Critério de aceitação: dois dispositivos convergem para o mesmo estado sem recarregar a página.

### Fase 10 — Fundação do financeiro

Objetivo: preparar regras e consultas antes do CRUD.

Estado: implementação local concluída, com seletor mensal mobile first, navegação segura entre anos, intervalo semiaberto para consultas, categorias filtradas por household e tipo, datas sem deslocamento de fuso e valores representados em centavos inteiros. A tabela e as policies de categorias estão ativas no banco remoto; a validação funcional depende dos usuários de teste.

- carregar categorias por tipo
- selecionar e navegar entre meses
- montar o intervalo de datas da consulta
- normalizar moeda brasileira sem usar `float`
- formatar moeda e datas para exibição

Testes da fase: limites mensais, troca de ano, parsing e formatação monetária, datas e compatibilidade entre tipo e categoria.

Critério de aceitação: mês e categorias corretos são carregados sem exibir lançamentos fora do intervalo.

### Fase 11 — Cadastro e listagem financeira

Objetivo: criar e consultar receitas e despesas.

Estado: implementação local concluída, com cadastro persistente no Supabase, validação por tipo e mês, valores mantidos em centavos inteiros, lista cronológica em cards mobile e totais recalculados após cada inclusão. Categorias desativadas não podem receber novos lançamentos, mas continuam identificadas no histórico. As tabelas e policies financeiras estão ativas no banco remoto; a validação funcional depende dos usuários de teste.

- cadastrar lançamento
- validar descrição, valor, data e categoria
- exibir lista cronológica em cards mobile
- calcular receitas, despesas, saldo e quantidade
- tratar loading, erro e estado vazio

Testes da fase: validação, payload, ordenação e cálculos de totais.

Critério de aceitação: totais exibidos correspondem aos registros persistidos no mês selecionado.

### Fase 12 — Edição, exclusão e filtros financeiros

Objetivo: concluir o CRUD e a consulta do financeiro.

Estado: implementação local concluída, com edição inline de todos os campos, exclusão confirmada, filtros combinados por tipo e categoria e recálculo imediato da lista e dos indicadores. As mutações permanecem restritas à household atual e a validação funcional integrada depende dos usuários de teste.

- editar todos os campos e atualizar `updated_at`
- excluir com confirmação contextual
- filtrar por tipo e categoria
- recalcular indicadores após cada alteração

Testes da fase: payloads de edição, confirmação, filtros combinados e recálculo.

Critério de aceitação: edição, exclusão e filtros produzem lista e totais consistentes.

### Fase 13 — Dashboard, configurações e CSV

Objetivo: integrar os resumos e entregar a cópia dos dados.

Estado: implementação local concluída, com dashboard alimentado pelos lançamentos do mês corrente e pelas listas ativas, configurações exibindo household e conta, navegação mensal para exportação e CSV UTF-8 ordenado, escapado e protegido contra fórmulas. A validação integrada do conteúdo depende dos usuários de teste.

- preencher os cards do dashboard com dados reais
- exibir household e e-mail nas configurações
- disponibilizar logout nas configurações
- exportar o mês financeiro selecionado em CSV UTF-8

Testes da fase: agregação dos resumos, colunas, ordenação, formatação e escape do CSV.

Critério de aceitação: dashboard reflete os dados persistidos e o CSV baixado é legível e completo.

### Fase 14 — Hardening, aceitação e publicação

Objetivo: validar o MVP completo em condições reais de uso.

Estado: em andamento. Em 27/08/2026, a tela pública conectada ao Supabase foi validada em 320 px, 360 px e 430 px sem rolagem horizontal, com áreas de toque de pelo menos 44 px, campos adequados ao teclado virtual, foco e áreas seguras definidos no CSS e nenhum erro no console. O Security Advisor não apresentou alertas; a migration `004_persistence_hardening.sql` eliminou as recomendações de chaves estrangeiras sem índice e acrescentou constraints equivalentes aos limites do frontend. A suíte local aprovou 280 testes em 74 suites, sem falhas, itens ignorados ou pendentes; todos os módulos JavaScript passaram na verificação de sintaxe e o bootstrap real carregou o formulário de autenticação pelo cliente Supabase sem erros no console. O GitHub Pages atual ainda publica a revisão anterior, sem a configuração pública, e os cenários autenticados/RLS/Realtime entre usuários aguardam a criação das contas descritas em `supabase/RLS_TEST_PLAN.md`.

- testar os fluxos em 320 px, 360 px e 430 px
- validar teclado virtual, áreas seguras, foco, contraste e ausência de rolagem horizontal
- executar cenários de autenticação, RLS, compras, Realtime e financeiro
- revisar mensagens de erro e ausência de segredos
- executar a suíte completa novamente no workflow
- criar o commit final e enviá-lo para o repositório público `Wachholz` no GitHub
- publicar os arquivos estáticos no GitHub Pages
- repetir os testes essenciais no ambiente publicado

Testes da fase: regressões identificadas durante o hardening devem receber teste unitário antes da correção ser concluída.

Critério de aceitação: todos os itens da Definition of Done estão atendidos, a suíte completa passa e o MVP publicado funciona em celular real.

---

## 5. Estrutura sugerida de pastas

```text
index.html
├── .mcp.json                 # MCP limitado ao projeto Supabase de desenvolvimento
├── package.json              # somente metadados e `type: module`; sem dependências
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── pages.css
│
├── js/
│   ├── app.js
│   ├── config.js
│   ├── lib/
│   │   ├── public-config.js
│   │   ├── supabase-client.js
│   │   └── supabase-result.js
│   ├── auth/
│   │   ├── auth-service.js
│   │   ├── auth-view.js
│   │   └── session.js
│   ├── household/
│   │   ├── household-context.js
│   │   ├── household-service.js
│   │   └── household-view.js
│   ├── router/
│   │   ├── app-routes.js
│   │   └── hash-router.js
│   ├── shell/
│   │   └── app-shell-view.js
│   ├── ui/
│   │   ├── feedback.js
│   │   └── confirmation.js
│   └── modules/
│       ├── dashboard/
│       │   ├── dashboard-context.js
│       │   ├── dashboard-summary.js
│       │   └── dashboard-view.js
│       ├── finance/
│       │   ├── finance-context.js
│       │   ├── finance-view.js
│       │   ├── financial-summary.js
│       │   ├── services/
│       │   │   ├── financial-category-service.js
│       │   │   └── financial-transaction-service.js
│       │   └── utils/
│       │       ├── finance-money.js
│       │       └── finance-period.js
│       └── shopping/
│           ├── shopping-item-service.js
│           ├── shopping-items-context.js
│           ├── shopping-items-realtime.js
│           ├── shopping-items-view.js
│           ├── shopping-list-service.js
│           ├── shopping-lists-context.js
│           └── shopping-lists-view.js
│
├── assets/
├── scripts/
│   ├── serve.js
│   └── server-utils.js
├── supabase/
│   ├── README.md
│   ├── RLS_TEST_PLAN.md
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_household_rls.sql
│       └── 003_shopping_items_realtime.sql
├── tests/
│   └── unit/
│       ├── database-schema.test.js
│       ├── auth-service.test.js
│       ├── auth-session.test.js
│       ├── auth-view.test.js
│       ├── household-context.test.js
│       ├── household-rls.test.js
│       ├── household-service.test.js
│       ├── household-view.test.js
│       ├── app-routes.test.js
│       ├── app-shell-view.test.js
│       ├── confirmation.test.js
│       ├── dashboard-context.test.js
│       ├── dashboard-mobile.test.js
│       ├── dashboard-summary.test.js
│       ├── dashboard-view.test.js
│       ├── feedback.test.js
│       ├── finance-context.test.js
│       ├── finance-mobile.test.js
│       ├── finance-money.test.js
│       ├── finance-period.test.js
│       ├── finance-view.test.js
│       ├── financial-category-service.test.js
│       ├── financial-summary.test.js
│       ├── financial-transaction-service.test.js
│       ├── hash-router.test.js
│       ├── mobile-shell.test.js
│       ├── public-config.test.js
│       ├── static-foundation.test.js
│       ├── static-server.test.js
│       ├── shopping-list-service.test.js
│       ├── shopping-item-service.test.js
│       ├── shopping-items-context.test.js
│       ├── shopping-items-mobile.test.js
│       ├── shopping-items-realtime.test.js
│       ├── shopping-items-view.test.js
│       ├── shopping-lists-context.test.js
│       ├── shopping-lists-view.test.js
│       ├── shopping-mobile.test.js
│       ├── shopping-realtime-migration.test.js
│       ├── supabase-client.test.js
│       ├── supabase-mcp-config.test.js
│       └── supabase-result.test.js
└── .github/
    └── workflows/
        ├── tests.yml
        └── deploy-pages.yml
```

---

## 6. Estratégia de commits

Cada commit funcional deve incluir seus testes unitários. Não deixar os testes para um commit ou fase posterior.

Regra obrigatória de acompanhamento: após concluir cada fase e aprovar a suíte completa com `node --test`, criar um novo commit diretamente na branch `main` e enviá-lo ao repositório público `Wachholz` no GitHub. Nenhuma fase é considerada encerrada antes desse commit e push, permitindo acompanhar o progresso e a publicação do GitHub Pages pelo celular.

Sugestão de sequência alinhada às fases:

1. `chore: initialize static project and native test suite`
2. `feat: add supabase client and database schema with tests`
3. `feat: add authentication flow with tests`
4. `feat: add household context and rls policies with tests`
5. `feat: add protected hash router and mobile shell with tests`
6. `feat: add shared ui states and dashboard shell with tests`
7. `feat: add shopping lists with tests`
8. `feat: add shopping item creation and ordering with tests`
9. `feat: add shopping item maintenance with tests`
10. `feat: add shopping realtime reconciliation with tests`
11. `feat: add finance foundations with tests`
12. `feat: add financial entries and totals with tests`
13. `feat: add financial maintenance and filters with tests`
14. `feat: add dashboard integration and csv export with tests`
15. `chore: harden validate and publish mvp`

---

## 7. Ordem de desenvolvimento recomendada

Em cada etapa com interface, seguir esta ordem:

```text
Fluxo e conteúdo mobile
      ↓
Layout e interação por toque
      ↓
Validação em smartphone
      ↓
Adaptação para tablet e desktop
```

A ordem funcional do projeto é:

```text
Fase 0  — Fundação estática e testes
Fase 1  — Cliente Supabase e esquema
Fase 2  — Autenticação e sessão
Fase 3  — Household e RLS
Fase 4  — Roteamento e shell mobile
Fase 5  — Estados comuns e dashboard estrutural
Fase 6  — Listas de compras
Fase 7  — Inclusão e exibição de itens
Fase 8  — Manutenção de itens
Fase 9  — Realtime de compras
Fase 10 — Fundação do financeiro
Fase 11 — Cadastro e listagem financeira
Fase 12 — Edição, exclusão e filtros
Fase 13 — Dashboard, configurações e CSV
Fase 14 — Hardening, aceitação e publicação
```

Entre todas as linhas dessa sequência existe o mesmo gate: criar os testes da implementação e executar `node --test` por completo. A lista de compras deve ser concluída antes do financeiro para validar toda a arquitetura com um módulo menor.

---

## 8. Definição de pronto do MVP 0.1

O MVP será considerado concluído quando:

- [ ] aplicação estiver publicada no GitHub Pages
- [ ] autenticação estiver funcionando
- [ ] dois usuários puderem compartilhar a mesma household
- [x] banco estiver protegido por RLS
- [ ] dashboard estiver funcional
- [ ] lista de compras permitir CRUD completo
- [ ] lista de compras sincronizar entre dispositivos
- [ ] financeiro permitir CRUD de receitas e despesas
- [ ] categorias financeiras estiverem funcionais
- [ ] totais mensais estiverem corretos
- [x] toda implementação possuir testes unitários correspondentes
- [x] a suíte completa tiver sido executada e aprovada ao final de cada fase
- [ ] `node --test` passar no ambiente local e na integração contínua
- [ ] nenhum teste estiver ignorado ou marcado para execução exclusiva
- [ ] todos os fluxos funcionarem integralmente por toque no celular, a partir de 320 px e sem rolagem horizontal
- [ ] interface mobile ter sido validada prioritariamente entre 360 px e 430 px, inclusive com teclado virtual
- [ ] interface adaptar-se corretamente a tablet e desktop sem criar dependências exclusivas dessas telas
- [ ] exportação CSV estiver disponível
- [ ] nenhuma chave administrativa estiver exposta no frontend

---

## 9. Próxima versão

Após o MVP 0.1, iniciar o MVP 0.2 com:

1. contas financeiras
2. cartões
3. faturas
4. parcelamentos
5. recorrências
6. projeção financeira mensal
7. migração dos dados da planilha atual

A estrutura criada no MVP 0.1 deve permitir acrescentar esses recursos sem reescrever autenticação, household, navegação ou infraestrutura.
