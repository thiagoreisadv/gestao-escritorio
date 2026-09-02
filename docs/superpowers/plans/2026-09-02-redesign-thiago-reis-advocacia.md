# Redesign Thiago Reis Advocacia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the whole app from its current navy-blue identity to a dark, purple/neon-gradient identity ("Thiago Reis Advocacia"), keeping every existing screen's structure and behavior unchanged, and add two CSS-only progress rings to the Dashboard.

**Architecture:** The app already uses a semantic CSS custom-property system (`--bg-page`, `--bg-surface`, `--text-primary`, etc., plus brand tokens `--blue-900/700/500/100`) defined once in `:root` and redefined inside `:root[data-theme="dark"]` / a matching `@media (prefers-color-scheme: dark)` block, referenced by name throughout `css/style.css`. This redesign works almost entirely by **redefining the values of tokens that already exist**, under their existing names — every rule that already reads `var(--blue-500)` or `var(--bg-surface)` picks up the new palette automatically, with zero changes to that rule. The only new CSS is one new token (`--brand-gradient`) and the small, genuinely new Dashboard "donut ring" component. Rebranding (title, manifest, icon) is a separate, independent set of text/asset edits.

**Tech Stack:** Plain CSS custom properties, vanilla JS, inline SVG (favicon + `icons/icon.svg`), `manifest.json`. No build step, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-02-redesign-thiago-reis-advocacia.md](../specs/2026-09-02-redesign-thiago-reis-advocacia.md)

## Global Constraints

- No automated test framework in this repo. Verification is manual, via a local server (`python -m http.server 8080` from the project root, then open `http://localhost:8080`) and the Browser tool.
- This redesign must not change any screen's structure, navigation, or behavior — only colors/branding, plus the one new Dashboard widget the spec explicitly calls for.
- Status colors (`--red-600`, `--amber-600`, `--green-600`, and their `-100` tints) do **not** change — priority/status semantics (atrasado/urgente/ok) must keep reading the same way.
- Keep the existing light/dark/system theme toggle working exactly as it does today — only the color values change, not the mechanism.
- Follow existing code conventions: 2-space indent, no semicolons omitted, Portuguese (pt-BR) user-facing strings, `function` declarations in JS.

---

### Task 1: New color tokens (light + dark)

**Files:**
- Modify: `css/style.css:1-69` (the `:root` block, the `@media (prefers-color-scheme: dark)` block, and the `:root[data-theme="dark"]` block)
- Modify: `css/style.css` — the 9 scattered dark-mode override pairs (currently using 4 hardcoded hex values, listed below)
- Modify: `css/style.css` — `.topbar`'s gradient (one hardcoded hex value)

**Interfaces:**
- Produces: every existing rule that references `var(--blue-900)`, `var(--blue-700)`, `var(--blue-500)`, `var(--blue-100)`, `var(--bg-page)`, `var(--bg-surface)`, `var(--bg-surface-alt)`, `var(--bg-surface-alt-2)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border-color)`, `var(--border-soft)`, `var(--badge-neutral-bg)`, `var(--badge-neutral-text)` now renders in the new palette, with zero changes needed to those other rules (consumed automatically by Tasks 2 and 3, and by every existing view).

- [ ] **Step 1: Replace the light-theme `:root` token block**

In `css/style.css`, replace lines 1-36 (the whole `:root{...}` block) with:

```css
:root{
  --blue-900:#7e22ce;
  --blue-700:#9333ea;
  --blue-500:#c026d3;
  --blue-100:#f3e8ff;
  --gray-900:#1f2937;
  --gray-700:#4b5563;
  --gray-500:#6b7280;
  --gray-300:#d1d5db;
  --gray-100:#f3f4f6;
  --gray-50:#f9fafb;
  --white:#ffffff;
  --red-600:#dc2626;
  --red-100:#fee2e2;
  --amber-600:#b45309;
  --amber-100:#fef3c7;
  --green-600:#16a34a;
  --green-100:#dcfce7;
  --whatsapp:#25d366;
  --radius:14px;
  --shadow:0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md:0 8px 24px rgba(0,0,0,.14);
  --brand-gradient:linear-gradient(90deg, #f472b6, #a855f7 55%, #22d3ee);

  /* Tokens semânticos (tema claro) */
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
}
```

(Every raw value changed except `--gray-*`, `--red-*`, `--amber-*`, `--green-*`, `--whatsapp`, `--radius`, `--shadow`, `--shadow-md`, which are unchanged from the current file — per the Global Constraints, status colors stay put. `--brand-gradient` is the one new token, added here.)

- [ ] **Step 2: Replace the dark-theme token blocks**

Immediately after the block from Step 1, replace the existing `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){...} }` block and the existing `:root[data-theme="dark"]{...}` block (currently lines 38-69 of the original file) with:

```css
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
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
  }
}
:root[data-theme="dark"]{
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
}
```

(`--blue-900/700/500/100` are intentionally NOT redefined here — this matches the existing file's pattern exactly, where those 4 tokens hold one value shared by both themes, and only the specific elements needing extra dark-mode contrast get their own override rule, which is what Step 3 updates.)

- [ ] **Step 3: Update the 9 scattered dark-mode override pairs**

Search `css/style.css` for each of these 4 hardcoded hex values and replace every occurrence (there are 9 total, each hex value used 1-3 times — see the table below) with its listed replacement. Do not change anything else on these lines (selectors, property names, and surrounding rules stay exactly as they are):

| Find (hex) | Replace with |
|---|---|
| `#8fb8e8` | `#f0abfc` |
| `#20344d` | `#2e1150` |
| `#3a1f22` | `#4a1220` |
| `#1f3450` | `#3d1a5c` |

These appear in rules for: `.view-title`, `.summary-icon`, `.summary-card .summary-number`, `.item-card.overdue`, `.modal-header h3`, `.calendar-month-label`, `.calendar-day.today`, `.badge-tag`, `.client-detail-name` — each inside a `:root[data-theme="dark"] .selector{...}` rule and its matching `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .selector{...}}` rule. There are exactly 9 such pairs in the file (18 lines total); after this step, none of them should contain `#8fb8e8`, `#20344d`, `#3a1f22`, or `#1f3450` anywhere.

- [ ] **Step 4: Update the topbar's hardcoded gradient stop**

Find:
```css
.topbar{
  background:linear-gradient(135deg,var(--blue-900) 0%,#16304f 100%);
```

Replace with:
```css
.topbar{
  background:linear-gradient(135deg,var(--blue-900) 0%,#2e1065 100%);
```

(Only the hardcoded `#16304f` → `#2e1065` changes; `var(--blue-900)` already picks up the new value from Step 1 automatically.)

- [ ] **Step 5: Apply the gradient to the brand text**

Find:
```css
.brand{font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:.4rem;}
```

Replace with:
```css
.brand{font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:.4rem;background:var(--brand-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;}
```

- [ ] **Step 6: Manual verification**

Start the local server and open the app. Toggle through all three theme options (☀️ Claro / 🌙 Escuro / 🖥️ Automático, in "Dados e Backup" → Aparência). For each of the light and dark states, visit every view (Dashboard, Tarefas, Quadro, Calendário, Clientes, Orçamentos, Concluídas, Dados e Backup) and confirm:
- No unreadable text (no dark text on dark background, no light text on light background).
- The topbar shows a purple gradient (not navy blue).
- The brand text in the topbar (still reading its old name at this point — Task 2 renames it) shows the pink-to-cyan gradient text effect.
- Card borders, badges, buttons, and focus outlines all read as purple/magenta tones now, not blue.
- The four hardcoded-hex elements (view title, dashboard summary numbers, modal titles, calendar month label, "today" highlight, overdue task background, tag badges, client detail name) are legible in dark mode specifically.

Take a screenshot of the Dashboard in both light and dark mode for the record.

- [ ] **Step 7: Commit**

```bash
git add css/style.css
git commit -m "$(cat <<'EOF'
Substitui a paleta azul-marinho pela nova identidade roxo/neon

Redefine os tokens de cor já existentes (marca e tokens semânticos de
tema claro/escuro) para a nova paleta escura roxo/preto com acentos em
gradiente rosa-roxo-ciano, propagando a mudança para todo o app sem
alterar nenhuma outra regra CSS.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rebranding — title, manifest, icon

**Files:**
- Modify: `index.html:6-14` (theme-color meta, favicon data URI, apple-mobile-web-app-title, title)
- Modify: `index.html:24` (`.brand` text content)
- Modify: `manifest.json`
- Modify: `icons/icon.svg`

**Interfaces:**
- Produces: every user-facing and OS-facing occurrence of the app's name/icon is "Thiago Reis Advocacia" with the new gradient-monogram icon. No other task depends on this one.

- [ ] **Step 1: Update the theme-color meta tag**

Find:
```html
<meta name="theme-color" content="#1e3a5f">
```

Replace with:
```html
<meta name="theme-color" content="#170b28">
```

- [ ] **Step 2: Replace the inline favicon SVG**

Find:
```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231e3a5f'/%3E%3Ctext x='50' y='70' font-size='58' font-family='Arial, sans-serif' fill='white' text-anchor='middle'%3E%E2%9A%96%3C/text%3E%3C/svg%3E">
```

Replace with:
```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f472b6'/%3E%3Cstop offset='0.55' stop-color='%23a855f7'/%3E%3Cstop offset='1' stop-color='%2322d3ee'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='20' fill='url(%23g)'/%3E%3Ctext x='50' y='65' font-size='42' font-family='Arial, sans-serif' font-weight='700' fill='white' text-anchor='middle'%3ETR%3C/text%3E%3C/svg%3E">
```

- [ ] **Step 3: Update the apple-mobile-web-app-title meta tag**

Find:
```html
<meta name="apple-mobile-web-app-title" content="Gestão Escritório">
```

Replace with:
```html
<meta name="apple-mobile-web-app-title" content="Thiago Reis Advocacia">
```

- [ ] **Step 4: Update the page title**

Find:
```html
<title>Gestão de Tarefas — Escritório</title>
```

Replace with:
```html
<title>Thiago Reis Advocacia</title>
```

- [ ] **Step 5: Update the brand text in the topbar**

Find:
```html
    <span class="brand"><span class="brand-badge">⚖️</span> Gestão do Escritório</span>
```

Replace with:
```html
    <span class="brand"><span class="brand-badge">⚖️</span> Thiago Reis Advocacia</span>
```

- [ ] **Step 6: Update `manifest.json`**

Replace the file's full contents with:

```json
{
  "name": "Thiago Reis Advocacia",
  "short_name": "Thiago Reis Advocacia",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#170b28",
  "theme_color": "#170b28",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 7: Replace `icons/icon.svg`**

Replace the file's full contents with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f472b6"/>
      <stop offset="0.55" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="330" font-size="220" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">TR</text>
</svg>
```

- [ ] **Step 8: Manual verification**

Start the local server and open the app. Confirm the browser tab shows "Thiago Reis Advocacia" as the title and the new gradient "TR" icon as the favicon (zoom in on the tab if needed). Confirm the topbar shows "Thiago Reis Advocacia" (with the gradient text effect from Task 1). Open `icons/icon.svg` directly in the browser (`http://localhost:8080/icons/icon.svg`) and confirm it renders as a rounded square with a pink-to-cyan gradient and a white "TR" monogram, not the old scale emoji. Open `manifest.json` directly (`http://localhost:8080/manifest.json`) and confirm the JSON is valid (no trailing comma / syntax error) and contains the new name/colors.

- [ ] **Step 9: Commit**

```bash
git add index.html manifest.json icons/icon.svg
git commit -m "$(cat <<'EOF'
Rebranding para Thiago Reis Advocacia

Troca título da aba, nome do PWA, meta theme-color, favicon e ícone do
app (monograma "TR" em gradiente) em todo lugar onde a marca aparecia
como "Gestão do Escritório" / a balança ⚖️ sozinha.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dashboard progress rings

**Files:**
- Modify: `css/style.css` (new `.donut-grid`/`.donut-card`/`.donut-ring` rules, appended near the existing `.distribution-grid` rules)
- Modify: `index.html` (new markup inside `#view-dashboard`, between `.summary-grid` and `.distribution-grid`)
- Modify: `js/app.js` (`renderDashboard()`)

**Interfaces:**
- Consumes: the global `tasks`/`budgets` arrays (already populated by `init()`), the existing `renderDashboard()` function (already called from `renderAll()`).
- Produces: two new DOM ids, `donut-tasks` and `donut-budgets` (the ring elements) and `donut-tasks-label`/`donut-budgets-label` (the centered percentage text) — used only within this task.

- [ ] **Step 1: Add the donut CSS**

In `css/style.css`, find:

```css
.dist-legend .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:.35rem;}
```

Add this new block immediately after it:

```css

/* Anéis de progresso (Dashboard) */
.donut-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:.75rem;
  margin-top:1.25rem;
}
.donut-card{
  background:var(--bg-surface);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:1rem;
  display:flex;
  align-items:center;
  gap:.9rem;
}
.donut-ring{
  width:64px;
  height:64px;
  border-radius:50%;
  flex-shrink:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:conic-gradient(var(--ring-color, var(--blue-500)) calc(var(--pct, 0) * 1%), var(--bg-surface-alt-2) 0);
}
.donut-ring span{
  width:48px;
  height:48px;
  border-radius:50%;
  background:var(--bg-surface);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:.85rem;
  font-weight:800;
  color:var(--text-primary);
}
.donut-label{font-size:.85rem;font-weight:700;color:var(--text-secondary);}
```

- [ ] **Step 2: Add the donut markup to the Dashboard view**

In `index.html`, find:

```html
    <div class="summary-grid">
      <div class="summary-card summary-pending">
        <span class="summary-icon">✅</span>
        <span class="summary-number" id="sum-pending">0</span>
        <span class="summary-label">Tarefas pendentes</span>
      </div>
      <div class="summary-card summary-overdue">
        <span class="summary-icon">⏰</span>
        <span class="summary-number" id="sum-overdue">0</span>
        <span class="summary-label">Tarefas atrasadas</span>
      </div>
      <div class="summary-card summary-waiting">
        <span class="summary-icon">📁</span>
        <span class="summary-number" id="sum-waiting">0</span>
        <span class="summary-label">Orçamentos aguardando</span>
      </div>
      <div class="summary-card summary-incomplete">
        <span class="summary-icon">📄</span>
        <span class="summary-number" id="sum-incomplete">0</span>
        <span class="summary-label">Checklists incompletas</span>
      </div>
    </div>

    <div class="distribution-grid">
```

Replace with (only the new `.donut-grid` block is inserted between the two existing divs — nothing else in this snippet changes):

```html
    <div class="summary-grid">
      <div class="summary-card summary-pending">
        <span class="summary-icon">✅</span>
        <span class="summary-number" id="sum-pending">0</span>
        <span class="summary-label">Tarefas pendentes</span>
      </div>
      <div class="summary-card summary-overdue">
        <span class="summary-icon">⏰</span>
        <span class="summary-number" id="sum-overdue">0</span>
        <span class="summary-label">Tarefas atrasadas</span>
      </div>
      <div class="summary-card summary-waiting">
        <span class="summary-icon">📁</span>
        <span class="summary-number" id="sum-waiting">0</span>
        <span class="summary-label">Orçamentos aguardando</span>
      </div>
      <div class="summary-card summary-incomplete">
        <span class="summary-icon">📄</span>
        <span class="summary-number" id="sum-incomplete">0</span>
        <span class="summary-label">Checklists incompletas</span>
      </div>
    </div>

    <div class="donut-grid">
      <div class="donut-card">
        <div class="donut-ring" id="donut-tasks"><span id="donut-tasks-label">0%</span></div>
        <span class="donut-label">Tarefas concluídas</span>
      </div>
      <div class="donut-card">
        <div class="donut-ring" id="donut-budgets"><span id="donut-budgets-label">0%</span></div>
        <span class="donut-label">Orçamentos aceitos</span>
      </div>
    </div>

    <div class="distribution-grid">
```

- [ ] **Step 3: Render the rings' percentages in `renderDashboard()`**

In `js/app.js`, find the end of `renderDashboard()` — specifically this line near the end of the function:

```js
  renderDistributions();
}
```

Replace with:

```js
  renderDonuts();
  renderDistributions();
}

function renderDonutRing(ringId, labelId, pct, ringColor) {
  const ring = document.getElementById(ringId);
  const label = document.getElementById(labelId);
  ring.style.setProperty('--pct', pct);
  ring.style.setProperty('--ring-color', ringColor);
  label.textContent = `${pct}%`;
}

function renderDonuts() {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'concluida').length;
  const tasksPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  renderDonutRing('donut-tasks', 'donut-tasks-label', tasksPct, 'var(--blue-500)');

  const totalBudgets = budgets.length;
  const acceptedBudgets = budgets.filter((b) => b.status === 'aceito').length;
  const budgetsPct = totalBudgets > 0 ? Math.round((acceptedBudgets / totalBudgets) * 100) : 0;
  renderDonutRing('donut-budgets', 'donut-budgets-label', budgetsPct, '#22d3ee');
}
```

- [ ] **Step 4: Manual verification**

Start the local server and open the app with a fresh `localStorage` (clear it via devtools first). Visit the Dashboard — expected: both rings show "0%" with no visible fill (since there's no data). Create 2 tasks via the UI, mark 1 as concluded (check its checkbox) — expected: the "Tarefas concluídas" ring updates to "50%" with a half-filled ring in the ring color. Create 2 orçamentos, set 1 to "Aceito" via its status dropdown — expected: the "Orçamentos aceitos" ring shows "50%" in cyan. Toggle dark mode and confirm both rings' background track (the unfilled portion) is visible against the dark card background (not the same color as the card, per `var(--bg-surface-alt-2)`).

- [ ] **Step 5: Commit**

```bash
git add css/style.css index.html js/app.js
git commit -m "$(cat <<'EOF'
Adiciona anéis de progresso ao Dashboard

Dois indicadores em CSS puro (conic-gradient): % de tarefas concluídas e
% de orçamentos aceitos, sem biblioteca de gráficos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full visual QA pass

**Files:** none (verification-only task; no code changes)

**Interfaces:** none.

- [ ] **Step 1: Run the spec's full verification checklist**

Start the local server with a fresh `localStorage` (clear it via devtools first) and open the app. Seed a small amount of representative data through the UI (2-3 tasks of different priorities/statuses, 1-2 orçamentos, 1 client) so every view has something to render. Then, for BOTH light and dark theme (via "Dados e Backup" → Aparência → ☀️ Claro / 🌙 Escuro):

1. Visit every view in the top nav — Dashboard, Tarefas, Quadro, Calendário, Clientes, Orçamentos, Concluídas, Dados e Backup — and confirm no text is unreadable (dark-on-dark or light-on-light), no leftover navy-blue colors remain anywhere, and every card/badge/button reads as part of the new purple/neon palette.
2. On the Dashboard, confirm both progress rings render with the correct color (purple for tasks, cyan for orçamentos) and correct percentage text.
3. Open every modal at least once (Nova Tarefa, Novo Orçamento, Novo Cliente, a task's checklist/subtasks, the message generator, the search modal) and confirm they're legible and styled consistently with the rest of the app.
4. Confirm the calendar's "today" highlight and priority dots are visible and distinguishable from each other in both themes.
5. Confirm the browser tab title and favicon show "Thiago Reis Advocacia" / the new "TR" icon.
6. Using the Browser tool's `resize_window`, check the Dashboard and the Clientes list+detail view at mobile width in both themes — confirm nothing is cut off or illegible at narrow width.
7. Check the browser console for errors throughout.

Fix anything that doesn't match before proceeding — if a fix is needed, make it directly (this task has no dedicated "implementation" step because none should be needed if Tasks 1-3 were done correctly; any fix here is a QA-discovered gap, same as the equivalent final task in the Clientes plan).

- [ ] **Step 2: Commit (only if a fix was needed)**

If Step 1 required no fixes, skip this step — there is nothing to commit. If a fix was needed, commit it with a message describing exactly what was wrong and what changed, e.g.:

```bash
git add <changed files>
git commit -m "$(cat <<'EOF'
Corrige <describe the specific gap found during QA>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
