// Funções utilitárias genéricas
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'concluida') return false;
  return dueDate < todayISO();
}

const PRIORITY_LABELS = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 };
const STATUS_LABELS = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' };
const BUDGET_STATUS_LABELS = { aguardando: 'Aguardando resposta', aceito: 'Aceito', recusado: 'Recusado' };
const RECURRENCE_LABELS = { none: 'Não repetir', daily: 'Diariamente', weekly: 'Semanalmente', monthly: 'Mensalmente', yearly: 'Anualmente' };

function addInterval(dueDateISO, recurrence) {
  const base = dueDateISO ? new Date(`${dueDateISO}T00:00:00`) : new Date();
  switch (recurrence) {
    case 'daily': base.setDate(base.getDate() + 1); break;
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
    case 'yearly': base.setFullYear(base.getFullYear() + 1); break;
    default: return dueDateISO;
  }
  base.setMinutes(base.getMinutes() - base.getTimezoneOffset());
  return base.toISOString().slice(0, 10);
}

function parseTags(str) {
  if (!str) return [];
  const seen = new Set();
  const result = [];
  str.split(',').forEach((part) => {
    const tag = part.trim().toLowerCase().replace(/^#/, '');
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  });
  return result;
}

const DOC_TEMPLATES = {
  'Ação Trabalhista': ['RG e CPF', 'Comprovante de residência', 'Carteira de trabalho (CTPS)', 'Contrato de trabalho', 'Holerites/contracheques', 'Termo de rescisão (se houver)'],
  'Divórcio Consensual': ['RG e CPF', 'Certidão de casamento atualizada', 'Comprovante de residência', 'CPF dos filhos (se houver)', 'Certidão de nascimento dos filhos', 'Proposta de partilha de bens'],
  'Inventário': ['RG e CPF do falecido', 'Certidão de óbito', 'RG e CPF dos herdeiros', 'Certidão de casamento do falecido', 'Documentos dos bens (imóveis, veículos, contas)', 'Certidão negativa de débitos'],
  'Contrato / Consultoria': ['RG e CPF ou CNPJ', 'Comprovante de endereço', 'Documentos da empresa (se PJ)', 'Minuta ou proposta prévia (se houver)']
};

function todayPlusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function daysBetween(isoA, isoB) {
  const msPerDay = 86400000;
  return Math.round((new Date(isoB) - new Date(isoA)) / msPerDay);
}

/* ---------------- Captura rápida (texto livre -> tarefa/orçamento) ---------------- */
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function nextWeekdayISO(targetDow) {
  const d = new Date();
  const currentDow = d.getDay();
  let diff = targetDow - currentDow;
  if (diff <= 0) diff += 7;
  return todayPlusDaysISO(diff);
}

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractDueDate(text) {
  const lower = stripAccents(text.toLowerCase());
  if (/\bhoje\b/.test(lower)) return todayISO();
  if (/\bdepois de amanha\b/.test(lower)) return todayPlusDaysISO(2);
  if (/\bamanha\b/.test(lower)) return todayPlusDaysISO(1);

  const emDiasMatch = lower.match(/\bem\s+(\d{1,2})\s+dias?\b/);
  if (emDiasMatch) return todayPlusDaysISO(parseInt(emDiasMatch[1], 10));

  for (let dow = 0; dow < WEEKDAY_NAMES.length; dow++) {
    if (lower.includes(stripAccents(WEEKDAY_NAMES[dow]))) return nextWeekdayISO(dow);
  }

  const dateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3] || new Date().getFullYear().toString();
    if (year.length === 2) year = `20${year}`;
    const candidate = `${year}-${month}-${day}`;
    if (!isNaN(new Date(candidate).getTime())) return candidate;
  }
  return '';
}

function extractPriority(text) {
  const lower = text.toLowerCase();
  if (/\burgente\b|\bprioridade alta\b|\bmuito importante\b/.test(lower)) return 'alta';
  if (/\bprioridade baixa\b|\bsem pressa\b|\bbaixa prioridade\b/.test(lower)) return 'baixa';
  return 'media';
}

function extractPhone(text) {
  const match = text.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[\s.-]?\d{4}/);
  if (!match) return '';
  const digits = match[0].replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11 ? digits : '';
}

function extractName(text) {
  const explicit = text.match(/\bcliente[:\s]+([A-ZÀ-Ú][\wÀ-ÿ]*(?:\s+[A-ZÀ-Ú][\wÀ-ÿ]*){0,3})/);
  if (explicit) return explicit[1].trim();
  const para = text.match(/\bpara\s+([A-ZÀ-Ú][\wÀ-ÿ]*(?:\s+[A-ZÀ-Ú][\wÀ-ÿ]*){0,3})/);
  if (para) return para[1].trim();
  return '';
}

function parseQuickCapture(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const budgetKeywords = ['orçamento', 'orçar', 'proposta', 'honorário', 'honorários', 'cobrar', 'r$', 'reais', 'novo cliente'];
  const isBudget = budgetKeywords.some((k) => lower.includes(k));

  const dueDate = extractDueDate(text);
  const priority = extractPriority(text);
  const phone = extractPhone(text);
  const name = extractName(text);
  const firstLine = text.split('\n')[0].trim();

  if (isBudget) {
    return {
      type: 'budget',
      fields: {
        clientName: name || firstLine.slice(0, 120) || 'Novo cliente',
        description: text,
        phone
      }
    };
  }

  return {
    type: 'task',
    fields: {
      title: (firstLine || text).slice(0, 120),
      description: text,
      client: name,
      priority,
      dueDate
    }
  };
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPdfFile(filename, content) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Biblioteca de PDF não carregada. Baixe como .txt.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48, marginY = 56, maxWidth = 500, lineHeight = 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(content, maxWidth);
  let y = marginY;
  const pageHeight = doc.internal.pageSize.getHeight();
  lines.forEach((line) => {
    if (y > pageHeight - marginY) {
      doc.addPage();
      y = marginY;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  });
  doc.save(filename);
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}
