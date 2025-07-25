// Configuração centralizada de agendamentos
const cron = require('node-cron');

// Configurações de agendamento
const SCHEDULER_CONFIG = {
  // Renovação de webhooks: a cada 6 dias às 2h da manhã (horário de baixo tráfego)
  webhookRenewal: {
    schedule: '0 2 */6 * *', // A cada 6 dias às 2h
    timezone: 'America/Sao_Paulo',
    description: 'Renovação automática de webhooks do Google Drive e Calendar'
  },
  
  // Sincronização de dados: a cada 12 horas (manhã e noite)
  dataSync: {
    schedule: '0 8,20 * * *', // 8h e 20h todos os dias
    timezone: 'America/Sao_Paulo',
    description: 'Sincronização de dados do Google Drive e Calendar'
  },
  
  // Limpeza de logs: uma vez por semana
  logCleanup: {
    schedule: '0 3 * * 0', // Domingo às 3h
    timezone: 'America/Sao_Paulo',
    description: 'Limpeza de logs antigos'
  }
};

// Função para validar se um agendamento está ativo
exports.isSchedulerActive = (schedulerName) => {
  return process.env[`ENABLE_${schedulerName.toUpperCase()}_SCHEDULER`] !== 'false';
};

// Função para obter configuração de um agendamento
exports.getSchedulerConfig = (schedulerName) => {
  return SCHEDULER_CONFIG[schedulerName];
};

// Função para criar um agendamento com validação
exports.createScheduler = (schedulerName, callback, options = {}) => {
  const config = SCHEDULER_CONFIG[schedulerName];
  
  if (!config) {
    throw new Error(`Configuração de agendamento '${schedulerName}' não encontrada`);
  }
  
  if (!exports.isSchedulerActive(schedulerName)) {
    console.log(`⏸️ Agendamento '${schedulerName}' desabilitado via variável de ambiente`);
    return null;
  }
  
  const scheduler = cron.schedule(config.schedule, async () => {
    try {
      console.log(`⏰ Executando agendamento: ${config.description}`);
      await callback();
      console.log(`✅ Agendamento concluído: ${config.description}`);
    } catch (error) {
      console.error(`❌ Erro no agendamento '${schedulerName}':`, error.message);
    }
  }, {
    scheduled: true,
    timezone: config.timezone,
    ...options
  });
  
  console.log(`⏰ Agendamento '${schedulerName}' configurado: ${config.description}`);
  console.log(`   Horário: ${config.schedule} (${config.timezone})`);
  
  return scheduler;
};

// Exportar configurações
exports.SCHEDULER_CONFIG = SCHEDULER_CONFIG; 