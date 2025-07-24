const logModel = require('../models/logModel');
const webhookService = require('../services/webhookService');
const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');

// Webhook do Drive (AGORA USA JWT)
exports.driveWebhook = async (req, res) => {
  try {
    console.log('=== WEBHOOK DRIVE RECEBIDO (JWT) ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));
    
    // Acesso defensivo ao body
    const body = req.body || {};
    
    // Verificar se é um desafio de verificação
    if (body.type === 'web_hook_challenge') {
      console.log('✅ Desafio de verificação recebido');
      return res.status(200).json({ challenge: body.challenge });
    }

    // Processar mudanças do Drive
    if (body.changes && Array.isArray(body.changes)) {
      console.log(`🔄 Processando ${body.changes.length} mudanças`);
      
      for (const change of body.changes) {
        console.log('📝 Processando mudança:', change);
        
        try {
          // Buscar o arquivo atualizado para obter informações completas
          const { getDriveClient } = require('../config/googleJWT');
          
          // Tentar determinar o usuário proprietário do arquivo
          let userEmail = null;
          
          // Primeiro, tentar obter informações do arquivo para identificar o proprietário
          try {
            // Usar um email padrão para buscar o arquivo
            const defaultEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
            const drive = await getDriveClient(defaultEmail);
            
            const fileResponse = await drive.files.get({
              fileId: change.fileId,
              fields: 'id, name, mimeType, owners, shared, modifiedTime, createdTime, size, parents'
            });
            
            const file = fileResponse.data;
            console.log('📄 Arquivo encontrado:', file.name);
            
            // Identificar o proprietário
            if (file.owners && file.owners.length > 0) {
              userEmail = file.owners[0].emailAddress;
              console.log('👤 Proprietário identificado:', userEmail);
            } else {
              userEmail = defaultEmail;
              console.log('⚠️ Usando email padrão:', userEmail);
            }
            
            // Processar a mudança usando JWT
            const resultado = await driveServiceJWT.processarMudancaDriveJWT(change.fileId, userEmail);
            
            if (resultado) {
              console.log(`✅ Arquivo atualizado via webhook: ${file.name}`);
              
              // Determinar o tipo de evento baseado na mudança
              let tipoEvento = 'modificado';
              if (change.removed) {
                tipoEvento = 'removido';
              } else if (change.file && change.file.createdTime === change.file.modifiedTime) {
                tipoEvento = 'criado';
              }
              
              // Registrar log detalhado
              await logModel.logDriveEvent({
                usuario_id: null, // Será atualizado quando encontrarmos o usuário
                tipo_evento: tipoEvento,
                recurso_tipo: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
                recurso_id: change.fileId,
                detalhes: `Mudança em tempo real via webhook: ${file.name} (${tipoEvento})`,
                dados_anteriores: null,
                dados_novos: file,
                ip_origem: req.ip,
                user_agent: req.get('User-Agent'),
                timestamp_evento: new Date()
              });
              
              console.log(`📊 Log registrado: ${tipoEvento} - ${file.name}`);
            } else {
              console.log(`❌ Falha ao atualizar arquivo: ${change.fileId}`);
            }
            
          } catch (fileError) {
            console.error(`❌ Erro ao buscar arquivo ${change.fileId}:`, fileError.message);
            
            // Se não conseguimos buscar o arquivo, usar email padrão
            userEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
            console.log('⚠️ Usando email padrão devido a erro:', userEmail);
            
            // Tentar processar mesmo assim
            const resultado = await driveServiceJWT.processarMudancaDriveJWT(change.fileId, userEmail);
            if (resultado) {
              console.log(`✅ Arquivo processado com email padrão: ${change.fileId}`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Erro ao processar mudança do arquivo ${change.fileId}:`, error);
        }
      }
    } else {
      console.log('⚠️ Nenhuma mudança encontrada no webhook ou formato inválido');
      console.log('Body completo:', body);
    }

    console.log('=== WEBHOOK PROCESSADO COM SUCESSO ===');
    res.status(200).json({ 
      sucesso: true, 
      processado: true,
      timestamp: new Date().toISOString(),
      mudancas: body.changes?.length || 0
    });
  } catch (error) {
    console.error('❌ Erro geral ao processar webhook do Drive:', error);
    res.status(500).json({ 
      erro: 'Falha ao processar webhook do Drive', 
      detalhes: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Webhook do Calendar (TEMPORARIAMENTE DESATIVADO)
exports.calendarWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    console.log('Webhook do Calendar recebido (DESATIVADO):', body);
    
    // Verificar se é um desafio de verificação
    if (body.type === 'web_hook_challenge') {
      return res.status(200).json({ challenge: body.challenge });
    }

    // Calendar temporariamente desativado
    console.log('Calendar webhook desativado temporariamente');
    
    res.status(200).json({ 
      sucesso: true, 
      mensagem: 'Calendar webhook desativado temporariamente' 
    });
  } catch (error) {
    console.error('Erro ao processar webhook do Calendar:', error);
    res.status(500).json({ erro: 'Falha ao processar webhook do Calendar' });
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