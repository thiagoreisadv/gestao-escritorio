# Redesign visual "Thiago Reis Advocacia" — Design

Status: aprovado pelo usuário em 2026-09-02

## Contexto

O app "Gestão do Escritório" tem hoje uma identidade visual azul-marinho
(`#1e3a5f`), clara por padrão com um alternador claro/escuro/automático já
funcional, controlada por um sistema de tokens CSS semânticos em
`css/style.css` (`--bg-page`, `--bg-surface`, `--text-primary`, etc.,
redefinidos dentro de `:root[data-theme="dark"]` e de um
`@media (prefers-color-scheme: dark)`). O usuário pediu um visual inspirado
em um dashboard SaaS escuro roxo/neon (referência: captura de tela
compartilhada na conversa) e o rebranding do app para "Thiago Reis
Advocacia".

## Objetivo

Substituir a identidade visual atual (azul-marinho) por uma nova, escura
por padrão, em tons de roxo/preto com acentos em gradiente
rosa→roxo→ciano, mantendo o alternador claro/escuro/automático (agora nas
cores da nova identidade, não mais azul), adicionar elementos de dashboard
no estilo "anel de progresso" (donut), e trocar a marca do app inteira
(título, nome do PWA, ícone) para "Thiago Reis Advocacia".

## Escopo

- **Repintar** todas as telas existentes (Dashboard, Tarefas, Quadro,
  Calendário, Clientes, Orçamentos, Concluídas, Dados/Backup) com a nova
  paleta — sem alterar a estrutura/funcionalidade de nenhuma tela.
- **Adicionar** ao Dashboard dois indicadores em formato de anel
  (donut) — % de tarefas concluídas e % de orçamentos aceitos — mantendo
  os cards de resumo e as barras de distribuição já existentes (só
  recoloridas).
- **Rebranding**: título da aba, nome do PWA (`manifest.json`), ícone do
  app (favicon, apple-touch-icon, ícones do manifest) e o texto no topo do
  app.
- **Fora de escopo**: qualquer mudança de estrutura de navegação, de
  funcionalidade, ou nas telas do módulo de Clientes além da repintura de
  cores (a estrutura entregue na feature anterior não muda).

## Paleta

O app já usa tokens semânticos (`--bg-page`, `--bg-surface`,
`--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`,
`--border-soft`, `--badge-neutral-bg`, `--badge-neutral-text`) e tokens de
marca (`--blue-900`, `--blue-700`, `--blue-500`, `--blue-100`) reutilizados
em dezenas de lugares (títulos, botões, badges, foco, calendário). A
estratégia é **redefinir os valores desses tokens já existentes**, mantendo
os mesmos nomes de variável — isso propaga a nova paleta a todo o app sem
precisar tocar em cada seletor individualmente. Cores de status
(`--red-600`/`--amber-600`/`--green-600`, usadas em prioridade e status de
orçamento) **não mudam** — continuam vermelho/âmbar/verde para não quebrar
a leitura semântica de "atrasado/urgente/ok".

### Tema claro (`:root`)

```css
--blue-900:#7e22ce;   /* títulos, texto de marca */
--blue-700:#9333ea;   /* hover/ativo, foco */
--blue-500:#c026d3;   /* acento padrão, borda de card, links */
--blue-100:#f3e8ff;   /* fundo de ícone, badges */

--bg-page:#faf5ff;
--bg-surface:#ffffff;
--bg-surface-alt:#f6edff;
--bg-surface-alt-2:#ede0fb;
--text-primary:#1e1033;
--text-secondary:#4b3566;
--text-muted:#7c6a94;
--border-color:#ddc9f5;
--border-soft:#efe3fb;
--badge-neutral-bg:#ede0fb;
--badge-neutral-text:#4b3566;
```

### Tema escuro (`:root[data-theme="dark"]` e o bloco `@media` equivalente)

```css
--bg-page:#0d0616;
--bg-surface:#170b28;
--bg-surface-alt:#1f0f38;
--bg-surface-alt-2:#2a1547;
--text-primary:#f3e8ff;
--text-secondary:#d6b8f0;
--text-muted:#9b7fc4;
--border-color:#3d2a66;
--border-soft:#2a1a45;
--badge-neutral-bg:#2a1547;
--badge-neutral-text:#d6b8f0;
--shadow:0 1px 3px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4);
--shadow-md:0 8px 28px rgba(168,85,247,.25);
```

(`--blue-900/700/500/100` **não** são redefinidos dentro do bloco escuro —
seguem o padrão já existente no arquivo, em que esses 4 tokens têm um valor
único usado nos dois temas, e os poucos elementos que precisam de mais
contraste no escuro usam uma sobrescrita específica, como já acontece
hoje.)

### Sobrescritas específicas do tema escuro (já existem 9 pares no arquivo — só trocar os valores)

Hoje há ~9 pares de regras (`:root[data-theme="dark"] .seletor{...}` +
equivalente em `@media (prefers-color-scheme: dark)`) que fixam cores para
contraste em elementos específicos (título de view, número do dashboard,
título de modal, mês do calendário, badge de etiqueta, dia "hoje" do
calendário, fundo de tarefa atrasada, nome do cliente no detalhe). Todas
usam hoje um de 4 valores hexadecimais fixos — trocar cada um pelo seu
equivalente novo, mantendo a mesma estrutura de regras:

| Valor atual | Usado em (resumo) | Novo valor |
|---|---|---|
| `#8fb8e8` | título de view, número do resumo, título de modal, mês do calendário, texto do badge de etiqueta, nome do cliente | `#f0abfc` |
| `#20344d` | fundo do ícone de resumo, fundo do badge de etiqueta | `#2e1150` |
| `#3a1f22` | fundo de tarefa atrasada | `#4a1220` |
| `#1f3450` | fundo do dia "hoje" no calendário | `#3d1a5c` |

### Gradiente de marca

Novo token, usado só na logo do topo (texto "Thiago Reis Advocacia") para
reproduzir o efeito rosa→roxo→ciano da referência, sem alterar o gradiente
de 2 cores já usado em botões/topbar/FAB (que já fica roxo/magenta
automaticamente ao redefinir `--blue-500`/`--blue-700` acima):

```css
--brand-gradient: linear-gradient(90deg, #f472b6, #a855f7 55%, #22d3ee);
```

Aplicado via `background:var(--brand-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;` na classe `.brand`.

### Ajustes pontuais fora do sistema de tokens

- `.topbar`'s gradiente hoje é `linear-gradient(135deg,var(--blue-900) 0%,#16304f 100%)` — o segundo stop é um hex fixo, não um token; trocar para `#2e1065` (roxo escuro) para acompanhar a nova paleta.
- `theme-color` (meta tag) e `background_color`/`theme_color` do `manifest.json`: trocar de `#1e3a5f` para `#170b28` (roxo escuro, casa com `--bg-surface` do tema escuro).

## Novo componente: anéis de progresso no Dashboard

Dois anéis (CSS puro, `conic-gradient`, sem biblioteca de gráficos),
adicionados numa nova seção "Progresso geral" entre os cards de resumo e as
barras de distribuição já existentes:

- **Tarefas concluídas**: % de `tasks` com `status === 'concluida'` sobre o
  total de tarefas.
- **Orçamentos aceitos**: % de `budgets` com `status === 'aceito'` sobre o
  total de orçamentos.

Cada anel é uma `div` com uma custom property `--pct` (0–100) setada via
JS, `background: conic-gradient(var(--ring-color) calc(var(--pct) * 1%),
var(--bg-surface-alt-2) 0)`, com o número centralizado dentro (mesmo padrão
visual dos círculos vistos na tela de referência). Cor do anel de tarefas:
`--blue-500` (roxo/magenta); cor do anel de orçamentos: um ciano fixo
(`#22d3ee`) para reforçar a paleta de 3 cores. Cai para "Sem dados ainda."
(mesmo texto já usado nas barras de distribuição) quando o total é zero,
evitando divisão por zero.

## Ícone e marca

- Novo `icons/icon.svg`: quadrado arredondado com fundo em
  `--brand-gradient` (rosa→roxo→ciano) e o monograma "TR" em branco,
  substituindo a balança (⚖️) atual.
- Favicon inline (`<link rel="icon" href="data:image/svg+xml,...">` em
  `index.html`) atualizado para o mesmo desenho (fundo gradiente + "TR").
- `index.html`: `<title>`, `<meta name="apple-mobile-web-app-title">` e o
  texto dentro de `.brand` trocam de "Gestão de Tarefas — Escritório" /
  "Gestão Escritório" / "Gestão do Escritório" para "Thiago Reis
  Advocacia" (mantendo o emoji/ícone à esquerda do texto, agora como parte
  do gradiente).
- `manifest.json`: `name` e `short_name` trocam para "Thiago Reis
  Advocacia" (nome completo em ambos, já que não há limite de caracteres
  crítico aqui).

## Fora de escopo

- Qualquer mudança na estrutura de dados, navegação ou lógica das telas.
- Um seletor de "tema" adicional (a substituição é total — claro/escuro
  continuam existindo, só que agora na paleta nova).
- Gráficos com biblioteca externa — os anéis são CSS puro.

## Testes / verificação

- Testar manualmente: alternar claro/escuro/automático em todas as telas,
  conferir contraste de texto em ambos os temas, conferir que os anéis do
  Dashboard mostram os percentuais corretos (inclusive com 0 tarefas/0
  orçamentos), conferir favicon/ícone do PWA/título da aba, e checar que
  nenhuma tela ficou ilegível (texto sobre texto, contraste ruim) em nenhum
  dos dois temas.
- Testar responsividade: desktop e celular, sem alterar layout, só cores.
