const axios = require('axios');

// Simular webhook do Google Drive
async function simularWebhook(fileId, fileName, tipoEvento = 'modificado') {
  try {
    console.log(`=== SIMULANDO WEBHOOK: ${tipoEvento} ===`);
    console.log(`Arquivo: ${fileName} (ID: ${fileId})`);
    
    // Payload que o Google enviaria
    const payload = {
      changes: [
        {
          fileId: fileId,
          removed: tipoEvento === 'removido',
          time: new Date().toISOString()
        }
      ]
    };
    
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Enviar para o webhook local
    const response = await axios.post('http://localhost:3000/api/webhook/drive', payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Google-Webhook-Simulator/1.0'
      }
    });
    
    console.log('✅ Webhook processado com sucesso!');
    console.log('Resposta:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Erro ao simular webhook:', error.response?.data || error.message);
    throw error;
  }
}

// Simular diferentes tipos de eventos
async function simularEventos() {
  try {
    console.log('🎭 SIMULANDO EVENTOS DO DRIVE');
    console.log('================================');
    
    // Evento 1: Arquivo criado
    await simularWebhook(
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      'documento-novo.pdf',
      'criado'
    );
    
    console.log('\n--- Aguardando 2 segundos ---\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Evento 2: Arquivo modificado
    await simularWebhook(
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      'documento-novo.pdf',
      'modificado'
    );
    
    console.log('\n--- Aguardando 2 segundos ---\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Evento 3: Arquivo renomeado
    await simularWebhook(
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      'documento-renomeado.pdf',
      'renomeado'
    );
    
    console.log('\n--- Aguardando 2 segundos ---\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Evento 4: Arquivo removido
    await simularWebhook(
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      'documento-renomeado.pdf',
      'removido'
    );
    
    console.log('\n🎉 TODOS OS EVENTOS SIMULADOS COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ Erro ao simular eventos:', error);
  }
}

// Simular evento específico
async function simularEventoEspecifico(fileId, fileName, tipoEvento) {
  try {
    await simularWebhook(fileId, fileName, tipoEvento);
  } catch (error) {
    console.error('Erro:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length >= 3) {
    // Formato: node simular-webhook.js <fileId> <fileName> <tipoEvento>
    const [fileId, fileName, tipoEvento] = args;
    simularEventoEspecifico(fileId, fileName, tipoEvento);
  } else {
    // Simular todos os eventos
    simularEventos();
  }
}

module.exports = {
  simularWebhook,
  simularEventos,
  simularEventoEspecifico
}; 