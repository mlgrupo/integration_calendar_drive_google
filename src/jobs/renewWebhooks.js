const cron = require('node-cron');
const webhookService = require('../services/webhookService');

// Função para renovar webhooks
exports.renewWebhooks = async () => {
  try {
    console.log('Executando renovação automática de webhooks...');
    const resultado = await webhookService.renovarWebhooksAutomaticamente();
    console.log('Renovação automática concluída:', resultado);
    return resultado;
  } catch (error) {
    console.error('Erro na renovação automática de webhooks:', error);
    throw error;
  }
};

// Agendar renovação automática a cada 6 dias
exports.scheduleWebhookRenewal = () => {
  // Executar a cada 6 dias às 2h da manhã
  cron.schedule('0 2 */6 * *', async () => {
    try {
      await exports.renewWebhooks();
    } catch (error) {
      console.error('Erro no job agendado de renovação de webhooks:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  });

  console.log('Job de renovação automática de webhooks agendado (a cada 6 dias às 2h)');
};

// Iniciar agendamento
exports.initScheduledJobs = () => {
  exports.scheduleWebhookRenewal();
}; 