// Controlador principal da aplicação
let tasks = [];
let budgets = [];
let currentBudgetDetailId = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
  tasks = loadTasks();
  budgets = loadBudgets();

  wireNav();
  wireFab();
  wireTaskModal();
  wireBudgetModal();
  wireBudgetDetailModal();
  wireMessageModal();
  wireDataView();
  wireModalOverlayClicks();

  renderAll();
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderBudgets();
  renderCompleted();
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
    return;
  }
  container.innerHTML = highlights.map((t) => taskCardHtml(t)).join('');
  bindTaskCardEvents(container);
}

/* ================= TAREFAS ================= */
function wireTaskModal() {
  document.getElementById('form-task').addEventListener('submit', onSubmitTask);
  document.getElementById('task-delete').addEventListener('click', onDeleteTaskFromModal);
  document.getElementById('filter-status').addEventListener('change', renderTasks);
  document.getElementById('filter-priority').addEventListener('change', renderTasks);
  document.getElementById('sort-tasks').addEventListener('change', renderTasks);
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
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('task-modal-title').textContent = 'Nova Tarefa';
    document.getElementById('task-id').value = '';
    document.getElementById('task-status').value = 'pendente';
    deleteBtn.classList.add('hidden');
  }
  openModal('modal-task');
}

function onSubmitTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;

  const data = {
    title,
    client: document.getElementById('task-client').value.trim(),
    description: document.getElementById('task-description').value.trim(),
    priority: document.getElementById('task-priority').value,
    dueDate: document.getElementById('task-due').value,
    status: document.getElementById('task-status').value
  };

  if (id) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], ...data };
  } else {
    tasks.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
  }
  saveTasks(tasks);
  closeModal('modal-task');
  renderAll();
  showToast('Tarefa salva.');
}

function onDeleteTaskFromModal() {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  if (!window.confirm('Excluir esta tarefa definitivamente?')) return;
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  closeModal('modal-task');
  renderAll();
  showToast('Tarefa excluída.');
}

function toggleTaskComplete(id, checked) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (checked) {
    task.statusBeforeComplete = task.status;
    task.status = 'concluida';
  } else {
    task.status = task.statusBeforeComplete || 'pendente';
    delete task.statusBeforeComplete;
  }
  saveTasks(tasks);
  renderAll();
}

function deleteTaskDirect(id) {
  if (!window.confirm('Excluir esta tarefa definitivamente?')) return;
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  renderAll();
  showToast('Tarefa excluída.');
}

function renderTasks() {
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const sort = document.getElementById('sort-tasks').value;

  let list = tasks.filter((t) => t.status !== 'concluida');
  if (status) list = list.filter((t) => t.status === status);
  if (priority) list = list.filter((t) => t.priority === priority);

  if (sort === 'prazo') {
    list = list.slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  } else {
    list = list.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }

  const container = document.getElementById('tasks-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma tarefa encontrada.</div>';
    return;
  }
  container.innerHTML = list.map((t) => taskCardHtml(t)).join('');
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
  if (!window.confirm('Excluir este orçamento e sua checklist definitivamente?')) return;
  budgets = budgets.filter((b) => b.id !== id);
  saveBudgets(budgets);
  closeModal('modal-budget');
  renderAll();
  showToast('Orçamento excluído.');
}

function deleteBudgetDirect(id) {
  if (!window.confirm('Excluir este orçamento e sua checklist definitivamente?')) return;
  budgets = budgets.filter((b) => b.id !== id);
  saveBudgets(budgets);
  renderAll();
  showToast('Orçamento excluído.');
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

/* ================= DADOS / BACKUP ================= */
function wireDataView() {
  document.getElementById('btn-export').addEventListener('click', () => {
    exportData();
    showToast('Backup exportado.');
  });
  document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importDataFromFile(file, () => {
      tasks = loadTasks();
      budgets = loadBudgets();
      renderAll();
    });
    e.target.value = '';
  });
}
