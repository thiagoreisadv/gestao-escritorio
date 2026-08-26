// Geração de mensagens/documentos a partir de tarefas e orçamentos

function buildTaskMessage(task) {
  const cliente = task.client && task.client.trim() ? task.client.trim() : '[cliente]';
  const linhas = [];
  linhas.push(`Olá ${cliente}, segue atualização sobre a tarefa "${task.title}":`);
  linhas.push('');
  if (task.description && task.description.trim()) {
    linhas.push(task.description.trim());
    linhas.push('');
  }
  linhas.push(`Status atual: ${STATUS_LABELS[task.status] || task.status}`);
  if (task.dueDate) linhas.push(`Prazo: ${formatDateBR(task.dueDate)}`);
  linhas.push('');
  linhas.push('Qualquer dúvida, estou à disposição.');
  return linhas.join('\n');
}

function buildBudgetMessage(budget) {
  const cliente = budget.clientName && budget.clientName.trim() ? budget.clientName.trim() : '[cliente]';
  const pendentes = (budget.documents || []).filter((d) => !d.delivered);
  const linhas = [];
  const descricao = budget.description && budget.description.trim() ? ` (${budget.description.trim()})` : '';
  linhas.push(`Olá ${cliente}, segue atualização sobre o seu caso${descricao}:`);
  linhas.push('');
  linhas.push(`Status do orçamento: ${BUDGET_STATUS_LABELS[budget.status] || budget.status}`);
  linhas.push('');
  if (pendentes.length > 0) {
    linhas.push('Para darmos continuidade, ainda precisamos dos seguintes documentos:');
    pendentes.forEach((d) => linhas.push(`- ${d.name}`));
    linhas.push('');
    linhas.push('Assim que possível, envie os documentos pendentes.');
  } else {
    linhas.push('Todos os documentos necessários já foram recebidos. Obrigado!');
  }
  linhas.push('');
  linhas.push('Qualquer dúvida, estou à disposição.');
  return linhas.join('\n');
}

function buildWhatsAppUrl(text, phone) {
  const encoded = encodeURIComponent(text);
  const digits = (phone || '').replace(/\D/g, '');
  if (digits) {
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
