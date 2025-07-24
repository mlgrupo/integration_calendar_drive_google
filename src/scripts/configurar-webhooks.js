const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');
const logModel = require('../models/logModel');

// Configurar webhooks para todos os usuários
async function configurarWebhooksParaTodos() {
  try {
    console.log('=== CONFIGURANDO WEBHOOKS PARA TODOS OS USUÁRIOS ===');
    
    // Buscar todos os usuários
    const usuarios = await userModel.getAllUsers();
    console.log(`Encontrados ${usuarios.length} usuários`);
    
    const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
    let sucessos = 0;
    let erros = 0;
    
    for (const usuario of usuarios) {
      try {
        console.log(`\n--- Configurando webhook para: ${usuario.email} ---`);
        
        // Configurar webhook do Drive
        const resultado = await driveServiceJWT.configurarWatchDriveJWT(
          usuario.email, 
          `${webhookUrl}/drive`
        );
        
        console.log('✅ Webhook configurado:', resultado);
        sucessos++;
        
        // Registrar log
        await logModel.logAuditoria({
          usuario_id: usuario.id,
          acao: 'webhook_config',
          recurso_tipo: 'webhook',
          recurso_id: usuario.email,
          detalhes: `Webhook configurado com sucesso: ${resultado.id}`,
          ip_origem: null,
          user_agent: null,
          timestamp_evento: new Date()
        });
        
      } catch (error) {
        console.error(`❌ Erro ao configurar webhook para ${usuario.email}:`, error.message);
        erros++;
        
        // Registrar erro no log
        await logModel.logAuditoria({
          usuario_id: usuario.id,
          acao: 'webhook_config_error',
          recurso_tipo: 'webhook',
          recurso_id: usuario.email,
          detalhes: `Erro ao configurar webhook: ${error.message}`,
          ip_origem: null,
          user_agent: null,
          timestamp_evento: new Date()
        });
      }
    }
    
    console.log(`\n=== CONFIGURAÇÃO CONCLUÍDA ===`);
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📊 Total: ${usuarios.length}`);
    
    return { sucessos, erros, total: usuarios.length };
    
  } catch (error) {
    console.error('Erro geral ao configurar webhooks:', error);
    throw error;
  }
}

// Testar webhook para um usuário específico
async function testarWebhookUsuario(email) {
  try {
    console.log(`=== TESTANDO WEBHOOK PARA: ${email} ===`);
    
    const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
    
    // Configurar webhook
    const resultado = await driveServiceJWT.configurarWatchDriveJWT(
      email, 
      `${webhookUrl}/drive`
    );
    
    console.log('✅ Webhook configurado:', resultado);
    
    // Simular uma mudança para testar
    console.log('\n--- Simulando mudança para testar webhook ---');
    const mudancaTeste = await driveServiceJWT.processarMudancaDriveJWT('test-file-id', email);
    
    console.log('✅ Mudança simulada processada:', mudancaTeste);
    
    return { webhook: resultado, teste: mudancaTeste };
    
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--test') {
    const email = args[1] || 'leorosso@reconectaoficial.com.br';
    testarWebhookUsuario(email)
      .then(resultado => {
        console.log('Teste concluído:', resultado);
        process.exit(0);
      })
      .catch(error => {
        console.error('Erro no teste:', error);
        process.exit(1);
      });
  } else {
    configurarWebhooksParaTodos()
      .then(resultado => {
        console.log('Configuração concluída:', resultado);
        process.exit(0);
      })
      .catch(error => {
        console.error('Erro na configuração:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  configurarWebhooksParaTodos,
  testarWebhookUsuario
}; 