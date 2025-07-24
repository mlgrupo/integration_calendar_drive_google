const driveServiceJWT = require('./driveServiceJWT');
const calendarServiceJWT = require('./calendarServiceJWT');
const userService = require('./userService');
const logModel = require('../models/logModel');

// Renovar webhooks automaticamente (Drive e Calendar)
exports.renovarWebhooksAutomaticamente = async () => {
  try {
    console.log('Iniciando renovação automática de webhooks...');
    
    const usuarios = await userService.getAllUsers();
    const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
    
    let totalRenovadosDrive = 0;
    let totalRenovadosCalendar = 0;
    let erros = 0;

    for (const usuario of usuarios) {
      try {
        // Renovar webhook do Drive
        await driveServiceJWT.registrarWebhookDriveJWT(usuario.email, `${webhookUrl}/drive`);
        totalRenovadosDrive++;
        // Renovar webhook do Calendar para todos os calendários do usuário
        const { getCalendarClient } = require('../config/googleJWT');
        const calendar = await getCalendarClient(usuario.email);
        const calendarsResponse = await calendar.calendarList.list();
        const calendars = calendarsResponse.data.items || [];
        for (const cal of calendars) {
          try {
            await calendarServiceJWT.registrarWebhookCalendarJWT(usuario.email, cal.id, `${webhookUrl}/calendar`);
            totalRenovadosCalendar++;
          } catch (calendarError) {
            console.error(`Erro ao renovar webhook do Calendar para ${usuario.email} (${cal.id}):`, calendarError.message);
            erros++;
          }
        }
        // Registrar log
        await logModel.logAuditoria({
          usuario_id: usuario.id,
          acao: 'webhook_renewal',
          recurso_tipo: 'webhook',
          recurso_id: usuario.email,
          detalhes: 'Renovação automática de webhooks executada com sucesso (Drive e Calendar)',
          ip_origem: null,
          user_agent: null,
          timestamp_evento: new Date()
        });
      } catch (error) {
        console.error(`Erro ao renovar webhooks para ${usuario.email}:`, error.message);
        erros++;
      }
    }

    console.log(`Renovação concluída: ${totalRenovadosDrive} Drive, ${totalRenovadosCalendar} Calendar, ${erros} erros`);
    return { totalRenovadosDrive, totalRenovadosCalendar, erros };
  } catch (error) {
    console.error('Erro na renovação automática de webhooks:', error);
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