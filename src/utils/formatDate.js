exports.formatDate = (date) => {
  return new Date(date).toISOString();
};

// Função para converter horários para fuso de São Paulo (UTC-3)
exports.converterParaSP = (dateTimeString) => {
  if (!dateTimeString) return null;
  
  // Se já tem timezone, usar como está
  if (dateTimeString.includes('T') && (dateTimeString.includes('Z') || dateTimeString.includes('+') || dateTimeString.includes('-'))) {
    return new Date(dateTimeString);
  }
  
  // Se não tem timezone, assumir que é UTC e converter para SP
  const utcDate = new Date(dateTimeString + 'Z');
  const spDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
  return spDate;
};

// Função para formatar data no fuso de São Paulo
exports.formatarDataSP = (date) => {
  if (!date) return null;
  
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(date));
};

// Função para obter data atual no fuso de São Paulo
exports.dataAtualSP = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
}; 