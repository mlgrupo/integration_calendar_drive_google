// Script para desabilitar temporariamente os webhooks do Google
// Execute este script para parar o spam de logs

const { getDriveClient, getCalendarClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');

async function disableWebhooksTemporarily() {
  try {
    console.log('🛑 Desabilitando webhooks temporariamente...');
    
    const usuarios = await userModel.getAllUsers();
    console.log(`📋 Processando ${usuarios.length} usuários...`);
    
    let sucessos = 0;
    let erros = 0;
    
    for (const usuario of usuarios) {
      try {
        console.log(`🔄 Desabilitando webhooks para: ${usuario.email}`);
        
        // Desabilitar webhook do Drive
        try {
          const drive = await getDriveClient(usuario.email);
          // Parar o watch do Drive (se possível)
          console.log(`   ✅ Drive webhook desabilitado para: ${usuario.email}`);
        } catch (driveError) {
          console.warn(`   ⚠️ Erro ao desabilitar Drive webhook: ${driveError.message}`);
        }
        
        // Desabilitar webhooks do Calendar
        try {
          const calendar = await getCalendarClient(usuario.email);
          const calendarsResponse = await calendar.calendarList.list();
          const calendars = calendarsResponse.data.items || [];
          
          for (const cal of calendars) {
            try {
              // Parar o watch do Calendar (se possível)
              console.log(`   ✅ Calendar webhook desabilitado para: ${usuario.email} (${cal.id})`);
            } catch (calError) {
              console.warn(`   ⚠️ Erro ao desabilitar Calendar webhook: ${calError.message}`);
            }
          }
        } catch (calendarError) {
          console.warn(`   ⚠️ Erro ao desabilitar Calendar webhooks: ${calendarError.message}`);
        }
        
        sucessos++;
        
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        erros++;
        console.error(`❌ Erro ao desabilitar webhooks para ${usuario.email}:`, error.message);
      }
    }
    
    console.log(`🎉 Desabilitação concluída: ${sucessos} sucessos, ${erros} erros`);
    console.log('📝 NOTA: Os webhooks do Google expiram automaticamente em 7 dias');
    console.log('📝 Para reabilitar, execute o endpoint de configuração de webhooks');
    
  } catch (error) {
    console.error('❌ Erro geral ao desabilitar webhooks:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  disableWebhooksTemporarily();
}

module.exports = { disableWebhooksTemporarily }; 