// Controlador principal da aplicação
let tasks = [];
let budgets = [];
let clients = [];
let trash = [];
let currentBudgetDetailId = null;
let calendarDate = new Date();
let currentTaskSubtasks = [];

document.addEventListener('DOMContentLoaded', init);

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
  wireBudgetModal();
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

/* ---------------- Navegação ---------------- */
function wireNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.getElementById('btn-open-data').addEventListener('click', () => switchView('data'));
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.nav-btn[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------- Modais genéricos ---------------- */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
function wireModalOverlayClicks() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
    overlay.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => overlay.classList.add('hidden'));
    });
  });
}

/* ---------------- Tema (claro/escuro) ---------------- */
function initTheme() {
  const pref = localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
  applyTheme(pref);
  document.getElementById('btn-toggle-theme').addEventListener('click', () => {
    const current = localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
    const isDark = current === 'dark' || (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark ? 'light' : 'dark');
  });
  document.querySelectorAll('.theme-opt').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });
}

function setTheme(pref) {
  localStorage.setItem(STORAGE_KEYS.THEME, pref);
  applyTheme(pref);
}

function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', pref);
  }
  const isDark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('btn-toggle-theme').textContent = isDark ? '☀️' : '🌙';
  document.querySelectorAll('.theme-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === pref);
  });
}

/* ---------------- Busca global ---------------- */
function wireSearchModal() {
  document.getElementById('btn-open-search').addEventListener('click', () => {
    openModal('modal-search');
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '<div class="empty-state">Digite para buscar em tarefas e orçamentos.</div>';
    setTimeout(() => document.getElementById('search-input').focus(), 50);
  });
  document.getElementById('search-input').addEventListener('input', (e) => renderSearchResults(e.target.value));
}

function renderSearchResults(query) {
  const container = document.getElementById('search-results');
  const q = query.trim().toLowerCase();
  if (!q) {
    container.innerHTML = '<div class="empty-state">Digite para buscar em tarefas e orçamentos.</div>';
    return;
  }
  const matchedTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    (t.client || '').toLowerCase().includes(q) ||
    (t.tags || []).some((tag) => tag.includes(q))
  );
  const matchedBudgets = budgets.filter((b) =>
    b.clientName.toLowerCase().includes(q) ||
    (b.description || '').toLowerCase().includes(q)
  );

  if (matchedTasks.length === 0 && matchedBudgets.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum resultado encontrado.</div>';
    return;
  }

  let html = '';
  matchedTasks.forEach((t) => {
    html += `
    <div class="item-card search-result" data-type="task" data-id="${t.id}">
      <div class="item-title-wrap">
        <div class="item-title">📌 ${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="badge badge-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
          <span class="badge badge-due">${STATUS_LABELS[t.status]}</span>
        </div>
      </div>
    </div>`;
  });
  matchedBudgets.forEach((b) => {
    html += `
    <div class="item-card search-result" data-type="budget" data-id="${b.id}">
      <div class="item-title-wrap">
        <div class="item-title">📁 ${escapeHtml(b.clientName)}</div>
        <div class="item-meta">
          <span class="badge badge-${b.status}">${BUDGET_STATUS_LABELS[b.status]}</span>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.search-result').forEach((card) => {
    card.addEventListener('click', () => {
      closeModal('modal-search');
      if (card.dataset.type === 'task') {
        openTaskModal(card.dataset.id);
      } else {
        openBudgetModal(card.dataset.id);
      }
    });
  });
}

/* ---------------- FAB / adição rápida ---------------- */
function wireFab() {
  document.getElementById('fab-add').addEventListener('click', () => openModal('modal-quick-add'));
  document.getElementById('quick-add-task').addEventListener('click', () => {
    closeModal('modal-quick-add');
    openTaskModal();
  });
  document.getElementById('quick-add-budget').addEventListener('click', () => {
    closeModal('modal-quick-add');
    openBudgetModal();
  });
  document.getElementById('quick-add-capture').addEventListener('click', () => {
    closeModal('modal-quick-add');
    document.getElementById('capture-text').value = '';
    openModal('modal-quick-capture');
    setTimeout(() => document.getElementById('capture-text').focus(), 50);
  });
  document.getElementById('btn-analyze-capture').addEventListener('click', onAnalyzeCapture);
}

function onAnalyzeCapture() {
  const raw = document.getElementById('capture-text').value.trim();
  if (!raw) return;
  const result = parseQuickCapture(raw);
  closeModal('modal-quick-capture');

  if (result.type === 'budget') {
    openBudgetModal();
    document.getElementById('budget-client').value = result.fields.clientName;
    document.getElementById('budget-description').value = result.fields.description;
    document.getElementById('budget-phone').value = result.fields.phone;
    showToast('📁 Identifiquei um orçamento. Revise os campos e salve.');
  } else {
    openTaskModal();
    document.getElementById('task-title').value = result.fields.title;
    document.getElementById('task-description').value = result.fields.description;
    document.getElementById('task-client').value = result.fields.client;
    document.getElementById('task-priority').value = result.fields.priority;
    document.getElementById('task-due').value = result.fields.dueDate;
    showToast('📌 Identifiquei uma tarefa. Revise os campos e salve.');
  }
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const pending = tasks.filter((t) => t.status !== 'concluida');
  const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status));
  const waiting = budgets.filter((b) => b.status === 'aguardando');
  const incompleteChecklists = budgets.filter((b) => {
    const docs = b.documents || [];
    return docs.length > 0 && docs.some((d) => !d.delivered);
  });

  document.getElementById('sum-pending').textContent = pending.length;
  document.getElementById('sum-overdue').textContent = overdue.length;
  document.getElementById('sum-waiting').textContent = waiting.length;
  document.getElementById('sum-incomplete').textContent = incompleteChecklists.length;

  const soonLimit = new Date();
  soonLimit.setDate(soonLimit.getDate() + 3);
  const soonLimitISO = soonLimit.toISOString().slice(0, 10);

  const highlights = tasks
    .filter((t) => t.status !== 'concluida' && (t.priority === 'alta' || (t.dueDate && t.dueDate <= soonLimitISO)))
    .sort((a, b) => {
      const overdueA = isOverdue(a.dueDate, a.status) ? 0 : 1;
      const overdueB = isOverdue(b.dueDate, b.status) ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const dateCompare = (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      if (dateCompare !== 0) return dateCompare;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    })
    .slice(0, 5);

  const container = document.getElementById('dashboard-highlights');
  if (highlights.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma tarefa de prioridade alta pendente. 🎉</div>';
  } else {
    container.innerHTML = highlights.map((t) => taskCardHtml(t)).join('');
    bindTaskCardEvents(container);
  }

  renderDistributions();
}

function renderDistributionBar(barEl, legendEl, segments) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    barEl.innerHTML = '';
    legendEl.innerHTML = '<span class="hint-text">Sem dados ainda.</span>';
    return;
  }
  barEl.innerHTML = segments
    .filter((s) => s.count > 0)
    .map((s) => `<span style="width:${(s.count / total) * 100}%;background:${s.color}"></span>`)
    .join('');
  legendEl.innerHTML = segments
    .map((s) => `<span><span class="dot" style="background:${s.color}"></span>${s.label}: ${s.count}</span>`)
    .join('');
}

function renderDistributions() {
  const taskSegments = [
    { label: 'Pendente', count: tasks.filter((t) => t.status === 'pendente').length, color: 'var(--gray-500)' },
    { label: 'Em andamento', count: tasks.filter((t) => t.status === 'andamento').length, color: 'var(--blue-500)' },
    { label: 'Concluída', count: tasks.filter((t) => t.status === 'concluida').length, color: 'var(--green-600)' }
  ];
  renderDistributionBar(document.getElementById('dist-tasks'), document.getElementById('dist-tasks-legend'), taskSegments);

  const budgetSegments = [
    { label: 'Aguardando', count: budgets.filter((b) => b.status === 'aguardando').length, color: 'var(--amber-600)' },
    { label: 'Aceito', count: budgets.filter((b) => b.status === 'aceito').length, color: 'var(--green-600)' },
    { label: 'Recusado', count: budgets.filter((b) => b.status === 'recusado').length, color: 'var(--red-600)' }
  ];
  renderDistributionBar(document.getElementById('dist-budgets'), document.getElementById('dist-budgets-legend'), budgetSegments);
}

/* ================= CALENDÁRIO ================= */
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function wireCalendar() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    calendarDate = new Date();
    renderCalendar();
  });
}

function dateToISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[month]} de ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = todayISO();

  const tasksByDate = {};
  tasks.filter((t) => t.status !== 'concluida' && t.dueDate).forEach((t) => {
    if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
    tasksByDate[t.dueDate].push(t);
  });

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  let html = '';

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    let cellDate, otherMonth = false;
    if (dayNum < 1) {
      cellDate = dateToISO(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, daysInPrevMonth + dayNum);
      otherMonth = true;
    } else if (dayNum > daysInMonth) {
      cellDate = dateToISO(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, dayNum - daysInMonth);
      otherMonth = true;
    } else {
      cellDate = dateToISO(year, month, dayNum);
    }

    const dayTasks = tasksByDate[cellDate] || [];
    const isToday = cellDate === today;
    const isOverdueDay = cellDate < today && dayTasks.length > 0;
    const classes = ['calendar-day'];
    if (otherMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isOverdueDay) classes.push('has-overdue');

    const dots = dayTasks.slice(0, 4).map((t) => `<span class="dot" style="background:var(--${t.priority === 'alta' ? 'red-600' : t.priority === 'media' ? 'amber-600' : 'green-600'})"></span>`).join('');
    const dayLabel = cellDate.slice(8, 10).replace(/^0/, '');

    html += `<button type="button" class="${classes.join(' ')}" data-date="${cellDate}">
      <span class="calendar-day-num">${dayLabel}</span>
      ${dots ? `<span class="calendar-dots">${dots}</span>` : ''}
    </button>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll('.calendar-day').forEach((cell) => {
    cell.addEventListener('click', () => openDayModal(cell.dataset.date));
  });
}

function openDayModal(dateISO) {
  const dayTasks = tasks.filter((t) => t.status !== 'concluida' && t.dueDate === dateISO);
  const [y, m, d] = dateISO.split('-');
  document.getElementById('day-modal-title').textContent = `${d}/${m}/${y}`;
  const container = document.getElementById('day-modal-list');
  if (dayTasks.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma tarefa com prazo neste dia.</div>';
  } else {
    container.innerHTML = dayTasks.map((t) => taskCardHtml(t)).join('');
    bindTaskCardEvents(container);
  }
  openModal('modal-day');
}

/* ================= TAREFAS ================= */
function wireTaskModal() {
  document.getElementById('form-task').addEventListener('submit', onSubmitTask);
  document.getElementById('task-delete').addEventListener('click', onDeleteTaskFromModal);
  document.getElementById('filter-status').addEventListener('change', renderTasks);
  document.getElementById('filter-priority').addEventListener('change', renderTasks);
  document.getElementById('sort-tasks').addEventListener('change', renderTasks);
  document.getElementById('filter-tag').addEventListener('change', renderTasks);
}

function populateBudgetLinkSelect(selectedId) {
  const select = document.getElementById('task-budget-link');
  select.innerHTML = '<option value="">Nenhum</option>';
  budgets.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.clientName;
    select.appendChild(opt);
  });
  select.value = selectedId && budgets.some((b) => b.id === selectedId) ? selectedId : '';
}

function populateTagFilterOptions() {
  const select = document.getElementById('filter-tag');
  if (!select) return;
  const current = select.value;
  const allTags = new Set();
  tasks.forEach((t) => (t.tags || []).forEach((tag) => allTags.add(tag)));
  select.innerHTML = '<option value="">Todas as etiquetas</option>' +
    [...allTags].sort().map((tag) => `<option value="${escapeHtml(tag)}">#${escapeHtml(tag)}</option>`).join('');
  if ([...allTags].includes(current)) select.value = current;
}

function openTaskModal(id) {
  const form = document.getElementById('form-task');
  form.reset();
  const deleteBtn = document.getElementById('task-delete');
  if (id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    document.getElementById('task-modal-title').textContent = 'Editar Tarefa';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-client').value = task.client || '';
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-due').value = task.dueDate || '';
    document.getElementById('task-status').value = task.status;
    document.getElementById('task-recurrence').value = task.recurrence || 'none';
    document.getElementById('task-tags').value = (task.tags || []).join(', ');
    populateBudgetLinkSelect(task.budgetId);
    currentTaskSubtasks = (task.subtasks || []).map((s) => ({ ...s }));
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('task-modal-title').textContent = 'Nova Tarefa';
    document.getElementById('task-id').value = '';
    document.getElementById('task-status').value = 'pendente';
    document.getElementById('task-recurrence').value = 'none';
    populateBudgetLinkSelect('');
    currentTaskSubtasks = [];
    deleteBtn.classList.add('hidden');
  }
  renderSubtaskList();
  openModal('modal-task');
}

function onSubmitTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;

  const newStatus = document.getElementById('task-status').value;
  const data = {
    title,
    client: document.getElementById('task-client').value.trim(),
    description: document.getElementById('task-description').value.trim(),
    priority: document.getElementById('task-priority').value,
    dueDate: document.getElementById('task-due').value,
    status: newStatus,
    recurrence: document.getElementById('task-recurrence').value,
    tags: parseTags(document.getElementById('task-tags').value),
    budgetId: document.getElementById('task-budget-link').value || '',
    subtasks: currentTaskSubtasks.map((s) => ({ ...s }))
  };

  let previousStatus = null;
  if (id) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      previousStatus = tasks[idx].status;
      tasks[idx] = { ...tasks[idx], ...data };
    }
  } else {
    tasks.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
  }
  saveTasks(tasks);
  closeModal('modal-task');

  if (newStatus === 'concluida' && previousStatus !== 'concluida') {
    maybeCreateRecurrence(data);
  }

  renderAll();
  showToast('Tarefa salva.');
}

function onDeleteTaskFromModal() {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (!window.confirm('Excluir esta tarefa? Ela ficará na lixeira e pode ser restaurada.')) return;
  moveTaskToTrash(task);
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  closeModal('modal-task');
  renderAll();
  showToast('Tarefa movida para a lixeira.');
}

function toggleTaskComplete(id, checked) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (checked) {
    task.statusBeforeComplete = task.status;
    task.status = 'concluida';
    maybeCreateRecurrence(task);
  } else {
    task.status = task.statusBeforeComplete || 'pendente';
    delete task.statusBeforeComplete;
  }
  saveTasks(tasks);
  renderAll();
}

function maybeCreateRecurrence(task) {
  if (!task.recurrence || task.recurrence === 'none') return;
  const nextDueDate = addInterval(task.dueDate, task.recurrence);
  tasks.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    title: task.title,
    client: task.client || '',
    description: task.description || '',
    priority: task.priority,
    dueDate: nextDueDate,
    status: 'pendente',
    recurrence: task.recurrence,
    tags: [...(task.tags || [])],
    budgetId: task.budgetId || '',
    subtasks: (task.subtasks || []).map((s) => ({ ...s, done: false }))
  });
  saveTasks(tasks);
  showToast(`🔁 Próxima ocorrência criada para ${formatDateBR(nextDueDate)}.`);
}

/* -------- Subtarefas (dentro do modal de tarefa) -------- */
function wireSubtasks() {
  document.getElementById('btn-add-subtask').addEventListener('click', () => {
    const input = document.getElementById('subtask-name');
    const title = input.value.trim();
    if (!title) return;
    currentTaskSubtasks.push({ id: uid(), title, done: false });
    input.value = '';
    renderSubtaskList();
  });
  document.getElementById('subtask-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-add-subtask').click();
    }
  });
}

function renderSubtaskList() {
  const listEl = document.getElementById('subtask-list');
  if (currentTaskSubtasks.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhuma subtarefa adicionada.</div>';
    return;
  }
  listEl.innerHTML = currentTaskSubtasks.map((s) => `
    <div class="doc-row" data-sub-id="${s.id}">
      <input type="checkbox" class="sub-check" data-sub-id="${s.id}" ${s.done ? 'checked' : ''}>
      <span class="doc-name ${s.done ? 'delivered' : ''}">${escapeHtml(s.title)}</span>
      <button type="button" class="doc-icon-btn doc-remove" data-sub-id="${s.id}" aria-label="Remover">&times;</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.sub-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      const sub = currentTaskSubtasks.find((s) => s.id === cb.dataset.subId);
      if (sub) sub.done = cb.checked;
      renderSubtaskList();
    });
  });
  listEl.querySelectorAll('.doc-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTaskSubtasks = currentTaskSubtasks.filter((s) => s.id !== btn.dataset.subId);
      renderSubtaskList();
    });
  });
}

function deleteTaskDirect(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (!window.confirm('Excluir esta tarefa? Ela ficará na lixeira e pode ser restaurada.')) return;
  moveTaskToTrash(task);
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  renderAll();
  showToast('Tarefa movida para a lixeira.');
}

function dueDateBucket(t) {
  if (isOverdue(t.dueDate, t.status)) return 'Atrasadas';
  if (!t.dueDate) return 'Sem prazo';
  const today = todayISO();
  const tomorrow = todayPlusDaysISO(1);
  const weekLimit = todayPlusDaysISO(7);
  if (t.dueDate === today) return 'Hoje';
  if (t.dueDate === tomorrow) return 'Amanhã';
  if (t.dueDate <= weekLimit) return 'Esta semana';
  return 'Mais tarde';
}

function renderTasks() {
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const sort = document.getElementById('sort-tasks').value;
  const tag = document.getElementById('filter-tag').value;

  let list = tasks.filter((t) => t.status !== 'concluida');
  if (status) list = list.filter((t) => t.status === status);
  if (priority) list = list.filter((t) => t.priority === priority);
  if (tag) list = list.filter((t) => (t.tags || []).includes(tag));

  const container = document.getElementById('tasks-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma tarefa encontrada.</div>';
    return;
  }

  if (sort === 'prazo') {
    list = list.slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    const bucketOrder = ['Atrasadas', 'Hoje', 'Amanhã', 'Esta semana', 'Mais tarde', 'Sem prazo'];
    const groups = {};
    list.forEach((t) => {
      const bucket = dueDateBucket(t);
      if (!groups[bucket]) groups[bucket] = [];
      groups[bucket].push(t);
    });
    let html = '';
    bucketOrder.forEach((bucket) => {
      if (!groups[bucket]) return;
      const headerClass = bucket === 'Atrasadas' ? 'group-header group-overdue' : 'group-header';
      html += `<div class="${headerClass}">${bucket}</div>`;
      html += groups[bucket].map((t) => taskCardHtml(t)).join('');
    });
    container.innerHTML = html;
  } else {
    list = list.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    container.innerHTML = list.map((t) => taskCardHtml(t)).join('');
  }
  bindTaskCardEvents(container);
}

function renderCompleted() {
  const list = tasks
    .filter((t) => t.status === 'concluida')
    .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
  const container = document.getElementById('completed-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma tarefa concluída ainda.</div>';
    return;
  }
  container.innerHTML = list.map((t) => taskCardHtml(t)).join('');
  bindTaskCardEvents(container);
}

function taskCardHtml(t) {
  const overdue = isOverdue(t.dueDate, t.status);
  const completed = t.status === 'concluida';
  const classes = ['item-card', `priority-${t.priority}`];
  if (overdue) classes.push('overdue');
  if (completed) classes.push('completed');
  const dueBadge = t.dueDate
    ? `<span class="badge badge-due ${overdue ? 'overdue-text' : ''}">${overdue ? '⚠️ ' : ''}Prazo: ${formatDateBR(t.dueDate)}</span>`
    : '';
  const recurrenceBadge = t.recurrence && t.recurrence !== 'none'
    ? `<span class="badge badge-due">🔁 ${RECURRENCE_LABELS[t.recurrence]}</span>` : '';
  const linkedBudget = t.budgetId ? budgets.find((b) => b.id === t.budgetId) : null;
  const linkBadge = linkedBudget ? `<span class="badge badge-link" data-open-budget="${linkedBudget.id}">📁 ${escapeHtml(linkedBudget.clientName)}</span>` : '';
  const tagBadges = (t.tags || []).map((tag) => `<span class="badge badge-tag">#${escapeHtml(tag)}</span>`).join('');
  const subtasks = t.subtasks || [];
  const subtaskBadge = subtasks.length > 0
    ? `<span class="badge badge-due">✓ ${subtasks.filter((s) => s.done).length}/${subtasks.length}</span>` : '';
  return `
  <div class="${classes.join(' ')}" data-id="${t.id}">
    <div class="item-top">
      <input type="checkbox" class="item-checkbox task-check" data-id="${t.id}" ${completed ? 'checked' : ''} aria-label="Concluir tarefa">
      <div class="item-title-wrap">
        <div class="item-title ${completed ? 'strike' : ''}">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="item-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="item-meta">
          <span class="badge badge-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
          <span class="badge badge-due">${STATUS_LABELS[t.status]}</span>
          ${dueBadge}
          ${subtaskBadge}
          ${recurrenceBadge}
          ${linkBadge}
          ${tagBadges}
        </div>
      </div>
    </div>
    <div class="item-actions">
      <button class="btn btn-secondary btn-sm task-edit" data-id="${t.id}">✏️ Editar</button>
      <button class="btn btn-primary btn-sm task-msg" data-id="${t.id}">✉️ Gerar mensagem</button>
      <button class="btn btn-danger btn-sm task-del" data-id="${t.id}">🗑️ Excluir</button>
    </div>
  </div>`;
}

function bindTaskCardEvents(container) {
  container.querySelectorAll('.task-check').forEach((cb) => {
    cb.addEventListener('change', () => toggleTaskComplete(cb.dataset.id, cb.checked));
  });
  container.querySelectorAll('.task-edit').forEach((btn) => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.id));
  });
  container.querySelectorAll('.task-del').forEach((btn) => {
    btn.addEventListener('click', () => deleteTaskDirect(btn.dataset.id));
  });
  container.querySelectorAll('.task-msg').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = tasks.find((t) => t.id === btn.dataset.id);
      if (task) openMessageModal(buildTaskMessage(task), '');
    });
  });
  container.querySelectorAll('[data-open-budget]').forEach((badge) => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openBudgetDetail(badge.dataset.openBudget);
    });
  });
}

/* ================= ORÇAMENTOS ================= */
function wireBudgetModal() {
  document.getElementById('form-budget').addEventListener('submit', onSubmitBudget);
  document.getElementById('budget-delete').addEventListener('click', onDeleteBudgetFromModal);
  document.getElementById('budget-search').addEventListener('input', renderBudgets);
  document.getElementById('budget-filter-status').addEventListener('change', renderBudgets);
}

function openBudgetModal(id) {
  const form = document.getElementById('form-budget');
  form.reset();
  const deleteBtn = document.getElementById('budget-delete');
  if (id) {
    const budget = budgets.find((b) => b.id === id);
    if (!budget) return;
    document.getElementById('budget-modal-title').textContent = 'Editar Orçamento';
    document.getElementById('budget-id').value = budget.id;
    document.getElementById('budget-client').value = budget.clientName;
    document.getElementById('budget-phone').value = budget.phone || '';
    document.getElementById('budget-description').value = budget.description || '';
    document.getElementById('budget-status').value = budget.status;
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('budget-modal-title').textContent = 'Novo Orçamento';
    document.getElementById('budget-id').value = '';
    deleteBtn.classList.add('hidden');
  }
  openModal('modal-budget');
}

function onSubmitBudget(e) {
  e.preventDefault();
  const id = document.getElementById('budget-id').value;
  const clientName = document.getElementById('budget-client').value.trim();
  if (!clientName) return;

  const data = {
    clientName,
    phone: document.getElementById('budget-phone').value.trim(),
    description: document.getElementById('budget-description').value.trim(),
    status: document.getElementById('budget-status').value
  };

  if (id) {
    const idx = budgets.findIndex((b) => b.id === id);
    if (idx !== -1) budgets[idx] = { ...budgets[idx], ...data };
  } else {
    budgets.push({ id: uid(), createdAt: new Date().toISOString(), documents: [], ...data });
  }
  saveBudgets(budgets);
  closeModal('modal-budget');
  renderAll();
  showToast('Orçamento salvo.');
}

function onDeleteBudgetFromModal() {
  const id = document.getElementById('budget-id').value;
  if (!id) return;
  const budget = budgets.find((b) => b.id === id);
  if (!budget) return;
  if (!window.confirm('Excluir este orçamento e sua checklist? Ele ficará na lixeira e pode ser restaurado.')) return;
  moveBudgetToTrash(budget);
  budgets = budgets.filter((b) => b.id !== id);
  saveBudgets(budgets);
  closeModal('modal-budget');
  renderAll();
  showToast('Orçamento movido para a lixeira.');
}

function deleteBudgetDirect(id) {
  const budget = budgets.find((b) => b.id === id);
  if (!budget) return;
  if (!window.confirm('Excluir este orçamento e sua checklist? Ele ficará na lixeira e pode ser restaurado.')) return;
  moveBudgetToTrash(budget);
  budgets = budgets.filter((b) => b.id !== id);
  saveBudgets(budgets);
  renderAll();
  showToast('Orçamento movido para a lixeira.');
}

function changeBudgetStatus(id, status) {
  const budget = budgets.find((b) => b.id === id);
  if (!budget) return;
  budget.status = status;
  saveBudgets(budgets);
  renderAll();
}

function renderBudgets() {
  const container = document.getElementById('budgets-list');
  if (budgets.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum orçamento cadastrado ainda.</div>';
    return;
  }
  const search = document.getElementById('budget-search').value.trim().toLowerCase();
  const status = document.getElementById('budget-filter-status').value;

  let list = budgets.slice();
  if (search) list = list.filter((b) => b.clientName.toLowerCase().includes(search));
  if (status) list = list.filter((b) => b.status === status);
  list = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum orçamento encontrado.</div>';
    return;
  }
  container.innerHTML = list.map((b) => budgetCardHtml(b)).join('');
  bindBudgetCardEvents(container);
}

function budgetCardHtml(b) {
  const docs = b.documents || [];
  const delivered = docs.filter((d) => d.delivered).length;
  const total = docs.length;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
  return `
  <div class="item-card" data-id="${b.id}">
    <div class="item-title-wrap">
      <div class="item-title">${escapeHtml(b.clientName)}</div>
      ${b.description ? `<div class="item-desc">${escapeHtml(b.description)}</div>` : ''}
      <div class="item-meta">
        <span class="badge badge-${b.status}">${BUDGET_STATUS_LABELS[b.status]}</span>
        ${b.phone ? `<span class="badge badge-due">📞 ${escapeHtml(b.phone)}</span>` : ''}
      </div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span class="progress-label">${delivered}/${total} documentos</span>
      </div>
    </div>
    <div class="item-actions">
      <select class="budget-status-select" data-id="${b.id}">
        <option value="aguardando" ${b.status === 'aguardando' ? 'selected' : ''}>Aguardando resposta</option>
        <option value="aceito" ${b.status === 'aceito' ? 'selected' : ''}>Aceito</option>
        <option value="recusado" ${b.status === 'recusado' ? 'selected' : ''}>Recusado</option>
      </select>
      <button class="btn btn-secondary btn-sm budget-checklist" data-id="${b.id}">📄 Checklist</button>
      <button class="btn btn-secondary btn-sm budget-edit" data-id="${b.id}">✏️ Editar</button>
      <button class="btn btn-primary btn-sm budget-msg" data-id="${b.id}">✉️ Gerar mensagem</button>
      <button class="btn btn-danger btn-sm budget-del" data-id="${b.id}">🗑️ Excluir</button>
    </div>
  </div>`;
}

function bindBudgetCardEvents(container) {
  container.querySelectorAll('.budget-status-select').forEach((sel) => {
    sel.addEventListener('change', () => changeBudgetStatus(sel.dataset.id, sel.value));
  });
  container.querySelectorAll('.budget-checklist').forEach((btn) => {
    btn.addEventListener('click', () => openBudgetDetail(btn.dataset.id));
  });
  container.querySelectorAll('.budget-edit').forEach((btn) => {
    btn.addEventListener('click', () => openBudgetModal(btn.dataset.id));
  });
  container.querySelectorAll('.budget-del').forEach((btn) => {
    btn.addEventListener('click', () => deleteBudgetDirect(btn.dataset.id));
  });
  container.querySelectorAll('.budget-msg').forEach((btn) => {
    btn.addEventListener('click', () => {
      const budget = budgets.find((b) => b.id === btn.dataset.id);
      if (budget) openMessageModal(buildBudgetMessage(budget), budget.phone || '');
    });
  });
}

/* -------- Detalhe do orçamento (checklist) -------- */
function wireBudgetDetailModal() {
  document.getElementById('form-doc-add').addEventListener('submit', onAddDocument);
  document.getElementById('budget-gen-message').addEventListener('click', () => {
    const budget = budgets.find((b) => b.id === currentBudgetDetailId);
    if (budget) openMessageModal(buildBudgetMessage(budget), budget.phone || '');
  });
}

function openBudgetDetail(id) {
  currentBudgetDetailId = id;
  const budget = budgets.find((b) => b.id === id);
  if (!budget) return;
  document.getElementById('budget-detail-title').textContent = `Checklist — ${budget.clientName}`;
  renderBudgetDetail();
  openModal('modal-budget-detail');
}

function renderBudgetDetail() {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  const docs = budget.documents || [];
  const delivered = docs.filter((d) => d.delivered).length;
  const total = docs.length;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  document.getElementById('budget-progress-fill').style.width = `${pct}%`;
  document.getElementById('budget-progress-label').textContent = `${delivered}/${total} documentos`;

  const listEl = document.getElementById('budget-doc-list');
  if (docs.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhum documento na checklist. Adicione abaixo.</div>';
  } else {
    listEl.innerHTML = docs.map((d) => `
      <div class="doc-row" data-doc-id="${d.id}">
        <input type="checkbox" class="doc-check" data-doc-id="${d.id}" ${d.delivered ? 'checked' : ''}>
        <span class="doc-name ${d.delivered ? 'delivered' : ''}">${escapeHtml(d.name)}</span>
        <input type="date" class="doc-date" data-doc-id="${d.id}" value="${d.date || ''}">
        <button class="doc-icon-btn doc-rename" data-doc-id="${d.id}" aria-label="Renomear">✏️</button>
        <button class="doc-icon-btn doc-remove" data-doc-id="${d.id}" aria-label="Remover">&times;</button>
      </div>
    `).join('');
  }

  listEl.querySelectorAll('.doc-check').forEach((cb) => {
    cb.addEventListener('change', () => toggleDocument(cb.dataset.docId, cb.checked));
  });
  listEl.querySelectorAll('.doc-date').forEach((inp) => {
    inp.addEventListener('change', () => setDocumentDate(inp.dataset.docId, inp.value));
  });
  listEl.querySelectorAll('.doc-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeDocument(btn.dataset.docId));
  });
  listEl.querySelectorAll('.doc-rename').forEach((btn) => {
    btn.addEventListener('click', () => renameDocument(btn.dataset.docId));
  });

  const linkedTasks = tasks.filter((t) => t.budgetId === budget.id && t.status !== 'concluida');
  const linkedContainer = document.getElementById('budget-linked-tasks');
  if (linkedTasks.length === 0) {
    linkedContainer.innerHTML = '<div class="empty-state">Nenhuma tarefa vinculada a este caso.</div>';
  } else {
    linkedContainer.innerHTML = linkedTasks.map((t) => taskCardHtml(t)).join('');
    bindTaskCardEvents(linkedContainer);
  }

  renderAll();
}

function onAddDocument(e) {
  e.preventDefault();
  const input = document.getElementById('doc-name');
  const name = input.value.trim();
  if (!name) return;
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  if (!budget.documents) budget.documents = [];
  budget.documents.push({ id: uid(), name, delivered: false, date: '' });
  saveBudgets(budgets);
  input.value = '';
  renderBudgetDetail();
}

function toggleDocument(docId, checked) {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  const doc = (budget.documents || []).find((d) => d.id === docId);
  if (!doc) return;
  doc.delivered = checked;
  if (checked && !doc.date) doc.date = todayISO();
  saveBudgets(budgets);
  renderBudgetDetail();
}

function setDocumentDate(docId, date) {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  const doc = (budget.documents || []).find((d) => d.id === docId);
  if (!doc) return;
  doc.date = date;
  saveBudgets(budgets);
}

function renameDocument(docId) {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  const doc = (budget.documents || []).find((d) => d.id === docId);
  if (!doc) return;
  const newName = window.prompt('Novo nome do documento:', doc.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) return;
  doc.name = trimmed;
  saveBudgets(budgets);
  renderBudgetDetail();
}

function wireDocTemplates() {
  const select = document.getElementById('doc-template-select');
  Object.keys(DOC_TEMPLATES).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const templateName = select.value;
    if (!templateName) return;
    applyDocTemplate(templateName);
    select.value = '';
  });
}

function applyDocTemplate(templateName) {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  const names = DOC_TEMPLATES[templateName] || [];
  if (!budget.documents) budget.documents = [];
  const existingNames = new Set(budget.documents.map((d) => d.name.toLowerCase()));
  let added = 0;
  names.forEach((name) => {
    if (existingNames.has(name.toLowerCase())) return;
    budget.documents.push({ id: uid(), name, delivered: false, date: '' });
    added += 1;
  });
  saveBudgets(budgets);
  renderBudgetDetail();
  showToast(added > 0 ? `${added} documento(s) adicionado(s) do modelo.` : 'Todos os documentos do modelo já estavam na checklist.');
}

function removeDocument(docId) {
  const budget = budgets.find((b) => b.id === currentBudgetDetailId);
  if (!budget) return;
  budget.documents = (budget.documents || []).filter((d) => d.id !== docId);
  saveBudgets(budgets);
  renderBudgetDetail();
}

/* ================= MENSAGENS ================= */
function wireMessageModal() {
  document.getElementById('msg-copy').addEventListener('click', () => {
    const text = document.getElementById('message-text').value;
    navigator.clipboard.writeText(text).then(
      () => showToast('Mensagem copiada.'),
      () => showToast('Não foi possível copiar automaticamente.')
    );
  });
  document.getElementById('msg-whatsapp').addEventListener('click', () => {
    const text = document.getElementById('message-text').value;
    const phone = document.getElementById('message-phone').value;
    window.open(buildWhatsAppUrl(text, phone), '_blank', 'noopener');
  });
  document.getElementById('msg-txt').addEventListener('click', () => {
    const text = document.getElementById('message-text').value;
    downloadTextFile(`mensagem-${todayISO()}.txt`, text);
  });
  document.getElementById('msg-pdf').addEventListener('click', () => {
    const text = document.getElementById('message-text').value;
    downloadPdfFile(`mensagem-${todayISO()}.pdf`, text);
  });
}

function openMessageModal(text, phone) {
  document.getElementById('message-text').value = text;
  document.getElementById('message-phone').value = phone || '';
  openModal('modal-message');
}

/* ================= SINCRONIZAÇÃO ================= */
const SYNC_STATUS_LABELS = {
  off: 'Desativada',
  connecting: 'Conectando...',
  online: 'Conectado — sincronizado ao vivo',
  offline: 'Sem conexão (dados salvos localmente)',
  error: 'Erro na conexão. Confira a configuração.'
};

function wireSyncUI() {
  window.onSyncStatusChange = updateSyncStatusUI;

  document.getElementById('btn-generate-sync-id').addEventListener('click', () => {
    document.getElementById('sync-id-input').value = generateSyncId();
  });

  document.getElementById('btn-connect-sync').addEventListener('click', onConnectSyncClick);
  document.getElementById('btn-disconnect-sync').addEventListener('click', () => {
    if (!window.confirm('Desconectar a sincronização? Os dados continuam salvos neste aparelho, mas param de se atualizar com os outros.')) return;
    disconnectSync();
    renderSyncPanel();
  });
  document.getElementById('btn-copy-sync-id').addEventListener('click', () => {
    const val = document.getElementById('sync-id-display').value;
    navigator.clipboard.writeText(val).then(() => showToast('ID copiado.'));
  });
  document.getElementById('btn-conflict-use-cloud').addEventListener('click', () => {
    if (window.__syncConflictResolve) window.__syncConflictResolve(true);
    closeModal('modal-sync-conflict');
  });
  document.getElementById('btn-conflict-use-local').addEventListener('click', () => {
    if (window.__syncConflictResolve) window.__syncConflictResolve(false);
    closeModal('modal-sync-conflict');
  });

  renderSyncPanel();
  updateSyncStatusUI(isSyncConfigured() ? 'connecting' : 'off');
}

function onConnectSyncClick() {
  const raw = document.getElementById('sync-config-input').value.trim();
  const syncId = document.getElementById('sync-id-input').value.trim();
  if (!raw || !syncId) {
    showToast('Preencha a configuração do Firebase e o ID de sincronização.');
    return;
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    showToast('Configuração inválida. Cole o objeto firebaseConfig completo (formato JSON).');
    return;
  }

  connectSync(config, syncId, (finish) => {
    openModal('modal-sync-conflict');
    window.__syncConflictResolve = (useCloud) => {
      finish(useCloud);
      renderSyncPanel();
      showToast(useCloud ? 'Usando os dados da nuvem.' : 'Enviando os dados deste aparelho para a nuvem.');
    };
  }).then(() => {
    renderSyncPanel();
    showToast('Sincronização conectada.');
  }).catch((e) => {
    console.error(e);
    showToast('Não foi possível conectar. Confira a configuração e o ID.');
  });
}

function renderSyncPanel() {
  const configured = isSyncConfigured();
  document.getElementById('sync-setup-form').classList.toggle('hidden', configured);
  document.getElementById('sync-connected-panel').classList.toggle('hidden', !configured);
  if (configured) {
    document.getElementById('sync-id-display').value = getSyncId();
  }
}

function updateSyncStatusUI(status) {
  const dot = document.getElementById('sync-status-dot');
  const text = document.getElementById('sync-status-text');
  if (!dot || !text) return;
  dot.className = `sync-dot sync-dot-${status}`;
  text.textContent = SYNC_STATUS_LABELS[status] || status;
}

/* ================= DADOS / BACKUP ================= */
function wireDataView() {
  document.getElementById('btn-export').addEventListener('click', () => {
    exportData();
    renderAll();
    showToast('Backup exportado.');
  });
  if (canShareBackup()) {
    const shareBtn = document.getElementById('btn-share');
    shareBtn.classList.remove('hidden');
    shareBtn.addEventListener('click', async () => {
      const shared = await shareBackup();
      if (shared) {
        renderAll();
        showToast('Backup compartilhado.');
      }
    });
  }
  document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importDataFromFile(file, () => {
      tasks = loadTasks();
      budgets = loadBudgets();
      trash = loadTrash();
      renderAll();
    });
    e.target.value = '';
  });
  document.getElementById('backup-reminder-btn').addEventListener('click', () => {
    switchView('data');
  });
  document.getElementById('backup-reminder-dismiss').addEventListener('click', () => {
    sessionStorage.setItem('lex_reminder_dismissed', '1');
    document.getElementById('backup-reminder').classList.add('hidden');
  });
}

function renderBackupReminder() {
  const lastExport = getLastExportAt();
  const infoEl = document.getElementById('last-export-info');
  const hasData = tasks.length > 0 || budgets.length > 0;

  if (!lastExport) {
    infoEl.textContent = 'Você ainda não exportou nenhum backup.';
  } else {
    const days = daysBetween(lastExport, new Date().toISOString());
    infoEl.textContent = days <= 0
      ? 'Último backup: hoje.'
      : `Último backup: há ${days} dia${days > 1 ? 's' : ''}.`;
  }

  const bannerEl = document.getElementById('backup-reminder');
  const dismissed = sessionStorage.getItem('lex_reminder_dismissed') === '1';
  if (dismissed || !hasData) {
    bannerEl.classList.add('hidden');
    return;
  }
  const daysSince = lastExport ? daysBetween(lastExport, new Date().toISOString()) : Infinity;
  if (!lastExport) {
    document.getElementById('backup-reminder-text').textContent = '💾 Você ainda não fez backup dos seus dados. Recomendamos exportar regularmente.';
    bannerEl.classList.remove('hidden');
  } else if (daysSince >= 14) {
    document.getElementById('backup-reminder-text').textContent = `💾 Já faz ${daysSince} dias desde o último backup. Que tal exportar de novo?`;
    bannerEl.classList.remove('hidden');
  } else {
    bannerEl.classList.add('hidden');
  }
}

/* ================= LIXEIRA ================= */
function moveTaskToTrash(task) {
  trash.push({ id: uid(), type: 'task', data: task, deletedAt: new Date().toISOString() });
  saveTrash(trash);
}

function moveBudgetToTrash(budget) {
  trash.push({ id: uid(), type: 'budget', data: budget, deletedAt: new Date().toISOString() });
  saveTrash(trash);
}

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

function permanentlyDeleteTrashItem(trashId) {
  if (!window.confirm('Excluir definitivamente? Esta ação não pode ser desfeita.')) return;
  trash = trash.filter((t) => t.id !== trashId);
  saveTrash(trash);
  renderAll();
  showToast('Item removido definitivamente.');
}

function renderTrash() {
  const container = document.getElementById('trash-list');
  if (trash.length === 0) {
    container.innerHTML = '<div class="empty-state">A lixeira está vazia.</div>';
    return;
  }
  const list = trash.slice().sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  container.innerHTML = list.map((entry) => {
    const name = entry.type === 'task' ? entry.data.title : entry.data.clientName;
    const typeLabel = entry.type === 'task' ? '📌 Tarefa' : '📁 Orçamento';
    return `
    <div class="item-card">
      <div class="item-title-wrap">
        <div class="item-title">${escapeHtml(name)}</div>
        <div class="trash-item-meta">${typeLabel} · excluído em ${formatDateBR(entry.deletedAt.slice(0, 10))}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm trash-restore" data-id="${entry.id}">↩️ Restaurar</button>
        <button class="btn btn-danger btn-sm trash-purge" data-id="${entry.id}">🗑️ Excluir definitivamente</button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.trash-restore').forEach((btn) => {
    btn.addEventListener('click', () => restoreTrashItem(btn.dataset.id));
  });
  container.querySelectorAll('.trash-purge').forEach((btn) => {
    btn.addEventListener('click', () => permanentlyDeleteTrashItem(btn.dataset.id));
  });
}

/* ================= QUADRO (KANBAN) ================= */
const BOARD_STATUSES = ['pendente', 'andamento', 'concluida'];

function setTaskStatus(id, status) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const wasConcluded = task.status === 'concluida';
  task.status = status;
  delete task.statusBeforeComplete;
  if (status === 'concluida' && !wasConcluded) maybeCreateRecurrence(task);
  saveTasks(tasks);
  renderAll();
}

function boardCardHtml(t) {
  const overdue = isOverdue(t.dueDate, t.status);
  const linkedBudget = t.budgetId ? budgets.find((b) => b.id === t.budgetId) : null;
  const dueBadge = t.dueDate
    ? `<span class="badge badge-due ${overdue ? 'overdue-text' : ''}">${overdue ? '⚠️ ' : ''}${formatDateBR(t.dueDate)}</span>` : '';
  const linkBadge = linkedBudget ? `<span class="badge badge-link">📁 ${escapeHtml(linkedBudget.clientName)}</span>` : '';
  const statusIdx = BOARD_STATUSES.indexOf(t.status);
  return `
  <div class="board-card priority-${t.priority}" data-id="${t.id}">
    <div class="board-card-title">${escapeHtml(t.title)}</div>
    <div class="item-meta">
      <span class="badge badge-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
      ${dueBadge}
      ${linkBadge}
    </div>
    <div class="board-card-actions">
      <button class="board-move-btn board-move-prev" data-id="${t.id}" data-status="${BOARD_STATUSES[statusIdx - 1] || ''}" ${statusIdx === 0 ? 'disabled' : ''} aria-label="Mover para trás">◀</button>
      <button class="btn btn-secondary btn-sm board-edit" data-id="${t.id}">✏️</button>
      <button class="board-move-btn board-move-next" data-id="${t.id}" data-status="${BOARD_STATUSES[statusIdx + 1] || ''}" ${statusIdx === BOARD_STATUSES.length - 1 ? 'disabled' : ''} aria-label="Mover para frente">▶</button>
    </div>
  </div>`;
}

function renderBoard() {
  const boardGrid = document.getElementById('view-board');
  if (!boardGrid) return;

  BOARD_STATUSES.forEach((status) => {
    const list = tasks.filter((t) => t.status === status);
    document.getElementById(`board-count-${status}`).textContent = list.length;
    const container = document.getElementById(`board-list-${status}`);
    container.innerHTML = list.length === 0
      ? '<div class="empty-state">Nada aqui.</div>'
      : list.map((t) => boardCardHtml(t)).join('');
  });

  boardGrid.querySelectorAll('.board-move-prev, .board-move-next').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled || !btn.dataset.status) return;
      setTaskStatus(btn.dataset.id, btn.dataset.status);
    });
  });
  boardGrid.querySelectorAll('.board-edit').forEach((btn) => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.id));
  });
}
