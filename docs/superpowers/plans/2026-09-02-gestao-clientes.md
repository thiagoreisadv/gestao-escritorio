# Gestão de Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Clientes module to the office management app: a client record (contact info, tags, notes), a responsive list+detail screen, and an autocomplete "cliente" field on Tarefas/Orçamentos that links to a real client instead of free text.

**Architecture:** New `clients` array persisted the same way as `tasks`/`budgets` (`storage.js`: `loadClients`/`saveClients`, included in backup and Firebase sync). A one-time migration turns existing free-text `task.client` / `budget.clientName` values into real client records and links them via new `task.clientId` / `budget.clientId` fields. `task.client` and `budget.clientName` are **kept** as denormalized display-name caches (refreshed whenever the linked client is renamed via `propagateClientNameChange`) so every existing render function (task cards, board, calendar, search, message templates, trash) keeps working unmodified — only the edit forms and the new Clientes screen need new code. A new `js/clients.js` file holds all client-specific rendering/CRUD/autocomplete logic; `app.js` keeps owning top-level state (`clients` array) and wires the new view/modal into its existing `init()`/`renderAll()` flow, matching how `tasks`/`budgets` already work.

**Tech Stack:** Vanilla JS (no framework, no bundler, no test runner), `localStorage`, optional Firebase Firestore sync (`firebase-compat` SDKs already loaded via CDN in `index.html`).

**Spec:** [docs/superpowers/specs/2026-09-02-gestao-clientes-design.md](../specs/2026-09-02-gestao-clientes-design.md)

## Global Constraints

- No automated test framework exists in this repo (static HTML/CSS/JS, no `package.json`). Every task's "test" step is a manual browser check, not an automated one — this matches the project's existing testing approach (see the spec's "Testes / verificação" section).
- To run the app locally for verification: from the project root, run `python -m http.server 8080`, then open `http://localhost:8080` (via the Browser tool's `preview_start` with that URL, or a real browser). Do this once at the start of a work session and reload after each task's changes — do not open `index.html` directly via `file://`, since some browsers restrict `localStorage` there.
- Follow existing code conventions exactly: 2-space indent, `function` declarations (not arrow functions) for top-level handlers, `escapeHtml()` on every piece of user data interpolated into HTML strings, `uid()` for new ids, Portuguese (pt-BR) for all user-facing strings and code comments are rare (only where genuinely non-obvious).
- Every new/changed `localStorage`-backed array must go through `persist()` in `storage.js` so it participates in the existing storage-alert and sync-notify behavior.
- Script load order in `index.html` is: `utils.js`, `storage.js`, `messages.js`, `clients.js`, `sync.js`, `app.js`. `clients.js` is new — insert its `<script>` tag between `messages.js` and `sync.js`.

---

### Task 1: Client storage layer + backup integration

**Files:**
- Modify: `js/storage.js`

**Interfaces:**
- Produces: `STORAGE_KEYS.CLIENTS` (string `'lex_clients'`), `STORAGE_KEYS.CLIENTS_MIGRATED` (string `'lex_clients_migrated'`), `loadClients(): Array`, `saveClients(clients: Array): boolean` — used by every later task that touches client data.
- Modifies existing: `buildBackupPayload()` now also returns `clients`; `importDataFromFile()` now also restores `clients`; `persist()` now also triggers sync-notify for the clients key.

- [ ] **Step 1: Add the storage key and load/save functions**

In `js/storage.js`, update the `STORAGE_KEYS` object (top of file) to:

```js
const STORAGE_KEYS = {
  TASKS: 'lex_tasks',
  BUDGETS: 'lex_budgets',
  CLIENTS: 'lex_clients',
  CLIENTS_MIGRATED: 'lex_clients_migrated',
  TRASH: 'lex_trash',
  LAST_EXPORT: 'lex_last_export',
  THEME: 'lex_theme'
};
```

Add `loadClients` and `saveClients` right after `loadBudgets`/`saveBudgets`:

```js
function loadClients() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.CLIENTS), []);
}

function saveClients(clients) {
  return persist(STORAGE_KEYS.CLIENTS, clients);
}
```

- [ ] **Step 2: Include clients in the sync-notify check inside `persist()`**

Find this line in `persist()`:

```js
    if (key !== STORAGE_KEYS.TASKS && key !== STORAGE_KEYS.BUDGETS && key !== STORAGE_KEYS.TRASH) return true;
```

Replace it with:

```js
    if (key !== STORAGE_KEYS.TASKS && key !== STORAGE_KEYS.BUDGETS && key !== STORAGE_KEYS.TRASH && key !== STORAGE_KEYS.CLIENTS) return true;
```

- [ ] **Step 3: Include clients in backup export**

In `buildBackupPayload()`, change:

```js
function buildBackupPayload() {
  return {
    exportedAt: new Date().toISOString(),
    tasks: loadTasks(),
    budgets: loadBudgets(),
    trash: loadTrash()
  };
}
```

to:

```js
function buildBackupPayload() {
  return {
    exportedAt: new Date().toISOString(),
    tasks: loadTasks(),
    budgets: loadBudgets(),
    clients: loadClients(),
    trash: loadTrash()
  };
}
```

- [ ] **Step 4: Include clients in backup import**

In `importDataFromFile()`, change the validity check:

```js
      if (!data || (!Array.isArray(data.tasks) && !Array.isArray(data.budgets))) {
```

to:

```js
      if (!data || (!Array.isArray(data.tasks) && !Array.isArray(data.budgets) && !Array.isArray(data.clients))) {
```

and add a line alongside the existing `if (Array.isArray(data.budgets)) saveBudgets(data.budgets);`:

```js
      if (Array.isArray(data.clients)) saveClients(data.clients);
```

- [ ] **Step 5: Manual verification**

Start the local server and open the app (see Global Constraints). Open the browser devtools console and run:

```js
saveClients([{ id: 'c1', nome: 'Teste', telefone: '', email: '', cpfCnpj: '', endereco: '', observacoes: '', tags: [], createdAt: new Date().toISOString() }]);
loadClients();
```

Expected: the second call returns an array with the one client object. Then click "⬇️ Exportar backup (.json)" in the Dados/Backup screen, open the downloaded file, and confirm it contains a top-level `"clients"` array with that record.

- [ ] **Step 6: Commit**

```bash
git add js/storage.js
git commit -m "$(cat <<'EOF'
Adiciona camada de armazenamento para clientes

Inclui clients no backup/restore e na notificação de sincronização,
seguindo o mesmo padrão já usado para tasks e budgets.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Automatic migration from free-text client fields

**Files:**
- Modify: `js/storage.js`
- Modify: `js/app.js:11-33` (the `init()` function)

**Interfaces:**
- Consumes: `STORAGE_KEYS.CLIENTS_MIGRATED`, `uid()` (from `utils.js`), the `tasks`/`budgets`/`clients` state declared in `app.js`.
- Produces: `migrateClientsFromLegacyText(tasksArr, budgetsArr, clientsArr): {tasks, budgets, clients, changed}` — a pure-ish function other tasks don't need to call directly (only `init()` calls it), but every later task can assume `task.clientId` / `budget.clientId` are always populated once the app has loaded at least once.

- [ ] **Step 1: Add the migration function to `storage.js`**

Append this function to `js/storage.js` (after `importDataFromFile`):

```js
function migrateClientsFromLegacyText(tasksArr, budgetsArr, clientsArr) {
  if (localStorage.getItem(STORAGE_KEYS.CLIENTS_MIGRATED) === '1') {
    return { tasks: tasksArr, budgets: budgetsArr, clients: clientsArr, changed: false };
  }

  const nameToId = new Map();
  clientsArr.forEach((c) => nameToId.set(c.nome.trim().toLowerCase(), c.id));

  function resolveClient(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return '';
    const key = trimmed.toLowerCase();
    if (nameToId.has(key)) return nameToId.get(key);
    const client = {
      id: uid(),
      nome: trimmed,
      telefone: '',
      email: '',
      cpfCnpj: '',
      endereco: '',
      observacoes: '',
      tags: [],
      createdAt: new Date().toISOString()
    };
    clientsArr.push(client);
    nameToId.set(key, client.id);
    return client.id;
  }

  let changed = false;
  tasksArr.forEach((t) => {
    if (!t.clientId) {
      t.clientId = resolveClient(t.client);
      changed = true;
    }
  });
  budgetsArr.forEach((b) => {
    if (!b.clientId) {
      b.clientId = resolveClient(b.clientName);
      changed = true;
    }
  });

  localStorage.setItem(STORAGE_KEYS.CLIENTS_MIGRATED, '1');
  return { tasks: tasksArr, budgets: budgetsArr, clients: clientsArr, changed };
}
```

- [ ] **Step 2: Wire the migration into `init()`**

In `js/app.js`, `init()` currently starts:

```js
function init() {
  tasks = loadTasks();
  budgets = loadBudgets();
  trash = loadTrash();

  initTheme();
```

Change it to:

```js
function init() {
  tasks = loadTasks();
  budgets = loadBudgets();
  clients = loadClients();
  trash = loadTrash();

  const migrated = migrateClientsFromLegacyText(tasks, budgets, clients);
  if (migrated.changed) {
    tasks = migrated.tasks;
    budgets = migrated.budgets;
    clients = migrated.clients;
    saveTasks(tasks);
    saveBudgets(budgets);
    saveClients(clients);
  }

  initTheme();
```

(The `let clients = [];` state declaration itself is added in Task 13 alongside the other view wiring — until then, add a temporary `let clients = [];` at the top of `app.js` next to `let trash = [];` so this task runs standalone. Task 13 will find it already there and skip re-adding it.)

- [ ] **Step 3: Add the temporary state declaration**

In `js/app.js`, change:

```js
let tasks = [];
let budgets = [];
let trash = [];
```

to:

```js
let tasks = [];
let budgets = [];
let clients = [];
let trash = [];
```

- [ ] **Step 4: Manual verification**

Start the local server, open the app, open devtools console, and seed legacy data (simulating an old backup with no `clientId`):

```js
localStorage.removeItem('lex_clients_migrated');
localStorage.setItem('lex_tasks', JSON.stringify([
  { id: 't1', title: 'Tarefa A', client: 'Maria Costa', priority: 'media', status: 'pendente', tags: [] },
  { id: 't2', title: 'Tarefa B', client: 'maria costa', priority: 'media', status: 'pendente', tags: [] }
]));
localStorage.setItem('lex_budgets', JSON.stringify([
  { id: 'b1', clientName: 'Maria Costa', status: 'aguardando', documents: [] }
]));
localStorage.removeItem('lex_clients');
location.reload();
```

After reload, in the console run `loadClients()`. Expected: exactly **one** client named "Maria Costa" (not three), and `loadTasks()[0].clientId === loadTasks()[1].clientId === loadBudgets()[0].clientId === loadClients()[0].id`. Reload the page again and confirm no duplicate client is created the second time (the migrated flag prevents re-running).

- [ ] **Step 5: Commit**

```bash
git add js/storage.js js/app.js
git commit -m "$(cat <<'EOF'
Migra clientes de texto livre para cadastro vinculado

Cria um registro de cliente por nome único já usado em tarefas/orçamentos
e liga cada um via clientId, uma única vez, na primeira carga do app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Include clients in Firebase sync payload

**Files:**
- Modify: `js/sync.js`

**Interfaces:**
- Consumes: `loadClients`/`saveClients` (Task 1), the global `clients` state (Task 2, step 3).
- Produces: sync payloads that round-trip `clients` the same way they already round-trip `tasks`/`budgets`/`trash`.

- [ ] **Step 1: Include clients when applying remote data**

In `js/sync.js`, `applyRemoteData()` currently:

```js
function applyRemoteData(data) {
  syncApplyingRemote = true;
  try {
    if (Array.isArray(data.tasks)) { tasks = data.tasks; saveTasks(tasks); }
    if (Array.isArray(data.budgets)) { budgets = data.budgets; saveBudgets(budgets); }
    if (Array.isArray(data.trash)) { trash = data.trash; saveTrash(trash); }
    renderAll();
  } finally {
    syncApplyingRemote = false;
  }
}
```

Change to:

```js
function applyRemoteData(data) {
  syncApplyingRemote = true;
  try {
    if (Array.isArray(data.tasks)) { tasks = data.tasks; saveTasks(tasks); }
    if (Array.isArray(data.budgets)) { budgets = data.budgets; saveBudgets(budgets); }
    if (Array.isArray(data.clients)) { clients = data.clients; saveClients(clients); }
    if (Array.isArray(data.trash)) { trash = data.trash; saveTrash(trash); }
    renderAll();
  } finally {
    syncApplyingRemote = false;
  }
}
```

- [ ] **Step 2: Include clients when pushing to the cloud**

In `js/sync.js`, `pushToCloud()` currently:

```js
  const payload = {
    tasks: loadTasks(),
    budgets: loadBudgets(),
    trash: loadTrash(),
    updatedAt: new Date().toISOString()
  };
```

Change to:

```js
  const payload = {
    tasks: loadTasks(),
    budgets: loadBudgets(),
    clients: loadClients(),
    trash: loadTrash(),
    updatedAt: new Date().toISOString()
  };
```

- [ ] **Step 3: Include clients in the "does remote/local already have data" conflict check**

In `js/sync.js`, `connectSync()` has:

```js
    const localHasData = loadTasks().length > 0 || loadBudgets().length > 0;
    const remoteHasData = remote && (remote.tasks || []).length + (remote.budgets || []).length > 0;
```

Change to:

```js
    const localHasData = loadTasks().length > 0 || loadBudgets().length > 0 || loadClients().length > 0;
    const remoteHasData = remote && (remote.tasks || []).length + (remote.budgets || []).length + (remote.clients || []).length > 0;
```

- [ ] **Step 4: Manual verification**

This can't be fully tested without two real devices and a Firebase project, so verify statically instead: start the local server, open the app, open devtools console, and run:

```js
typeof applyRemoteData === 'function' && applyRemoteData.toString().includes('data.clients')
```

Expected: `true`. Then in the Dados/Backup screen, open the sync section and confirm the UI still renders without console errors (sync stays disconnected since no Firebase config is set — that's expected).

- [ ] **Step 5: Commit**

```bash
git add js/sync.js
git commit -m "$(cat <<'EOF'
Inclui clientes na sincronização ao vivo via Firebase

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: CSS for the Clientes module

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Produces: CSS classes consumed by Tasks 5-12: `.clients-layout`, `.clients-list-pane`, `.clients-detail-pane`, `.clients-back`, `.client-row` (+ `-info`/`-name`/`-meta`/`-stat`), `.client-avatar`, `.client-detail-head`, `.client-detail-avatar`, `.client-detail-name`, `.client-detail-tags`, `.field-row`, `.client-autocomplete`, `.client-ac-dropdown`, `.client-ac-item`, `.client-ac-avatar`, `.client-ac-new`.

- [ ] **Step 1: Append the Clientes styles**

Append this block to the end of `css/style.css`:

```css
/* ===== Clientes ===== */
.clients-layout{display:block;}
.clients-list-pane{margin-bottom:1rem;}
.clients-detail-pane{
  display:none;
  background:var(--bg-surface);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:1rem 1.1rem;
}
.clients-layout.detail-open .clients-list-pane{display:none;}
.clients-layout.detail-open .clients-detail-pane{display:block;}
.clients-back{margin-bottom:.7rem;}

.client-row{
  display:flex;
  align-items:center;
  gap:.7rem;
  background:var(--bg-surface);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:.7rem .8rem;
  cursor:pointer;
  transition:box-shadow .15s;
}
.client-row:hover,.client-row.active{box-shadow:var(--shadow-md);}
.client-row.active{outline:2px solid var(--blue-500);outline-offset:-2px;}
.client-avatar{
  width:42px;height:42px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:700;font-size:.85rem;flex-shrink:0;
}
.client-row-info{flex:1;min-width:0;}
.client-row-name{font-weight:700;color:var(--text-primary);font-size:.95rem;}
.client-row-meta{font-size:.78rem;color:var(--text-muted);display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.1rem;}
.client-row-stat{font-size:.7rem;color:var(--text-muted);text-align:right;line-height:1.2;font-weight:700;white-space:nowrap;}
.client-row-stat span{display:block;font-weight:500;}

.client-detail-head{display:flex;align-items:center;gap:.8rem;margin-bottom:.9rem;}
.client-detail-avatar{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;flex-shrink:0;}
.client-detail-name{font-size:1.1rem;font-weight:800;color:var(--blue-900);}
:root[data-theme="dark"] .client-detail-name{color:#8fb8e8;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .client-detail-name{color:#8fb8e8;}}
.client-detail-tags{margin-top:.25rem;display:flex;gap:.3rem;flex-wrap:wrap;}
.field-row{font-size:.85rem;color:var(--text-secondary);margin-bottom:.35rem;}
.field-row b{color:var(--text-muted);font-weight:600;min-width:90px;display:inline-block;}

/* Autocomplete de cliente (tarefa/orçamento) */
.client-autocomplete{position:relative;}
.client-ac-dropdown{
  position:absolute;top:100%;left:0;right:0;
  background:var(--bg-surface);
  border:1px solid var(--border-color);
  border-radius:0 0 8px 8px;
  box-shadow:var(--shadow-md);
  z-index:5;
  max-height:220px;
  overflow-y:auto;
}
.client-ac-item{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;font-size:.85rem;cursor:pointer;border-bottom:1px solid var(--border-soft);}
.client-ac-item:last-child{border-bottom:none;}
.client-ac-item:hover{background:var(--bg-surface-alt);}
.client-ac-avatar{width:24px;height:24px;border-radius:50%;color:#fff;font-size:.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.client-ac-new{padding:.5rem .6rem;font-size:.83rem;color:var(--blue-700);font-weight:600;cursor:pointer;background:var(--bg-surface-alt);}
.client-ac-new:hover{background:var(--bg-surface-alt-2);}

@media (min-width:768px){
  .clients-layout{display:flex;gap:1.1rem;align-items:flex-start;}
  .clients-list-pane{flex:0 0 280px;margin-bottom:0;}
  .clients-detail-pane{display:block;flex:1;min-width:0;}
  .clients-back{display:none;}
}
```

- [ ] **Step 2: Manual verification**

Open the app and, in devtools, confirm `getComputedStyle(document.documentElement).getPropertyValue('--shadow')` and `--shadow-md` return non-empty values (these are the existing variables this new CSS reuses) — this just confirms no typo broke the reference. No visual check yet since the markup doesn't exist until Task 5.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "$(cat <<'EOF'
Adiciona estilos do módulo de Clientes

Layout lista+detalhe responsivo (split no desktop, navegação em duas
telas no celular), card com avatar de iniciais, e dropdown de
autocomplete de cliente.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: HTML scaffolding — nav, Clientes view, client modal

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: DOM elements consumed by Tasks 6-12 — `#view-clients`, `#clients-layout`, `#client-search`, `#btn-new-client`, `#clients-list`, `#client-detail-empty`, `#client-detail-content`, `#client-detail-avatar`, `#client-detail-name`, `#client-detail-tags`, `#client-detail-fields`, `#client-detail-notes-wrap`, `#client-detail-notes`, `#client-detail-tasks`, `#client-detail-budgets`, `#btn-client-back`, `#btn-client-edit`, `#modal-client` (+ its form fields `#client-id`, `#client-nome`, `#client-telefone`, `#client-email`, `#client-cpf-cnpj`, `#client-endereco`, `#client-tags`, `#client-observacoes`, `#client-delete`).

- [ ] **Step 1: Add "Clientes" to the top nav**

In `index.html`, find:

```html
      <button class="nav-btn" data-view="calendar">Calendário</button>
      <button class="nav-btn" data-view="budgets">Orçamentos</button>
```

Change to:

```html
      <button class="nav-btn" data-view="calendar">Calendário</button>
      <button class="nav-btn" data-view="clients">Clientes</button>
      <button class="nav-btn" data-view="budgets">Orçamentos</button>
```

- [ ] **Step 2: Add "Clientes" to the bottom nav**

Find:

```html
  <button class="nav-btn" data-view="calendar"><span class="ic">📅</span><span>Calendário</span></button>
  <button class="nav-btn" data-view="budgets"><span class="ic">📁</span><span>Orçamentos</span></button>
```

Change to:

```html
  <button class="nav-btn" data-view="calendar"><span class="ic">📅</span><span>Calendário</span></button>
  <button class="nav-btn" data-view="clients"><span class="ic">👤</span><span>Clientes</span></button>
  <button class="nav-btn" data-view="budgets"><span class="ic">📁</span><span>Orçamentos</span></button>
```

- [ ] **Step 3: Add the Clientes view section**

Find the closing of the calendar section (right before the budgets section):

```html
  </section>

  <!-- ORÇAMENTOS -->
```

Change to:

```html
  </section>

  <!-- CLIENTES -->
  <section id="view-clients" class="view">
    <h1 class="view-title">Clientes</h1>
    <div class="clients-layout" id="clients-layout">
      <div class="clients-list-pane">
        <div class="filters-bar">
          <input type="search" id="client-search" placeholder="Buscar cliente...">
        </div>
        <button type="button" class="btn btn-primary btn-block" id="btn-new-client">+ Novo cliente</button>
        <div id="clients-list" class="card-list" style="margin-top:.7rem"></div>
      </div>
      <div class="clients-detail-pane">
        <button type="button" class="btn btn-secondary btn-sm clients-back" id="btn-client-back">← Voltar</button>
        <div id="client-detail-empty" class="empty-state">Selecione um cliente para ver os detalhes.</div>
        <div id="client-detail-content" class="hidden">
          <div class="client-detail-head">
            <span class="client-detail-avatar" id="client-detail-avatar"></span>
            <div>
              <div class="client-detail-name" id="client-detail-name"></div>
              <div class="client-detail-tags" id="client-detail-tags"></div>
            </div>
          </div>
          <div id="client-detail-fields"></div>
          <div id="client-detail-notes-wrap" class="hidden">
            <h2 class="section-title">Observações</h2>
            <p class="hint-text" id="client-detail-notes"></p>
          </div>
          <h2 class="section-title">Tarefas vinculadas</h2>
          <div id="client-detail-tasks" class="card-list"></div>
          <h2 class="section-title">Orçamentos vinculados</h2>
          <div id="client-detail-budgets" class="card-list"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="btn-client-edit">✏️ Editar cliente</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ORÇAMENTOS -->
```

- [ ] **Step 4: Add the client modal**

Find the end of the budget modal (right before the budget-detail modal comment):

```html
</div>

<!-- MODAL: Detalhe do Orçamento (checklist) -->
```

Change to:

```html
</div>

<!-- MODAL: Cliente -->
<div id="modal-client" class="modal-overlay hidden">
  <div class="modal">
    <div class="modal-header"><h3 id="client-modal-title">Novo Cliente</h3><button class="modal-close" data-close>&times;</button></div>
    <form id="form-client" class="modal-body">
      <input type="hidden" id="client-id">
      <label>Nome*
        <input type="text" id="client-nome" required maxlength="120">
      </label>
      <label>Telefone
        <input type="tel" id="client-telefone" maxlength="20">
      </label>
      <label>E-mail
        <input type="email" id="client-email" maxlength="120">
      </label>
      <label>CPF/CNPJ
        <input type="text" id="client-cpf-cnpj" maxlength="20">
      </label>
      <label>Endereço
        <input type="text" id="client-endereco" maxlength="200">
      </label>
      <label>Categoria (separadas por vírgula)
        <input type="text" id="client-tags" placeholder="Ex: pessoa física, previdenciário">
      </label>
      <label>Observações
        <textarea id="client-observacoes" rows="3" maxlength="2000"></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-danger hidden" id="client-delete">Excluir</button>
        <button type="submit" class="btn btn-primary">Salvar cliente</button>
      </div>
    </form>
  </div>
</div>

<!-- MODAL: Detalhe do Orçamento (checklist) -->
```

- [ ] **Step 5: Add the `clients.js` script tag**

Find:

```html
<script src="js/messages.js"></script>
<script src="js/sync.js"></script>
```

Change to:

```html
<script src="js/messages.js"></script>
<script src="js/clients.js"></script>
<script src="js/sync.js"></script>
```

- [ ] **Step 6: Create an empty `js/clients.js` placeholder (filled in Tasks 6-8, 10)**

Create `js/clients.js` with just this header comment, so the app doesn't 404 on the new script tag:

```js
// Módulo de Clientes: cadastro, listagem, detalhe e autocomplete
```

- [ ] **Step 7: Manual verification**

Start the local server and open the app. Confirm: the "Clientes" button appears in the top nav (desktop width) and bottom nav (mobile width, use the Browser tool's `resize_window` to a mobile preset), clicking it switches to an empty "Clientes" view showing "Selecione um cliente para ver os detalhes." with no console errors. Confirm no 404 for `js/clients.js` in the network tab.

- [ ] **Step 8: Commit**

```bash
git add index.html js/clients.js
git commit -m "$(cat <<'EOF'
Adiciona estrutura HTML da tela de Clientes e do modal de cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Client avatar helpers + list rendering

**Files:**
- Modify: `js/clients.js`

**Interfaces:**
- Consumes: `escapeHtml` (`utils.js`), the global `clients`/`tasks`/`budgets` arrays (declared in `app.js`, populated by `init()` from Task 2).
- Produces: `clientAvatarColor(clientId): string`, `clientInitials(nome): string`, `findClientById(id): object|null`, `clientCardHtml(client): string`, `renderClientsList(): void` — all consumed by Task 7 (detail rendering) and Task 13 (final wiring).

- [ ] **Step 1: Write the helpers**

Add to `js/clients.js`:

```js
const CLIENT_AVATAR_COLORS = ['var(--blue-500)', 'var(--amber-600)', 'var(--green-600)', 'var(--red-600)', 'var(--blue-700)'];

function clientAvatarColor(clientId) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  return CLIENT_AVATAR_COLORS[hash % CLIENT_AVATAR_COLORS.length];
}

function clientInitials(nome) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function findClientById(id) {
  return clients.find((c) => c.id === id) || null;
}

function clientTaskCount(clientId) {
  return tasks.filter((t) => t.clientId === clientId).length;
}

function clientBudgetCount(clientId) {
  return budgets.filter((b) => b.clientId === clientId).length;
}
```

- [ ] **Step 2: Write the card HTML + list renderer**

Add to `js/clients.js`:

```js
function clientCardHtml(c) {
  const initials = clientInitials(c.nome);
  const color = clientAvatarColor(c.id);
  const total = clientTaskCount(c.id) + clientBudgetCount(c.id);
  const metaParts = [];
  if (c.telefone) metaParts.push(`📞 ${escapeHtml(c.telefone)}`);
  if (c.email) metaParts.push(`✉️ ${escapeHtml(c.email)}`);
  const tagBadge = c.tags && c.tags[0] ? `<span class="badge badge-tag">${escapeHtml(c.tags[0])}</span>` : '';
  return `
  <div class="client-row" data-id="${c.id}">
    <span class="client-avatar" style="background:${color}">${initials}</span>
    <div class="client-row-info">
      <div class="client-row-name">${escapeHtml(c.nome)}</div>
      <div class="client-row-meta">${metaParts.join(' · ')}${tagBadge}</div>
    </div>
    <div class="client-row-stat">${total}<span>vínculos</span></div>
  </div>`;
}

function renderClientsList() {
  const container = document.getElementById('clients-list');
  if (!container) return;
  const search = document.getElementById('client-search').value.trim().toLowerCase();
  let list = clients.slice();
  if (search) list = list.filter((c) => c.nome.toLowerCase().includes(search));
  list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum cliente encontrado.</div>';
    return;
  }
  container.innerHTML = list.map((c) => clientCardHtml(c)).join('');
  container.querySelectorAll('.client-row').forEach((row) => {
    row.addEventListener('click', () => openClientDetail(row.dataset.id));
  });
}
```

(`openClientDetail` is defined in Task 7 — this file won't be call-safe until then, which is fine since nothing invokes `renderClientsList()` yet until Task 13.)

- [ ] **Step 3: Manual verification**

Start the local server, open the app, open devtools console, and run:

```js
clients = [{ id: 'c1', nome: 'Maria Costa', telefone: '11988881234', email: '', cpfCnpj: '', endereco: '', observacoes: '', tags: ['Pessoa física'], createdAt: new Date().toISOString() }];
document.getElementById('clients-list').innerHTML = clients.map(clientCardHtml).join('');
```

Expected: the Clientes list area (switch to the Clientes view first) now shows one row with a blue circular avatar "MC", the name "Maria Costa", the phone, and a "Pessoa física" badge — confirming `escapeHtml`/color hashing/markup all work. (Clicking the row will error since `openClientDetail` doesn't exist yet — that's expected at this point.)

- [ ] **Step 4: Commit**

```bash
git add js/clients.js
git commit -m "$(cat <<'EOF'
Adiciona helpers de avatar e listagem de clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Client detail pane + responsive navigation

**Files:**
- Modify: `js/clients.js`

**Interfaces:**
- Consumes: `findClientById`, `clientInitials`, `clientAvatarColor` (Task 6); `taskCardHtml`/`bindTaskCardEvents`/`budgetCardHtml`/`bindBudgetCardEvents` (already defined in `app.js`).
- Produces: `currentClientDetailId` (module state), `openClientDetail(id): void`, `closeClientDetail(): void`, `renderClientDetail(): void` — consumed by Task 6's `renderClientsList` (already written), Task 8 (opens detail after save), and Task 13.

- [ ] **Step 1: Write the detail renderer and navigation functions**

Add to `js/clients.js`:

```js
let currentClientDetailId = null;

function openClientDetail(id) {
  currentClientDetailId = id;
  renderClientDetail();
  document.getElementById('clients-layout').classList.add('detail-open');
  document.querySelectorAll('#clients-list .client-row').forEach((row) => {
    row.classList.toggle('active', row.dataset.id === id);
  });
}

function closeClientDetail() {
  document.getElementById('clients-layout').classList.remove('detail-open');
}

function renderClientDetail() {
  const client = findClientById(currentClientDetailId);
  const emptyEl = document.getElementById('client-detail-empty');
  const contentEl = document.getElementById('client-detail-content');
  if (!emptyEl || !contentEl) return;

  if (!client) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const avatarEl = document.getElementById('client-detail-avatar');
  avatarEl.textContent = clientInitials(client.nome);
  avatarEl.style.background = clientAvatarColor(client.id);
  document.getElementById('client-detail-name').textContent = client.nome;
  document.getElementById('client-detail-tags').innerHTML = (client.tags || [])
    .map((t) => `<span class="badge badge-tag">${escapeHtml(t)}</span>`).join('');

  const fields = [
    ['Telefone', client.telefone],
    ['E-mail', client.email],
    ['CPF/CNPJ', client.cpfCnpj],
    ['Endereço', client.endereco]
  ].filter(([, value]) => value);
  document.getElementById('client-detail-fields').innerHTML = fields.length === 0
    ? '<div class="hint-text">Nenhum dado de contato cadastrado.</div>'
    : fields.map(([label, value]) => `<div class="field-row"><b>${label}</b> ${escapeHtml(value)}</div>`).join('');

  document.getElementById('client-detail-notes').textContent = client.observacoes || '';
  document.getElementById('client-detail-notes-wrap').classList.toggle('hidden', !client.observacoes);

  const linkedTasks = tasks.filter((t) => t.clientId === client.id && t.status !== 'concluida');
  const tasksEl = document.getElementById('client-detail-tasks');
  tasksEl.innerHTML = linkedTasks.length === 0
    ? '<div class="empty-state">Nenhuma tarefa vinculada.</div>'
    : linkedTasks.map((t) => taskCardHtml(t)).join('');
  bindTaskCardEvents(tasksEl);

  const linkedBudgets = budgets.filter((b) => b.clientId === client.id);
  const budgetsEl = document.getElementById('client-detail-budgets');
  budgetsEl.innerHTML = linkedBudgets.length === 0
    ? '<div class="empty-state">Nenhum orçamento vinculado.</div>'
    : linkedBudgets.map((b) => budgetCardHtml(b)).join('');
  bindBudgetCardEvents(budgetsEl);
}
```

- [ ] **Step 2: Manual verification**

Start the local server, open the app, switch to the Clientes view, open devtools console, and run:

```js
clients = [{ id: 'c1', nome: 'Maria Costa', telefone: '11988881234', email: 'maria@email.com', cpfCnpj: '', endereco: '', observacoes: 'Cliente antiga, prefere WhatsApp.', tags: ['Pessoa física'], createdAt: new Date().toISOString() }];
tasks = [{ id: 't1', title: 'Petição inicial', clientId: 'c1', priority: 'alta', status: 'pendente', tags: [] }];
budgets = [];
renderClientsList();
```

Click the "Maria Costa" row. Expected: the detail pane shows the avatar, name, "Pessoa física" tag, the phone/e-mail field rows, the observação text, and one linked task card ("Petição inicial"). On a desktop-width window both panes are visible side by side; resize to mobile width (Browser tool `resize_window` preset `mobile`) and confirm the list disappears and only the detail pane (with a visible "← Voltar" button) shows — clicking it should call `closeClientDetail()` once wired (wiring happens in Task 13; for now just confirm the button exists and is visible only at mobile width).

- [ ] **Step 3: Commit**

```bash
git add js/clients.js
git commit -m "$(cat <<'EOF'
Adiciona painel de detalhe do cliente com histórico vinculado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Client form modal (create/edit/delete) + name propagation

**Files:**
- Modify: `js/clients.js`
- Modify: `js/app.js` (trash handling, see Step 4)

**Interfaces:**
- Consumes: `uid()`, `parseTags()` (`utils.js`), `saveClients` (Task 1), `openModal`/`closeModal`/`showToast`/`renderAll` (`app.js`), `openClientDetail`/`renderClientDetail`/`currentClientDetailId` (Task 7).
- Produces: `wireClientModal(): void`, `openClientModal(id?): void`, `propagateClientNameChange(clientId, newName): void`, `moveClientToTrash(client): void` (in `app.js`, alongside its siblings) — consumed by Task 9 (trash restore/list) and Task 13 (final wiring calls `wireClientModal()`).

- [ ] **Step 1: Write the name-propagation helper**

Add to `js/clients.js`:

```js
function propagateClientNameChange(clientId, newName) {
  let changed = false;
  tasks.forEach((t) => {
    if (t.clientId === clientId && t.client !== newName) { t.client = newName; changed = true; }
  });
  budgets.forEach((b) => {
    if (b.clientId === clientId && b.clientName !== newName) { b.clientName = newName; changed = true; }
  });
  if (changed) {
    saveTasks(tasks);
    saveBudgets(budgets);
  }
}
```

- [ ] **Step 2: Write the modal open/submit/delete functions**

Add to `js/clients.js`:

```js
function wireClientModal() {
  document.getElementById('form-client').addEventListener('submit', onSubmitClient);
  document.getElementById('client-delete').addEventListener('click', onDeleteClientFromModal);
}

function openClientModal(id) {
  const form = document.getElementById('form-client');
  form.reset();
  const deleteBtn = document.getElementById('client-delete');
  if (id) {
    const client = findClientById(id);
    if (!client) return;
    document.getElementById('client-modal-title').textContent = 'Editar Cliente';
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-nome').value = client.nome;
    document.getElementById('client-telefone').value = client.telefone || '';
    document.getElementById('client-email').value = client.email || '';
    document.getElementById('client-cpf-cnpj').value = client.cpfCnpj || '';
    document.getElementById('client-endereco').value = client.endereco || '';
    document.getElementById('client-tags').value = (client.tags || []).join(', ');
    document.getElementById('client-observacoes').value = client.observacoes || '';
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('client-modal-title').textContent = 'Novo Cliente';
    document.getElementById('client-id').value = '';
    deleteBtn.classList.add('hidden');
  }
  openModal('modal-client');
}

function onSubmitClient(e) {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const nome = document.getElementById('client-nome').value.trim();
  if (!nome) return;

  const data = {
    nome,
    telefone: document.getElementById('client-telefone').value.trim(),
    email: document.getElementById('client-email').value.trim(),
    cpfCnpj: document.getElementById('client-cpf-cnpj').value.trim(),
    endereco: document.getElementById('client-endereco').value.trim(),
    tags: parseTags(document.getElementById('client-tags').value),
    observacoes: document.getElementById('client-observacoes').value.trim()
  };

  let savedId = id;
  if (id) {
    const idx = clients.findIndex((c) => c.id === id);
    if (idx !== -1) clients[idx] = { ...clients[idx], ...data };
    propagateClientNameChange(id, nome);
  } else {
    savedId = uid();
    clients.push({ id: savedId, createdAt: new Date().toISOString(), ...data });
  }
  saveClients(clients);
  closeModal('modal-client');
  renderAll();
  openClientDetail(savedId);
  showToast('Cliente salvo.');
}

function onDeleteClientFromModal() {
  const id = document.getElementById('client-id').value;
  if (!id) return;
  const client = findClientById(id);
  if (!client) return;
  if (!window.confirm('Excluir este cliente? Ele ficará na lixeira e pode ser restaurado. Tarefas e orçamentos vinculados não serão excluídos.')) return;
  moveClientToTrash(client);
  clients = clients.filter((c) => c.id !== id);
  saveClients(clients);
  closeModal('modal-client');
  closeClientDetail();
  renderAll();
  showToast('Cliente movido para a lixeira.');
}
```

- [ ] **Step 3: Manual verification (client CRUD, before trash wiring)**

Start the local server, open the app, open devtools console, and run:

```js
clients = []; tasks = []; budgets = [];
wireClientModal();
openClientModal();
```

Fill in the modal form that appears (Nome "João Teste", any other fields) and submit. Expected: modal closes, a toast "Cliente salvo." appears, and the Clientes view now shows "João Teste" in the list and its detail pane open. Click "✏️ Editar cliente", change the name to "João Teste Editado", submit — expected: detail pane updates to the new name immediately (no reload needed).

- [ ] **Step 4: Add `moveClientToTrash` and extend trash restore/render for the `'client'` type**

In `js/app.js`, find the "LIXEIRA" section. Add a third function alongside the existing two:

```js
function moveClientToTrash(client) {
  trash.push({ id: uid(), type: 'client', data: client, deletedAt: new Date().toISOString() });
  saveTrash(trash);
}
```

Then update `restoreTrashItem()` — change:

```js
function restoreTrashItem(trashId) {
  const entry = trash.find((t) => t.id === trashId);
  if (!entry) return;
  if (entry.type === 'task') {
    tasks.push(entry.data);
    saveTasks(tasks);
  } else {
    budgets.push(entry.data);
    saveBudgets(budgets);
  }
  trash = trash.filter((t) => t.id !== trashId);
  saveTrash(trash);
  renderAll();
  showToast('Item restaurado.');
}
```

to:

```js
function restoreTrashItem(trashId) {
  const entry = trash.find((t) => t.id === trashId);
  if (!entry) return;
  if (entry.type === 'task') {
    tasks.push(entry.data);
    saveTasks(tasks);
  } else if (entry.type === 'budget') {
    budgets.push(entry.data);
    saveBudgets(budgets);
  } else if (entry.type === 'client') {
    clients.push(entry.data);
    saveClients(clients);
  }
  trash = trash.filter((t) => t.id !== trashId);
  saveTrash(trash);
  renderAll();
  showToast('Item restaurado.');
}
```

Then update the item naming inside `renderTrash()` — change:

```js
    const name = entry.type === 'task' ? entry.data.title : entry.data.clientName;
    const typeLabel = entry.type === 'task' ? '📌 Tarefa' : '📁 Orçamento';
```

to:

```js
    const name = entry.type === 'task' ? entry.data.title : entry.type === 'budget' ? entry.data.clientName : entry.data.nome;
    const typeLabel = entry.type === 'task' ? '📌 Tarefa' : entry.type === 'budget' ? '📁 Orçamento' : '👤 Cliente';
```

- [ ] **Step 5: Manual verification (delete + trash restore)**

Continuing from Step 3's console session (with "João Teste Editado" open in the detail pane), click "✏️ Editar cliente" then "Excluir", confirm the browser confirm dialog. Expected: toast "Cliente movido para a lixeira.", the client disappears from the Clientes list. Switch to the "Dados e Backup" view, scroll to "🗑️ Lixeira" — expected: one entry "👤 Cliente" named "João Teste Editado". Click "↩️ Restaurar" — expected: toast "Item restaurado.", and the client reappears in the Clientes list.

- [ ] **Step 6: Commit**

```bash
git add js/clients.js js/app.js
git commit -m "$(cat <<'EOF'
Adiciona CRUD de cliente com propagação de nome e lixeira

Editar o nome de um cliente atualiza o texto em cache das tarefas e
orçamentos vinculados. Excluir um cliente usa a mesma lixeira restaurável
já usada por tarefas e orçamentos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Manual QA of Task 8's trash change against tasks/budgets (regression check)

**Files:** none (verification-only task; no code changes)

**Interfaces:** none.

- [ ] **Step 1: Regression-check the existing task/budget trash flow**

Task 8 changed the shared `restoreTrashItem`/`renderTrash` functions used by tasks and budgets too. Start the local server, open the app, create one task and one budget through the UI, delete both (they go to the lixeira), open "Dados e Backup" → Lixeira, and confirm both show their correct icon/label ("📌 Tarefa" / "📁 Orçamento") and both restore correctly via "↩️ Restaurar" back into the Tarefas/Orçamentos views. This confirms the three-way `if/else if` didn't regress the two existing branches.

- [ ] **Step 2: No commit** (verification-only; nothing to stage)

---

### Task 10: Shared client-autocomplete component

**Files:**
- Modify: `js/clients.js`

**Interfaces:**
- Consumes: `clients` (global state), `findClientById`, `clientAvatarColor`, `clientInitials` (Task 6), `escapeHtml`, `uid`, `saveClients`.
- Produces: `setupClientAutocomplete(inputId, hiddenIdId, dropdownId): void`, `resolveClientIdFromInput(inputId, hiddenIdId): {clientId, clientName}` — consumed by Tasks 11 and 12.

- [ ] **Step 1: Write the autocomplete component**

Add to `js/clients.js`:

```js
function setupClientAutocomplete(inputId, hiddenIdId, dropdownId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenIdId);
  const dropdown = document.getElementById(dropdownId);

  function closeDropdown() {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }

  function renderSuggestions() {
    const query = input.value.trim().toLowerCase();
    let matches = clients;
    if (query) matches = clients.filter((c) => c.nome.toLowerCase().includes(query));
    matches = matches.slice(0, 6);

    let html = matches.map((c) => `
      <div class="client-ac-item" data-id="${c.id}">
        <span class="client-ac-avatar" style="background:${clientAvatarColor(c.id)}">${clientInitials(c.nome)}</span>
        ${escapeHtml(c.nome)}
      </div>`).join('');

    const trimmed = input.value.trim();
    const exactMatch = trimmed && clients.some((c) => c.nome.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !exactMatch) {
      html += `<div class="client-ac-new" data-new="${escapeHtml(trimmed)}">＋ Criar cliente "${escapeHtml(trimmed)}"</div>`;
    }

    if (!html) {
      closeDropdown();
      return;
    }
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.client-ac-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const client = findClientById(item.dataset.id);
        if (!client) return;
        input.value = client.nome;
        hidden.value = client.id;
        closeDropdown();
      });
    });
    const newItem = dropdown.querySelector('.client-ac-new');
    if (newItem) {
      newItem.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const name = newItem.dataset.new;
        const client = { id: uid(), nome: name, telefone: '', email: '', cpfCnpj: '', endereco: '', observacoes: '', tags: [], createdAt: new Date().toISOString() };
        clients.push(client);
        saveClients(clients);
        input.value = client.nome;
        hidden.value = client.id;
        closeDropdown();
      });
    }
  }

  input.addEventListener('input', () => {
    hidden.value = '';
    renderSuggestions();
  });
  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('blur', () => setTimeout(closeDropdown, 120));
}

function resolveClientIdFromInput(inputId, hiddenIdId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenIdId);
  const trimmed = input.value.trim();
  if (!trimmed) return { clientId: '', clientName: '' };

  if (hidden.value) {
    const existing = findClientById(hidden.value);
    if (existing && existing.nome.toLowerCase() === trimmed.toLowerCase()) {
      return { clientId: existing.id, clientName: existing.nome };
    }
  }

  const match = clients.find((c) => c.nome.toLowerCase() === trimmed.toLowerCase());
  if (match) return { clientId: match.id, clientName: match.nome };

  const client = { id: uid(), nome: trimmed, telefone: '', email: '', cpfCnpj: '', endereco: '', observacoes: '', tags: [], createdAt: new Date().toISOString() };
  clients.push(client);
  saveClients(clients);
  return { clientId: client.id, clientName: client.nome };
}
```

- [ ] **Step 2: Manual verification**

This component has no DOM to attach to yet (that comes in Tasks 11-12), so verify it in isolation. Start the local server, open the app, open devtools console, and run:

```js
clients = [{ id: 'c1', nome: 'Maria Costa', telefone: '', email: '', cpfCnpj: '', endereco: '', observacoes: '', tags: [], createdAt: new Date().toISOString() }];
document.body.insertAdjacentHTML('beforeend', '<div class="client-autocomplete"><input id="test-input"><input type="hidden" id="test-hidden"><div class="client-ac-dropdown hidden" id="test-dropdown"></div></div>');
setupClientAutocomplete('test-input', 'test-hidden', 'test-dropdown');
document.getElementById('test-input').focus();
document.getElementById('test-input').value = 'Mar';
document.getElementById('test-input').dispatchEvent(new Event('input'));
```

Expected: `document.getElementById('test-dropdown').innerHTML` now contains a `client-ac-item` for "Maria Costa" and a `client-ac-new` for creating "Mar". Then run:

```js
resolveClientIdFromInput('test-input', 'test-hidden')
```

Expected: returns `{ clientId: 'c1', clientName: 'Maria Costa' }` if you'd clicked the suggestion first (`document.querySelector('.client-ac-item').dispatchEvent(new MouseEvent('mousedown'))`), or creates+returns a new client id if you leave the raw text "Mar" unresolved. Clean up with `document.getElementById('test-input').closest('.client-autocomplete').remove();`.

- [ ] **Step 3: Commit**

```bash
git add js/clients.js
git commit -m "$(cat <<'EOF'
Adiciona componente reutilizável de autocomplete de cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Wire the autocomplete into the Task modal

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `setupClientAutocomplete`, `resolveClientIdFromInput` (Task 10).
- Produces: `task.clientId` is now always set correctly on save; the task form's client field is fed by the autocomplete instead of raw free text.

- [ ] **Step 1: Replace the task modal's client field markup**

In `index.html`, find:

```html
      <label>Cliente/Destinatário (opcional)
        <input type="text" id="task-client" maxlength="120">
      </label>
```

Change to:

```html
      <label>Cliente (opcional)
        <div class="client-autocomplete">
          <input type="text" id="task-client-input" maxlength="120" autocomplete="off" placeholder="Digite para buscar ou criar">
          <input type="hidden" id="task-client-id">
          <div class="client-ac-dropdown hidden" id="task-client-dropdown"></div>
        </div>
      </label>
```

- [ ] **Step 2: Update `openTaskModal` to prefill the new fields**

In `js/app.js`, find in `openTaskModal`:

```js
    document.getElementById('task-client').value = task.client || '';
```

Change to:

```js
    document.getElementById('task-client-input').value = task.client || '';
    document.getElementById('task-client-id').value = task.clientId || '';
```

- [ ] **Step 3: Update `onSubmitTask` to resolve the client via autocomplete**

In `js/app.js`, find in `onSubmitTask`:

```js
  const data = {
    title,
    client: document.getElementById('task-client').value.trim(),
    description: document.getElementById('task-description').value.trim(),
```

Change to:

```js
  const clientInfo = resolveClientIdFromInput('task-client-input', 'task-client-id');
  const data = {
    title,
    client: clientInfo.clientName,
    clientId: clientInfo.clientId,
    description: document.getElementById('task-description').value.trim(),
```

- [ ] **Step 4: Update `onAnalyzeCapture`'s task-fill branch**

In `js/app.js`, find:

```js
    document.getElementById('task-client').value = result.fields.client;
```

Change to:

```js
    document.getElementById('task-client-input').value = result.fields.client;
```

- [ ] **Step 5: Wire the autocomplete on init**

In `js/app.js`, `init()`, add this line right after `wireTaskModal();`:

```js
  setupClientAutocomplete('task-client-input', 'task-client-id', 'task-client-dropdown');
```

- [ ] **Step 6: Manual verification**

Start the local server, open the app. Open "Nova Tarefa" (FAB → "📌 Nova Tarefa"), type "Mar" into the Cliente field — expected: a dropdown appears (empty list + "＋ Criar cliente "Mar"" if no clients exist yet, or matching clients if you created one in an earlier task's testing). Click "＋ Criar cliente "Mar"", confirm the field now shows "Mar" and the dropdown closes. Fill in Título, save. Expected: toast "Tarefa salva.", and in devtools `tasks[tasks.length-1].clientId` is a non-empty string matching a client in `clients`. Reopen the same task for editing — expected: the Cliente field is prefilled with "Mar". Switch to the Clientes view and confirm "Mar" now appears in the list with 1 vínculo.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js
git commit -m "$(cat <<'EOF'
Liga o campo de cliente da Tarefa ao autocomplete de clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Wire the autocomplete into the Budget modal

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `setupClientAutocomplete`, `resolveClientIdFromInput` (Task 10).
- Produces: `budget.clientId` is now always set correctly on save; the budget form's client field is fed by the autocomplete instead of raw free text.

- [ ] **Step 1: Replace the budget modal's client field markup**

In `index.html`, find:

```html
      <label>Nome do cliente*
        <input type="text" id="budget-client" required maxlength="120">
      </label>
```

Change to:

```html
      <label>Nome do cliente*
        <div class="client-autocomplete">
          <input type="text" id="budget-client-input" required maxlength="120" autocomplete="off" placeholder="Digite para buscar ou criar">
          <input type="hidden" id="budget-client-id">
          <div class="client-ac-dropdown hidden" id="budget-client-dropdown"></div>
        </div>
      </label>
```

- [ ] **Step 2: Update `openBudgetModal` to prefill the new fields**

In `js/app.js`, find in `openBudgetModal`:

```js
    document.getElementById('budget-client').value = budget.clientName;
```

Change to:

```js
    document.getElementById('budget-client-input').value = budget.clientName;
    document.getElementById('budget-client-id').value = budget.clientId || '';
```

- [ ] **Step 3: Update `onSubmitBudget` to resolve the client via autocomplete**

In `js/app.js`, find in `onSubmitBudget`:

```js
  const id = document.getElementById('budget-id').value;
  const clientName = document.getElementById('budget-client').value.trim();
  if (!clientName) return;

  const data = {
    clientName,
    phone: document.getElementById('budget-phone').value.trim(),
```

Change to:

```js
  const id = document.getElementById('budget-id').value;
  const clientInfo = resolveClientIdFromInput('budget-client-input', 'budget-client-id');
  if (!clientInfo.clientName) return;

  const data = {
    clientName: clientInfo.clientName,
    clientId: clientInfo.clientId,
    phone: document.getElementById('budget-phone').value.trim(),
```

- [ ] **Step 4: Update `onAnalyzeCapture`'s budget-fill branch**

In `js/app.js`, find:

```js
    document.getElementById('budget-client').value = result.fields.clientName;
```

Change to:

```js
    document.getElementById('budget-client-input').value = result.fields.clientName;
```

- [ ] **Step 5: Wire the autocomplete on init**

In `js/app.js`, `init()`, add this line right after `wireBudgetModal();`:

```js
  setupClientAutocomplete('budget-client-input', 'budget-client-id', 'budget-client-dropdown');
```

- [ ] **Step 6: Manual verification**

Start the local server, open the app. Open "Novo Orçamento" (FAB → "📁 Novo Orçamento"), type an existing client's name (e.g. "Mar" from Task 11's test, or its full name), click the matching suggestion, fill in the rest, save. Expected: toast "Orçamento salvo.", and in devtools `budgets[budgets.length-1].clientId` matches that client's id. Open the Clientes view, click that client — expected: the linked orçamento now appears under "Orçamentos vinculados". Try submitting the budget form with the Cliente field empty — expected: the browser's native "required" validation blocks submission (same as before).

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js
git commit -m "$(cat <<'EOF'
Liga o campo de cliente do Orçamento ao autocomplete de clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Final wiring + full manual QA pass

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: everything from Tasks 1-12.
- Produces: a fully working Clientes module reachable from `init()`/`renderAll()` like every other view.

- [ ] **Step 1: Add `renderClients()` and call it from `renderAll()`**

Add this function to `js/clients.js`:

```js
function renderClients() {
  renderClientsList();
  renderClientDetail();
}
```

In `js/app.js`, `renderAll()` currently:

```js
function renderAll() {
  renderDashboard();
  renderTasks();
  renderBudgets();
  renderCompleted();
  renderTrash();
  renderBackupReminder();
  renderCalendar();
  renderBoard();
  populateTagFilterOptions();
}
```

Change to:

```js
function renderAll() {
  renderDashboard();
  renderTasks();
  renderBudgets();
  renderClients();
  renderCompleted();
  renderTrash();
  renderBackupReminder();
  renderCalendar();
  renderBoard();
  populateTagFilterOptions();
}
```

- [ ] **Step 2: Wire the Clientes view's own controls**

Add this function to `js/clients.js`:

```js
function wireClientsView() {
  document.getElementById('btn-new-client').addEventListener('click', () => openClientModal());
  document.getElementById('client-search').addEventListener('input', renderClientsList);
  document.getElementById('btn-client-back').addEventListener('click', closeClientDetail);
  document.getElementById('btn-client-edit').addEventListener('click', () => openClientModal(currentClientDetailId));
}
```

- [ ] **Step 3: Call the new wiring functions from `init()`**

In `js/app.js`, `init()` currently (after Tasks 2, 11, 12's edits) has this shape:

```js
function init() {
  tasks = loadTasks();
  budgets = loadBudgets();
  clients = loadClients();
  trash = loadTrash();

  const migrated = migrateClientsFromLegacyText(tasks, budgets, clients);
  if (migrated.changed) {
    tasks = migrated.tasks;
    budgets = migrated.budgets;
    clients = migrated.clients;
    saveTasks(tasks);
    saveBudgets(budgets);
    saveClients(clients);
  }

  initTheme();
  wireNav();
  wireFab();
  wireTaskModal();
  setupClientAutocomplete('task-client-input', 'task-client-id', 'task-client-dropdown');
  wireBudgetModal();
  setupClientAutocomplete('budget-client-input', 'budget-client-id', 'budget-client-dropdown');
  wireBudgetDetailModal();
  wireMessageModal();
  wireDataView();
  wireModalOverlayClicks();
  wireSearchModal();
  wireDocTemplates();
  wireCalendar();
  wireSubtasks();
  wireSyncUI();
  initSync();

  renderAll();
}
```

Add `wireClientModal();` and `wireClientsView();` right after the two `setupClientAutocomplete(...)` calls, so the final block reads:

```js
  wireTaskModal();
  setupClientAutocomplete('task-client-input', 'task-client-id', 'task-client-dropdown');
  wireBudgetModal();
  setupClientAutocomplete('budget-client-input', 'budget-client-id', 'budget-client-dropdown');
  wireClientModal();
  wireClientsView();
  wireBudgetDetailModal();
```

(If your `init()` doesn't exactly match the snippet above because Tasks 2/11/12 were applied in a different order, just make sure `wireClientModal()` and `wireClientsView()` are both called once, anywhere after `js/clients.js` has loaded — order relative to the other `wire*()` calls doesn't matter.)

- [ ] **Step 4: Full manual QA pass**

Start the local server (fresh `localStorage` — use a private/incognito window or run `localStorage.clear()` in devtools first) and open the app. Walk through the spec's full test checklist:

1. **Create a client directly**: Clientes → "+ Novo cliente" → fill Nome/Telefone/Email/Categoria → Salvar. Confirm it appears in the list and its detail pane opens automatically.
2. **Link via a new task**: Tarefas → "+" → Nova Tarefa → in Cliente, type a new name and pick "＋ Criar cliente" → save. Confirm the task shows up under that client's "Tarefas vinculadas".
3. **Link via a new orçamento**: same, via "Novo Orçamento", and confirm it shows up under "Orçamentos vinculados".
4. **Edit a client, see it reflected**: edit the first client's name → Salvar. Confirm the task/orçamento cards elsewhere in the app (Tarefas view, Orçamentos view, Dashboard highlights) now show the new name.
5. **Delete + restore via lixeira**: delete a client from its detail pane → confirm it's gone from Clientes → Dados e Backup → Lixeira → Restaurar → confirm it's back.
6. **Backup round-trip**: Dados e Backup → "⬇️ Exportar backup" → note the file has a `clients` array → `localStorage.clear()` → reload → confirm Clientes is empty → "⬆️ Importar backup" the file you just exported → confirm all clients, tasks, and orçamentos are back with their links intact.
7. **Migration**: repeat the console-based migration check from Task 2, Step 4, end to end through the UI this time (seed legacy `lex_tasks`/`lex_budgets` with no `clientId` via devtools, clear `lex_clients` and `lex_clients_migrated`, reload) — confirm the Clientes view is now populated and every migrated task/orçamento shows correctly under its client's history.
8. **Responsive check**: at desktop width, confirm the Clientes view shows list and detail side by side. Using the Browser tool's `resize_window` to the `mobile` preset, confirm only one pane shows at a time and "← Voltar" navigates back to the list. Reset with `resize_window` preset `desktop` afterward.
9. **No console errors**: check `read_console_messages` (or devtools console) for errors throughout the above steps.

Fix anything that doesn't match before proceeding.

- [ ] **Step 5: Commit**

```bash
git add js/app.js js/clients.js
git commit -m "$(cat <<'EOF'
Conclui a integração do módulo de Clientes ao app

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
