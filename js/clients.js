// Módulo de Clientes: cadastro, listagem, detalhe e autocomplete

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
