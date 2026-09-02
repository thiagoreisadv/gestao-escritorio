# Módulo de Gestão de Clientes — Design

Status: aprovado pelo usuário em 2026-09-02

## Contexto

O app "Gestão do Escritório" (localStorage + sincronização opcional via
Firebase) tem hoje um campo de texto livre "cliente" em Tarefas
(`task.client`) e Orçamentos (`budget.clientName`). Não existe cadastro de
cliente nem histórico consolidado por cliente. Este design adiciona um
módulo de Gestão de Clientes inspirado (conceitualmente, não em código) em
funcionalidades da plataforma comercial Tramitação Inteligente, adaptado à
arquitetura simples e client-side deste app.

## Objetivo

Permitir cadastrar clientes com dados de contato, vincular tarefas e
orçamentos a um cliente específico (em vez de texto solto), e ver o
histórico de cada cliente em um só lugar — mantendo a experiência atual
(rápida, sem backend próprio, funcionando offline com sync opcional).

## Modelo de dados

Nova entidade `client`, persistida em `localStorage` na chave `lex_clients`
e incluída na sincronização Firebase e no backup/restore, junto de tasks,
budgets e trash.

```js
{
  id: string,
  nome: string,           // obrigatório
  telefone: string,
  email: string,
  cpfCnpj: string,
  endereco: string,
  observacoes: string,
  tags: string[],         // ex: "Pessoa física", "Empresa", categorias livres
  createdAt: string       // ISO
}
```

`task.client` (string) e `budget.clientName` (string) são substituídos, na
prática, por `task.clientId` / `budget.clientId` (referência a `client.id`).
Os campos de texto antigos deixam de ser a fonte de verdade, mas o nome
do cliente continua acessível via lookup — não é necessário manter os
dois em sincronia manualmente.

## Migração automática

Na primeira carga do app após esta atualização (guarda de versão em
storage, ex.: uma flag `lex_clients_migrated`):

1. Coletar todos os valores não vazios de `task.client` e
   `budget.clientName` existentes.
2. Para cada nome único, criar um registro `client` com `nome` = esse
   texto e os demais campos vazios.
3. Setar `task.clientId` / `budget.clientId` apontando para o cliente
   criado, casando por nome (comparação case-insensitive, trim).
4. Rodar uma única vez; persistir a flag para não repetir a migração.

Isso deve ser implementado em `storage.js` (ou um novo `migrate` chamado
na inicialização do `app.js`), antes de qualquer render.

## Telas e fluxo

### Navegação
Novo item **Clientes** no menu principal, entre Calendário e Orçamentos:
`Dashboard | Tarefas | Quadro | Calendário | Clientes | Orçamentos | Concluídas`.

### Lista de clientes
- Estilo de card aprovado: **avatar circular com iniciais** (cor
  determinada de forma determinística a partir do id/nome, reaproveitando
  a paleta de cores já usada no app — azul, âmbar, verde, vermelho —,
  nome em destaque, linha de metadados (telefone/email + tag de
  categoria) e um contador à direita (nº de tarefas/orçamentos vinculados).
- Busca por nome no topo (mesmo padrão do filtro de orçamentos).
- Botão "+ Novo cliente".

### Layout responsivo (lista + detalhe)
- **Desktop**: lista à esquerda (largura fixa, ~230px) e painel de
  detalhe à direita, mesma tela — clicar num cliente atualiza o painel
  sem navegar.
- **Celular**: a lista ocupa a tela toda; tocar num cliente abre o
  detalhe em tela cheia com botão "voltar", mesmo padrão que a tela de
  checklist de Orçamento já usa hoje.

### Painel/tela de detalhe do cliente
- Cabeçalho com avatar grande, nome, categoria.
- Dados de contato (telefone, e-mail, CPF/CNPJ, endereço) — só exibe os
  campos preenchidos.
- Observações (texto livre).
- Seção "Histórico": lista de tarefas e orçamentos vinculados a esse
  cliente (cards compactos, com borda colorida igual ao padrão atual de
  prioridade/status), cada um clicável para abrir o item original.
- Ações: editar cliente, excluir (vai para a lixeira).

### Formulário de cliente (novo/editar)
Campos, na ordem: Nome* → Telefone → E-mail → CPF/CNPJ → Endereço →
Categoria (tags, com chips selecionáveis + opção de criar uma nova tag) →
Observações. Botão "Salvar cliente".

### Campo de cliente em Tarefa/Orçamento
O input de texto livre atual vira um **combobox com autocomplete**:
- Ao digitar, mostra clientes existentes cujo nome combina (com
  avatarzinho, mesmo estilo da lista).
- Sempre aparece uma opção "＋ Criar cliente <texto digitado>" ao final
  da lista de sugestões, permitindo cadastrar um cliente novo sem sair
  do formulário de tarefa/orçamento.
- Selecionar uma sugestão ou criar um novo cliente preenche
  `clientId` no objeto sendo salvo.

## Exclusão (lixeira)

Segue o padrão já existente em `app.js` (`moveTaskToTrash` /
`moveBudgetToTrash`, array `trash` com `{id, type, data, deletedAt}`):
novo tipo `'client'`. Restaurar um cliente da lixeira não restaura
automaticamente o vínculo em tarefas/orçamentos que tenham sido
alterados nesse meio tempo — apenas o registro do cliente volta a
existir.

Tarefas/orçamentos com `clientId` apontando para um cliente inexistente
(excluído definitivamente) devem exibir um estado neutro ("Cliente
removido") em vez de quebrar a renderização.

## Backup e sincronização

- `storage.js`: `STORAGE_KEYS.CLIENTS = 'lex_clients'`, `loadClients`,
  `saveClients`; incluir `clients` em `buildBackupPayload`,
  `exportData` (já usa `buildBackupPayload`) e `importDataFromFile`.
- `persist()`: incluir `STORAGE_KEYS.CLIENTS` na lista de chaves que
  disparam `syncNotifyLocalChange`.
- `sync.js`: incluir `clients` no payload sincronizado com o Firebase,
  junto de tasks/budgets/trash.

## Fora de escopo (não incluído nesta iteração)

- Módulo financeiro e notas/lembretes (frentes separadas, a brainstormar
  depois).
- Qualquer recurso de IA, assinatura digital, e-mail exclusivo, etc. da
  plataforma comercial referenciada — não fazem sentido para um app
  client-side sem backend.
- Importação de contatos de fontes externas.

## Testes / verificação

- Testar manualmente: criar cliente, vincular em tarefa nova, vincular
  em orçamento, editar cliente e ver refletido no histórico, excluir e
  restaurar cliente pela lixeira, exportar/importar backup contendo
  clientes, sincronizar entre duas abas/dispositivos via Firebase.
- Testar migração automática com dados de exemplo (tarefas/orçamentos
  com nomes de cliente repetidos e variando maiúsculas/minúsculas) para
  confirmar que não duplica clientes.
- Testar responsividade: tela de Clientes no mobile (viewport estreito)
  e no desktop.
