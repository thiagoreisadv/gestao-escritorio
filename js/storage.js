// Camada de persistência em localStorage
const STORAGE_KEYS = { TASKS: 'lex_tasks', BUDGETS: 'lex_budgets' };

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

function persist(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    showStorageAlert(null);
    return true;
  } catch (e) {
    console.error('Falha ao salvar dados', e);
    showStorageAlert('⚠️ Não foi possível salvar os dados (armazenamento cheio ou indisponível). Exporte um backup e libere espaço.');
    return false;
  }
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    tasks: loadTasks(),
    budgets: loadBudgets()
  };
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
}

function importDataFromFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || (!Array.isArray(data.tasks) && !Array.isArray(data.budgets))) {
        showToast('Arquivo inválido.');
        return;
      }
      const confirmMsg = 'Importar este backup vai SUBSTITUIR todos os dados atuais. Deseja continuar?';
      if (!window.confirm(confirmMsg)) return;
      if (Array.isArray(data.tasks)) saveTasks(data.tasks);
      if (Array.isArray(data.budgets)) saveBudgets(data.budgets);
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
