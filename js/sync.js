// Sincronização ao vivo entre dispositivos via Firebase Firestore (opcional)
const SYNC_KEYS = { CONFIG: 'lex_sync_config', SYNC_ID: 'lex_sync_id' };

let syncApp = null;
let syncDb = null;
let syncUnsubscribe = null;
let syncApplyingRemote = false;
let syncPushTimer = null;
let syncStatus = 'off'; // off | connecting | online | offline | error

function getSyncConfig() {
  const raw = localStorage.getItem(SYNC_KEYS.CONFIG);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getSyncId() {
  return localStorage.getItem(SYNC_KEYS.SYNC_ID) || '';
}

function generateSyncId() {
  return 'esc-' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

function isSyncConfigured() {
  return !!(getSyncConfig() && getSyncId());
}

function setSyncStatus(status) {
  syncStatus = status;
  if (typeof window.onSyncStatusChange === 'function') window.onSyncStatusChange(status);
}

function initSync() {
  if (!isSyncConfigured()) return;
  const config = getSyncConfig();
  const syncId = getSyncId();
  try {
    connectSyncInternal(config, syncId);
  } catch (e) {
    console.error('Falha ao iniciar sincronização', e);
    setSyncStatus('error');
  }
}

function connectSyncInternal(config, syncId) {
  setSyncStatus('connecting');
  if (!syncApp) {
    syncApp = firebase.initializeApp(config);
  }
  syncDb = firebase.firestore();

  firebase.auth().signInAnonymously().then(() => {
    attachSyncListener(syncId);
  }).catch((e) => {
    console.error('Falha na autenticação anônima do Firebase', e);
    setSyncStatus('error');
  });
}

function attachSyncListener(syncId) {
  const docRef = syncDb.collection('escritorio-sync').doc(syncId);
  if (syncUnsubscribe) syncUnsubscribe();
  syncUnsubscribe = docRef.onSnapshot(
    (snapshot) => {
      setSyncStatus('online');
      if (snapshot.metadata.hasPendingWrites) return;
      const data = snapshot.data();
      if (!data) return;
      applyRemoteData(data);
    },
    (error) => {
      console.error('Erro na sincronização', error);
      setSyncStatus('error');
    }
  );
}

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

function syncNotifyLocalChange() {
  if (!isSyncConfigured() || syncApplyingRemote) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushToCloud, 700);
}
window.syncNotifyLocalChange = syncNotifyLocalChange;

function pushToCloud() {
  if (!syncDb) return;
  const syncId = getSyncId();
  if (!syncId) return;
  const payload = {
    tasks: loadTasks(),
    budgets: loadBudgets(),
    clients: loadClients(),
    trash: loadTrash(),
    updatedAt: new Date().toISOString()
  };
  syncDb.collection('escritorio-sync').doc(syncId).set(payload).catch((e) => {
    console.error('Falha ao enviar dados para a nuvem', e);
    setSyncStatus('error');
  });
}

function connectSync(config, syncId, onConflict) {
  localStorage.setItem(SYNC_KEYS.CONFIG, JSON.stringify(config));
  localStorage.setItem(SYNC_KEYS.SYNC_ID, syncId);

  setSyncStatus('connecting');
  if (!syncApp) {
    syncApp = firebase.initializeApp(config);
  }
  syncDb = firebase.firestore();

  return firebase.auth().signInAnonymously().then(() => {
    const docRef = syncDb.collection('escritorio-sync').doc(syncId);
    return docRef.get();
  }).then((snapshot) => {
    const remote = snapshot.exists ? snapshot.data() : null;
    const localHasData = loadTasks().length > 0 || loadBudgets().length > 0 || loadClients().length > 0;
    const remoteHasData = remote && (remote.tasks || []).length + (remote.budgets || []).length + (remote.clients || []).length > 0;

    return new Promise((resolve) => {
      const finish = (useRemote) => {
        if (useRemote && remote) {
          applyRemoteData(remote);
        } else {
          pushToCloud();
        }
        attachSyncListener(syncId);
        resolve(useRemote);
      };

      if (localHasData && remoteHasData && typeof onConflict === 'function') {
        onConflict(finish);
      } else if (remoteHasData) {
        finish(true);
      } else {
        finish(false);
      }
    });
  });
}

function disconnectSync() {
  if (syncUnsubscribe) syncUnsubscribe();
  syncUnsubscribe = null;
  localStorage.removeItem(SYNC_KEYS.CONFIG);
  localStorage.removeItem(SYNC_KEYS.SYNC_ID);
  setSyncStatus('off');
}
