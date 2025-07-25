const driveServiceJWT = require('./driveServiceJWT');
const calendarServiceJWT = require('./calendarServiceJWT');
const userService = require('./userService');
const userModel = require('../models/userModel');
const logModel = require('../models/logModel');
const cron = require('node-cron');

// Renovar webhooks automaticamente (Drive e Calendar)
exports.renovarWebhooksAutomaticamente = async () => {
  try {
    console.log('🔄 Iniciando renovação automática de webhooks...');
    
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL não configurada no ambiente');
    }

    const usuarios = await userModel.getAllUsers();
    console.log(`📋 Processando ${usuarios.length} usuários...`);

    let sucessos = 0;
    let erros = 0;

    for (const usuario of usuarios) {
      try {
        console.log(`🔄 Renovando webhooks para: ${usuario.email}`);

        // Renovar webhook do Drive
        const driveResult = await driveServiceJWT.registrarWebhookDriveJWT(
          usuario.email, 
          `${webhookUrl}/drive`
        );
        
        // Salvar canal do Drive
        if (driveResult.resourceId) {
          await userModel.saveDrivePageToken(
            usuario.email, 
            driveResult.resourceId, 
            driveResult.id, 
            driveResult.startPageToken || null
          );
        }

        // Renovar webhooks do Calendar (todos os calendários)
        const { getCalendarClient } = require('../config/googleJWT');
        const calendar = await getCalendarClient(usuario.email);
        const calendarsResponse = await calendar.calendarList.list();
        const calendars = calendarsResponse.data.items || [];

        for (const cal of calendars) {
          try {
            const calendarResult = await calendarServiceJWT.registrarWebhookCalendarJWT(
              usuario.email, 
              cal.id, 
              `${webhookUrl}/calendar`
            );
            
            // Salvar canal do Calendar
            if (calendarResult.resourceId) {
              await userModel.saveCalendarChannel(
                usuario.email, 
                calendarResult.resourceId, 
                calendarResult.id, 
                cal.id
              );
            }
          } catch (calendarError) {
            console.warn(`⚠️ Erro ao configurar webhook do Calendar ${cal.id}:`, calendarError.message);
          }
        }

        sucessos++;
        console.log(`✅ Webhooks renovados para: ${usuario.email}`);
        
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        erros++;
        console.error(`❌ Erro ao renovar webhooks para ${usuario.email}:`, error.message);
      }
    }

    console.log(`🎉 Renovação concluída: ${sucessos} sucessos, ${erros} erros`);
    return { sucessos, erros };
  } catch (error) {
    console.error('❌ Erro geral na renovação de webhooks:', error);
    throw error;
  }
};

// Forçar renovação manual de webhooks
exports.forcarRenovacaoWebhooks = async () => {
  try {
    console.log('Forçando renovação manual de webhooks...');
    return await exports.renovarWebhooksAutomaticamente();
  } catch (error) {
    console.error('Erro na renovação manual de webhooks:', error);
    throw error;
  }
};

// Verificar status dos webhooks
exports.verificarStatusWebhooks = async () => {
  try {
    const usuarios = await userService.getAllUsers();
    const status = [];

    for (const usuario of usuarios) {
      status.push({
        email: usuario.email,
        nome: usuario.nome,
        ativo: usuario.ativo,
        ultima_sincronizacao: usuario.ultima_sincronizacao,
        webhook_drive: 'Ativo',
        webhook_calendar: 'Desativado (temporariamente)'
      });
    }

    return status;
  } catch (error) {
    console.error('Erro ao verificar status dos webhooks:', error);
    throw error;
  }
}; 

// Agendamento automático de renovação de webhooks a cada 6 horas
function startWebhookRenewalScheduler() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Iniciando renovação automática de webhooks (agendado)...');
    try {
      await exports.renovarWebhooksAutomaticamente();
    } catch (error) {
      console.error('Erro na renovação automática agendada:', error.message);
    }
  });
  // Rodar imediatamente ao iniciar
  (async () => {
    try {
      await exports.renovarWebhooksAutomaticamente();
    } catch (error) {
      console.error('Erro na renovação automática inicial:', error.message);
    }
  })();
}

// Iniciar agendamento ao carregar o serviço
startWebhookRenewalScheduler(); 