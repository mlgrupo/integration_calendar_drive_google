const logModel = require('../models/logModel');
const webhookService = require('../services/webhookService');
const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');
const calendarServiceJWT = require('../services/calendarServiceJWT');
const pool = require('../config/database');

// Cache para evitar processamento duplicado de webhooks
const webhookCache = new Map();
const WEBHOOK_CACHE_TTL = 30000; // 30 segundos

// Função para verificar se webhook já foi processado recentemente
const isWebhookProcessed = (resourceId, channelId) => {
  const key = `${resourceId}-${channelId}`;
  const now = Date.now();
  const cached = webhookCache.get(key);
  
  if (cached && (now - cached.timestamp) < WEBHOOK_CACHE_TTL) {
    return true;
  }
  
  webhookCache.set(key, { timestamp: now });
  return false;
};

// Limpar cache antigo periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of webhookCache.entries()) {
    if (now - value.timestamp > WEBHOOK_CACHE_TTL) {
      webhookCache.delete(key);
    }
  }
}, 60000); // Limpar a cada minuto

// Webhook do Drive (AGORA USA JWT)
exports.driveWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK DRIVE RECEBIDO (JWT) ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));

    // Se for notificação do Google (body vazio, mas headers presentes)
    const resourceId = req.headers['x-goog-resource-id'];
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const messageNumber = req.headers['x-goog-message-number'];
    const pageTokenHeader = req.headers['x-goog-resource-uri']?.split('pageToken=')[1]?.replace(/[^0-9]/g, '');

    // Verificar se já foi processado recentemente
    if (isWebhookProcessed(resourceId, channelId)) {
      console.log('⚠️ Webhook do Drive já processado recentemente, ignorando...');
      return res.status(200).json({ sucesso: true, processado: false, motivo: 'já_processado' });
    }

    // Aqui você precisa mapear resourceId/channelId para o usuário correto
    // Exemplo: buscar no banco qual usuário está associado a esse canal/resourceId
    // Para simplificação, vamos assumir que você tem uma função buscarUsuarioPorResourceId(resourceId)
    let userEmail = await userModel.getUserByResourceId(resourceId);
    if (!userEmail) {
      userEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
      console.warn('Usuário do resourceId não encontrado, usando admin:', userEmail);
    }

    const { getDriveClient } = require('../config/googleJWT');
    const drive = await getDriveClient(userEmail);

    // Buscar o último pageToken salvo para esse usuário
    let lastPageToken = await userModel.getDrivePageToken(userEmail);
    if (!lastPageToken && pageTokenHeader) {
      lastPageToken = pageTokenHeader;
    }
    if (!lastPageToken) {
      // Se não encontrar, obter um novo
      const startPageTokenResponse = await drive.changes.getStartPageToken();
      lastPageToken = startPageTokenResponse.data.startPageToken;
    }

    // Buscar as mudanças
    const changes = await drive.changes.list({
      pageToken: lastPageToken
    });

    if (changes.data.changes && changes.data.changes.length > 0) {
      console.log(`🔄 Processando ${changes.data.changes.length} mudanças do Drive`);
      for (const change of changes.data.changes) {
        try {
          await driveServiceJWT.processarMudancaDriveJWT(change.fileId, userEmail);
        } catch (error) {
          console.error('Erro ao processar mudança do Drive:', error.message);
        }
      }
    } else {
      console.log('⚠️ Nenhuma mudança encontrada no Drive para este pageToken');
    }

    // Salvar o novo pageToken para o usuário
    if (changes.data.newStartPageToken) {
      await userModel.saveDrivePageToken(userEmail, resourceId, channelId, changes.data.newStartPageToken);
    }

    res.status(200).json({ sucesso: true, processado: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Erro geral ao processar webhook do Drive:', error);
    res.status(500).json({ erro: 'Falha ao processar webhook do Drive', detalhes: error.message, timestamp: new Date().toISOString() });
  }
};

// Webhook do Calendar (AGORA USA JWT)
exports.calendarWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK CALENDAR RECEBIDO (JWT) ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));

    // Verificar se é um desafio de verificação
    if (req.body && req.body.type === 'web_hook_challenge') {
      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Se for notificação do Google (body vazio, mas headers presentes)
    const resourceId = req.headers['x-goog-resource-id'];
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const messageNumber = req.headers['x-goog-message-number'];

    // Verificar se já foi processado recentemente
    if (isWebhookProcessed(resourceId, channelId)) {
      console.log('⚠️ Webhook do Calendar já processado recentemente, ignorando...');
      return res.status(200).json({ sucesso: true, processado: false, motivo: 'já_processado' });
    }

    // Buscar usuário pelo resourceId do canal
    let userEmail = await userModel.getUserByCalendarResourceId(resourceId);
    if (!userEmail) {
      userEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
      console.warn('Usuário do resourceId não encontrado, usando admin:', userEmail);
    }

    const { getCalendarClient } = require('../config/googleJWT');
    const calendar = await getCalendarClient(userEmail);

    // Buscar o calendarId associado ao canal
    const { rows } = await pool.query(
      'SELECT calendar_id FROM google.calendar_channels WHERE resource_id = $1',
      [resourceId]
    );
    const calendarId = rows[0]?.calendar_id || 'primary';

    // Buscar eventos atualizados desde a última sincronização
    const now = new Date();
    const timeMin = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Últimas 24 horas
    const timeMax = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // Próximos 7 dias

    try {
      const events = await calendar.events.list({
        calendarId: calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      if (events.data.items && events.data.items.length > 0) {
        console.log(`🔄 Processando ${events.data.items.length} eventos do Calendar`);
        for (const event of events.data.items) {
          try {
            await calendarServiceJWT.processarEventoCalendarJWT(event, userEmail, calendarId);
          } catch (error) {
            console.error('Erro ao processar evento do Calendar:', error.message);
            // Não re-throw para evitar loops infinitos
          }
        }
      } else {
        console.log('⚠️ Nenhum evento encontrado no Calendar para este período');
      }
    } catch (apiError) {
      console.error('❌ Erro ao buscar eventos da API do Calendar:', apiError.message);
      // Se der erro 403 (Forbidden), pode ser problema de permissão
      if (apiError.response && apiError.response.status === 403) {
        console.warn('⚠️ Erro 403 - Verificar permissões do usuário:', userEmail);
      }
    }

    res.status(200).json({ sucesso: true, processado: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Erro geral ao processar webhook do Calendar:', error);
    res.status(500).json({ erro: 'Falha ao processar webhook do Calendar', detalhes: error.message, timestamp: new Date().toISOString() });
  }
};

// Forçar renovação de webhooks
exports.forcarRenovacao = async (req, res) => {
  try {
    console.log('Forçando renovação de webhooks...');
    
    const resultado = await webhookService.forcarRenovacaoWebhooks();
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Renovação de webhooks executada com sucesso!',
      resultado 
    });
  } catch (error) {
    console.error('Erro ao forçar renovação de webhooks:', error);
    res.status(500).json({ 
      erro: 'Falha ao renovar webhooks', 
      detalhes: error.message 
    });
  }
};

// Renovar webhooks para TODOS os usuários manualmente
exports.renovarWebhooksTodos = async (req, res) => {
  try {
    console.log('🔄 Iniciando renovação manual de webhooks para TODOS os usuários...');
    
    // Responder imediatamente
    res.status(202).json({ 
      sucesso: true, 
      mensagem: 'Renovação de webhooks para todos os usuários iniciada em background.',
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
        const usuarios = await userModel.getAllUsers();
        
        console.log(`📋 Renovando webhooks para ${usuarios.length} usuários...`);
        
        let sucessos = 0;
        let erros = 0;
        const resultados = [];

        for (const usuario of usuarios) {
          try {
            console.log(`🔄 Renovando webhook para: ${usuario.email}`);
            
            // Renovar webhook do Drive
            const resultado = await driveServiceJWT.configurarWatchDriveJWT(
              usuario.email, 
              `${webhookUrl}/drive`
            );
            
            sucessos++;
            resultados.push({
              email: usuario.email,
              status: 'renovado',
              resultado: resultado
            });
            
            console.log(`✅ Webhook renovado para: ${usuario.email}`);
            
            // Pequena pausa para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            erros++;
            resultados.push({
              email: usuario.email,
              status: 'erro',
              erro: error.message
            });
            
            console.error(`❌ Erro ao renovar webhook para ${usuario.email}:`, error.message);
          }
        }

        console.log(`🎉 Renovação concluída: ${sucessos} renovados, ${erros} erros`);
        console.log('📊 Resultados detalhados:', resultados);
        
      } catch (error) {
        console.error('❌ Erro geral na renovação de webhooks:', error);
      }
    });
    
  } catch (error) {
    console.error('Erro ao iniciar renovação de webhooks:', error);
    res.status(500).json({ 
      erro: 'Falha ao iniciar renovação de webhooks', 
      detalhes: error.message 
    });
  }
};

// Verificar status dos webhooks
exports.verificarStatus = async (req, res) => {
  try {
    const status = await webhookService.verificarStatusWebhooks();
    
    res.json({ 
      sucesso: true, 
      status 
    });
  } catch (error) {
    console.error('Erro ao verificar status dos webhooks:', error);
    res.status(500).json({ 
      erro: 'Falha ao verificar status dos webhooks', 
      detalhes: error.message 
    });
  }
};

// Configurar webhook para um usuário específico
exports.configurarWebhookUsuario = async (req, res) => {
  try {
    const { email } = req.params;
    const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
    
    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório' });
    }

    console.log(`Configurando webhook para: ${email}`);
    
    // Configurar webhook do Drive
    const resultado = await driveServiceJWT.configurarWatchDriveJWT(email, `${webhookUrl}/drive`);
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Webhook configurado com sucesso!',
      email,
      webhookUrl: `${webhookUrl}/drive`,
      resultado 
    });
  } catch (error) {
    console.error('Erro ao configurar webhook:', error);
    res.status(500).json({ 
      erro: 'Falha ao configurar webhook', 
      detalhes: error.message 
    });
  }
};

// Configurar webhooks para TODOS os usuários automaticamente
exports.configurarWebhooksTodos = async (req, res) => {
  try {
    console.log('🚀 Iniciando configuração de webhooks para TODOS os usuários...');
    
    // Responder imediatamente
    res.status(202).json({ 
      sucesso: true, 
      mensagem: 'Configuração de webhooks para todos os usuários iniciada em background.',
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/webhook';
        const usuarios = await userModel.getAllUsers();
        
        console.log(`📋 Processando ${usuarios.length} usuários...`);
        
        let sucessos = 0;
        let erros = 0;
        const resultados = [];

        for (const usuario of usuarios) {
          try {
            console.log(`🔧 Configurando webhook para: ${usuario.email}`);
            
            // Configurar webhook do Drive
            const resultado = await driveServiceJWT.configurarWatchDriveJWT(
              usuario.email, 
              `${webhookUrl}/drive`
            );
            
            sucessos++;
            resultados.push({
              email: usuario.email,
              status: 'sucesso',
              resultado: resultado
            });
            
            console.log(`✅ Webhook configurado para: ${usuario.email}`);
            
            // Pequena pausa para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            erros++;
            resultados.push({
              email: usuario.email,
              status: 'erro',
              erro: error.message
            });
            
            console.error(`❌ Erro ao configurar webhook para ${usuario.email}:`, error.message);
          }
        }

        console.log(`🎉 Configuração concluída: ${sucessos} sucessos, ${erros} erros`);
        console.log('📊 Resultados detalhados:', resultados);
        
      } catch (error) {
        console.error('❌ Erro geral na configuração de webhooks:', error);
      }
    });
    
  } catch (error) {
    console.error('Erro ao iniciar configuração de webhooks:', error);
    res.status(500).json({ 
      erro: 'Falha ao iniciar configuração de webhooks', 
      detalhes: error.message 
    });
  }
}; 