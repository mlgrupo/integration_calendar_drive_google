const logModel = require('../models/logModel');
const webhookService = require('../services/webhookService');
const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');
const calendarServiceJWT = require('../services/calendarServiceJWT');
const pool = require('../config/database');

// Cache para mudanças já processadas (evita reprocessar a mesma mudança)
const processedChangesCache = new Map();
const CHANGES_CACHE_TTL = 600000; // 10 minutos

// Cache para mudanças triviais (ignora por 1 hora)
const trivialChangesCache = new Map();
const TRIVIAL_CACHE_TTL = 3600000; // 1 hora

// Função para verificar se uma mudança específica já foi processada
const isChangeProcessed = (changeId, resourceId) => {
  const key = `${resourceId}-${changeId}`;
  const now = Date.now();
  const cached = processedChangesCache.get(key);
  
  if (cached && (now - cached.timestamp) < CHANGES_CACHE_TTL) {
    return true;
  }
  
  processedChangesCache.set(key, { timestamp: now });
  return false;
};

// Função para verificar se é uma mudança trivial
const isTrivialChange = (change, resourceId) => {
  const key = `${resourceId}-${change.changeId}-trivial`;
  const now = Date.now();
  const cached = trivialChangesCache.get(key);
  
  if (cached && (now - cached.timestamp) < TRIVIAL_CACHE_TTL) {
    return true;
  }
  
  // Verificar se é uma mudança trivial
  const isTrivial = (
    // Mudanças apenas de metadados (sem alteração de conteúdo)
    (change.file && !change.file.modifiedTime) ||
    // Mudanças apenas de timestamp
    (change.file && change.file.modifiedTime && !change.file.size && !change.file.name) ||
    // Mudanças apenas de permissões (sem alteração de conteúdo)
    (change.file && change.file.permissions && !change.file.modifiedTime) ||
    // Mudanças apenas de labels/estrelas
    (change.file && change.file.starred !== undefined && !change.file.modifiedTime)
  );
  
  if (isTrivial) {
    console.log(`🔍 Mudança trivial detectada: ${change.changeId} - ignorando por 1 hora`);
    trivialChangesCache.set(key, { timestamp: now });
    return true;
  }
  
  return false;
};

// Função para determinar se uma mudança é significativa
const isSignificantChange = (change) => {
  // Mudanças significativas
  const significant = (
    // Arquivo criado
    (change.file && !change.removed) ||
    // Arquivo removido
    (change.removed && change.fileId) ||
    // Arquivo modificado (com mudanças reais)
    (change.file && change.file.modifiedTime && (
      change.file.size !== undefined ||
      change.file.name !== undefined ||
      change.file.mimeType !== undefined ||
      change.file.parents !== undefined
    )) ||
    // Mudança de pasta
    (change.file && change.file.mimeType === 'application/vnd.google-apps.folder')
  );
  
  return significant;
};

// Limpar caches antigos periodicamente
setInterval(() => {
  const now = Date.now();
  
  // Limpar changes cache
  for (const [key, value] of processedChangesCache.entries()) {
    if (now - value.timestamp > CHANGES_CACHE_TTL) {
      processedChangesCache.delete(key);
    }
  }
  
  // Limpar trivial changes cache
  for (const [key, value] of trivialChangesCache.entries()) {
    if (now - value.timestamp > TRIVIAL_CACHE_TTL) {
      trivialChangesCache.delete(key);
    }
  }
}, 60000); // Limpar a cada minuto

// Webhook do Drive - SEM CACHE DE WEBHOOK
exports.driveWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK DRIVE RECEBIDO ===');
    
    const resourceId = req.headers['x-goog-resource-id'];
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const messageNumber = req.headers['x-goog-message-number'];

    // SEMPRE responder 200 para o Google (não ignorar webhooks)
    res.status(200).json({ 
      sucesso: true, 
      processado: true, 
      timestamp: new Date().toISOString() 
    });

    // Buscar usuário pelo resourceId
    let userEmail = await userModel.getUserByResourceId(resourceId);
    if (!userEmail) {
      userEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
      console.warn('Usuário do resourceId não encontrado, usando admin:', userEmail);
    }

    const { getDriveClient } = require('../config/googleJWT');
    const drive = await getDriveClient(userEmail);

    // Buscar o último pageToken salvo para esse usuário
    let lastPageToken = await userModel.getDrivePageToken(userEmail);
    if (!lastPageToken) {
      const startPageTokenResponse = await drive.changes.getStartPageToken();
      lastPageToken = startPageTokenResponse.data.startPageToken;
    }

    // Buscar TODAS as mudanças (sem limite)
    const changes = await drive.changes.list({
      pageToken: lastPageToken,
      includeItemsFromAllDrives: false,
      supportsAllDrives: false
    });

    if (changes.data.changes && changes.data.changes.length > 0) {
      console.log(`🔍 Analisando ${changes.data.changes.length} mudanças do Drive`);
      
      let mudancasProcessadas = 0;
      let mudancasIgnoradas = 0;
      let mudancasTriviais = 0;
      
      for (const change of changes.data.changes) {
        try {
          // Verificar se esta mudança específica já foi processada
          if (isChangeProcessed(change.changeId, resourceId)) {
            mudancasIgnoradas++;
            continue;
          }

          // Verificar se é uma mudança trivial
          if (isTrivialChange(change, resourceId)) {
            mudancasTriviais++;
            continue;
          }

          // Verificar se é uma mudança significativa
          if (isSignificantChange(change)) {
            console.log(`✅ Mudança significativa detectada: ${change.changeId}`);
            
            if (change.fileId && change.file) {
              await driveServiceJWT.processarArquivoDriveJWT(change.file, userEmail);
              mudancasProcessadas++;
            } else if (change.fileId && change.removed) {
              await driveServiceJWT.marcarArquivoComoDeletado(change.fileId, userEmail);
              mudancasProcessadas++;
            }
          } else {
            console.log(`⚠️ Mudança não significativa ignorada: ${change.changeId}`);
            mudancasIgnoradas++;
          }
        } catch (error) {
          console.error('Erro ao processar mudança do Drive:', error.message);
        }
      }
      
      console.log(`📊 Drive: ${mudancasProcessadas} processadas, ${mudancasIgnoradas} ignoradas, ${mudancasTriviais} triviais`);
      
      // Salvar o novo pageToken
      if (changes.data.newStartPageToken) {
        await userModel.saveDrivePageToken(userEmail, changes.data.newStartPageToken);
      }
    } else {
      console.log('⚠️ Nenhuma mudança encontrada no Drive');
    }
  } catch (error) {
    console.error('❌ Erro geral ao processar webhook do Drive:', error);
    // Não re-throw para não quebrar o webhook
  }
};

// Webhook do Calendar - SEM CACHE DE WEBHOOK
exports.calendarWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK CALENDAR RECEBIDO ===');
    
    const resourceId = req.headers['x-goog-resource-id'];
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];

    // SEMPRE responder 200 para o Google (não ignorar webhooks)
    res.status(200).json({ 
      sucesso: true, 
      processado: true, 
      timestamp: new Date().toISOString() 
    });

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

    // Buscar eventos modificados recentemente (últimas 4 horas)
    const now = new Date();
    const timeMin = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // Últimas 4 horas
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
        console.log(`🔍 Analisando ${events.data.items.length} eventos do Calendar`);
        
        let eventosProcessados = 0;
        let eventosIgnorados = 0;
        
        for (const event of events.data.items) {
          try {
            // Verificar se este evento específico já foi processado recentemente
            const eventKey = `${resourceId}-${event.id}-${event.updated}`;
            if (isChangeProcessed(eventKey, resourceId)) {
              eventosIgnorados++;
              continue;
            }
            
            // Verificar se é um evento significativo (não apenas mudança de metadados)
            const isSignificantEvent = (
              event.status !== 'cancelled' && // Não processar eventos cancelados
              event.start && event.end && // Deve ter início e fim
              (event.summary || event.description) // Deve ter título ou descrição
            );
            
            if (isSignificantEvent) {
              console.log(`✅ Evento significativo: ${event.summary || event.id}`);
              await calendarServiceJWT.processarEventoCalendarJWT(event, userEmail, calendarId);
              eventosProcessados++;
            } else {
              console.log(`⚠️ Evento não significativo ignorado: ${event.id}`);
              eventosIgnorados++;
            }
          } catch (error) {
            console.error('Erro ao processar evento do Calendar:', error.message);
          }
        }
        
        console.log(`📊 Calendar: ${eventosProcessados} processados, ${eventosIgnorados} ignorados`);
      } else {
        console.log('⚠️ Nenhum evento modificado recentemente encontrado no Calendar');
      }
    } catch (apiError) {
      console.error('❌ Erro ao buscar eventos da API do Calendar:', apiError.message);
      if (apiError.response && apiError.response.status === 403) {
        console.warn('⚠️ Erro 403 - Verificar permissões do usuário:', userEmail);
      }
    }
  } catch (error) {
    console.error('❌ Erro geral ao processar webhook do Calendar:', error);
    // Não re-throw para não quebrar o webhook
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