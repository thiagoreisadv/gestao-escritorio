// Camada de persistência em localStorage
const STORAGE_KEYS = {
  TASKS: 'lex_tasks',
  BUDGETS: 'lex_budgets',
  CLIENTS: 'lex_clients',
  CLIENTS_MIGRATED: 'lex_clients_migrated',
  TRASH: 'lex_trash',
  LAST_EXPORT: 'lex_last_export',
  THEME: 'lex_theme'
};

function showStorageAlert(message) {
  const el = document.getElementById('storage-alert');
  if (!el) return;
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    console.error('Erro ao ler dados salvos', e);
    return fallback;
  }
}

function loadTasks() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.TASKS), []);
}

function loadBudgets() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.BUDGETS), []);
}

function saveTasks(tasks) {
  return persist(STORAGE_KEYS.TASKS, tasks);
}

function saveBudgets(budgets) {
  return persist(STORAGE_KEYS.BUDGETS, budgets);
}

function loadClients() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.CLIENTS), []);
}

function saveClients(clients) {
  return persist(STORAGE_KEYS.CLIENTS, clients);
}

function loadTrash() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.TRASH), []);
}

function saveTrash(trash) {
  return persist(STORAGE_KEYS.TRASH, trash);
}

function getLastExportAt() {
  return localStorage.getItem(STORAGE_KEYS.LAST_EXPORT) || '';
}

function setLastExportAt(iso) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_EXPORT, iso);
  } catch (e) {
    console.error('Não foi possível registrar a data do backup', e);
  }
}

function persist(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    showStorageAlert(null);
    if (key !== STORAGE_KEYS.TASKS && key !== STORAGE_KEYS.BUDGETS && key !== STORAGE_KEYS.TRASH && key !== STORAGE_KEYS.CLIENTS) return true;
    if (typeof window.syncNotifyLocalChange === 'function') window.syncNotifyLocalChange();
    return true;
  } catch (e) {
    console.error('Falha ao salvar dados', e);
    showStorageAlert('⚠️ Não foi possível salvar os dados (armazenamento cheio ou indisponível). Exporte um backup e libere espaço.');
    return false;
  }
}

function exportData() {
  const payload = buildBackupPayload();
  const nowIso = payload.exportedAt;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayISO();
  a.href = url;
  a.download = `backup-escritorio-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setLastExportAt(nowIso);
}

function buildBackupPayload() {
  return {
    exportedAt: new Date().toISOString(),
    tasks: loadTasks(),
    budgets: loadBudgets(),
    clients: loadClients(),
    trash: loadTrash()
  };
}

function canShareBackup() {
  if (!navigator.canShare || !window.File) return false;
  try {
    const testFile = new File(['{}'], 'teste.json', { type: 'application/json' });
    return navigator.canShare({ files: [testFile] });
  } catch (e) {
    return false;
  }
}

async function shareBackup() {
  const payload = buildBackupPayload();
  const stamp = todayISO();
  const file = new File([JSON.stringify(payload, null, 2)], `backup-escritorio-${stamp}.json`, { type: 'application/json' });
  try {
    await navigator.share({
      files: [file],
      title: 'Backup — Thiago Reis Advocacia',
      text: 'Backup dos dados do sistema de gestão. Importe este arquivo em "Dados e Backup" no outro aparelho.'
    });
    setLastExportAt(payload.exportedAt);
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') console.error('Falha ao compartilhar backup', e);
    return false;
  }
}

function importDataFromFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || (!Array.isArray(data.tasks) && !Array.isArray(data.budgets) && !Array.isArray(data.clients))) {
        showToast('Arquivo inválido.');
        return;
      }
      const confirmMsg = 'Importar este backup vai SUBSTITUIR todos os dados atuais. Deseja continuar?';
      if (!window.confirm(confirmMsg)) return;
      if (Array.isArray(data.tasks)) saveTasks(data.tasks);
      if (Array.isArray(data.budgets)) saveBudgets(data.budgets);
      if (Array.isArray(data.clients)) saveClients(data.clients);
      if (Array.isArray(data.trash)) saveTrash(data.trash);
      // Backups exportados antes da funcionalidade de Clientes podem não ter
      // `clientId` em tarefas/orçamentos. Como a migração só roda uma vez por
      // dispositivo, limpamos a flag para que ela seja reexecutada (via onDone)
      // e os dados recém-importados sejam vinculados corretamente.
      localStorage.removeItem(STORAGE_KEYS.CLIENTS_MIGRATED);
      showToast('Backup importado com sucesso.');
      if (typeof onDone === 'function') onDone();
    } catch (e) {
      console.error(e);
      showToast('Erro ao ler o arquivo. Verifique se é um backup válido.');
    }
  };
  reader.onerror = () => showToast('Erro ao ler o arquivo.');
  reader.readAsText(file);
}

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
