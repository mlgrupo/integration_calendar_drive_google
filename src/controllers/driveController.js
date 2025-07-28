const driveService = require('../services/driveService');
const { DriveFileManager, MIME_TYPES } = require('../services/driveFileManager');
const logModel = require('../models/logModel');
const webhookDebug = require('../utils/webhookDebug');

// Sincronizar arquivos e pastas do Drive (APENAS SHARED DRIVES)
const syncDrive = async (req, res) => {
  try {
    console.log('Sincronização dos Shared Drives agendada (background)...');
    // Responde imediatamente
    res.status(202).json({ sucesso: true, mensagem: 'Sincronização dos Shared Drives iniciada em background.' });
    // Roda o fluxo em background
    setImmediate(async () => {
      try {
        const driveServiceJWT = require('../services/driveServiceJWT');
        const resultado = await driveServiceJWT.syncDriveFilesJWT();
        await logModel.logAuditoria({
          usuario_id: null,
          acao: 'sync_shared_drives',
          recurso_tipo: 'shared_drives',
          recurso_id: 'all_users',
          detalhes: `Sincronização dos Shared Drives executada: ${resultado.totalArquivos} arquivos, ${resultado.totalPastas} pastas`,
          ip_origem: req.ip,
          user_agent: req.get('User-Agent'),
          timestamp_evento: new Date()
        });
        console.log('Sincronização dos Shared Drives finalizada:', resultado);
      } catch (error) {
        console.error('Erro na sincronização dos Shared Drives em background:', error);
      }
    });
  } catch (error) {
    console.error('Erro ao sincronizar Shared Drives:', error);
    res.status(500).json({ 
      erro: 'Falha ao sincronizar arquivos/pastas dos Shared Drives', 
      detalhes: error.message 
    });
  }
};

// Configurar webhook do Drive para todos os usuários do banco (APENAS SHARED DRIVES)
const configurarWebhookDrive = async (req, res) => {
  try {
    const userModel = require('../models/userModel');
    const driveServiceJWT = require('../services/driveServiceJWT');
    const webhookUrl = process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/drive/webhook` : (req.body?.webhookUrl || null);
    if (!webhookUrl) {
      return res.status(400).json({ erro: 'webhookUrl não informado e WEBHOOK_URL não está configurado.' });
    }
    const usuarios = await userModel.getAllUsers();
    let total = 0;
    let erros = [];
    let sharedDrivesConfigurados = 0;
    
    console.log(`🔄 Configurando webhooks de Shared Drives para ${usuarios.length} usuários...`);
    
    for (const usuario of usuarios) {
      try {
        console.log(`📁 Configurando webhook para: ${usuario.email}`);
        await driveServiceJWT.registrarWebhookDriveJWT(usuario.email, webhookUrl);
        total++;
        sharedDrivesConfigurados++;
      } catch (err) {
        console.error(`❌ Erro ao configurar webhook para ${usuario.email}:`, err.message);
        erros.push({ email: usuario.email, erro: err.message });
      }
    }
    res.json({ 
      sucesso: true, 
      mensagem: `Webhooks de Shared Drives configurados para ${total} usuários.`, 
      totalUsuarios: total,
      totalSharedDrives: sharedDrivesConfigurados,
      erros 
    });
  } catch (error) {
    console.error('❌ Erro ao configurar webhooks:', error);
    res.status(500).json({ erro: 'Falha ao configurar webhooks de Shared Drives', detalhes: error.message });
  }
};

// Testar webhook do Drive
const testarWebhookDrive = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando webhook do Drive para ${email}`);

    // Simular um webhook de teste
    const testData = {
      changes: [
        {
          fileId: 'test-file-id',
          time: new Date().toISOString()
        }
      ]
    };

    // Processar o teste
    const resultado = await driveService.processarMudancaDrive('test-file-id', email);
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Teste do webhook do Drive executado!',
      resultado,
      testData
    });
  } catch (error) {
    console.error('Erro ao testar webhook do Drive:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar webhook do Drive', 
      detalhes: error.message 
    });
  }
};

// Debug do Drive
const debugDrive = async (req, res) => {
  try {
    const { email } = req.query;
    const userEmail = email || process.env.ADMIN_EMAIL || 'admin@reconectaoficial.com.br';
    
    console.log(`Debug do Drive para: ${userEmail}`);

    // Verificar webhook
    const webhookStatus = await webhookDebug.verificarWebhookConfigurado(userEmail);
    
    // Listar arquivos recentes
    const arquivosRecentes = await webhookDebug.listarArquivosRecentes(userEmail, 5);
    
    res.json({ 
      sucesso: true, 
      debug: {
        email: userEmail,
        webhook: webhookStatus,
        arquivosRecentes: arquivosRecentes,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro no debug do Drive:', error);
    res.status(500).json({ 
      erro: 'Falha no debug do Drive', 
      detalhes: error.message 
    });
  }
}; 

// Testar autenticação do Drive
const testarAutenticacao = async (req, res) => {
  try {
    const { email } = req.query;
    const userEmail = email || process.env.ADMIN_EMAIL || 'admin@reconectaoficial.com.br';
    
    console.log(`Testando autenticação do Drive para: ${userEmail}`);

    const { getGoogleClient } = require('../config/google');
    const { google } = require('googleapis');

    const userAuth = await getGoogleClient(['https://www.googleapis.com/auth/drive.readonly'], userEmail);
    const drive = google.drive({ version: 'v3', auth: userAuth });

    // Testar acesso básico
    const about = await drive.about.get({
      fields: 'user,storageQuota'
    });

    // Testar listagem de arquivos com query ampla
    const files = await drive.files.list({
      pageSize: 20,
      fields: 'files(id, name, mimeType, owners, shared, size, createdTime)',
      q: `trashed=false`
    });

    // Se não encontrou nada, tentar query sem filtros
    let filesAlt = [];
    if (files.data.files.length === 0) {
      console.log('Query com filtros não retornou resultados, tentando sem filtros...');
      const responseAlt = await drive.files.list({
        pageSize: 20,
        fields: 'files(id, name, mimeType, owners, shared, size, createdTime)'
      });
      filesAlt = responseAlt.data.files;
    }

    const allFiles = files.data.files.length > 0 ? files.data.files : filesAlt;

    res.json({ 
      sucesso: true, 
      autenticacao: {
        email: userEmail,
        usuario: about.data.user,
        quota: about.data.storageQuota,
        arquivosEncontrados: allFiles.length,
        queryUsada: files.data.files.length > 0 ? 'com filtros' : 'sem filtros',
        primeirosArquivos: allFiles.slice(0, 5).map(f => ({
          nome: f.name,
          tipo: f.mimeType,
          dono: f.owners?.[0]?.emailAddress,
          compartilhado: f.shared,
          tamanho: f.size,
          criado: f.createdTime
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro no teste de autenticação:', error);
    res.status(500).json({ 
      erro: 'Falha no teste de autenticação', 
      detalhes: error.message,
      stack: error.stack
    });
  }
}; 

// Testar DriveFileManager para um usuário específico
const testDriveFileManager = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando DriveFileManager para: ${email}`);
    
    const driveManager = new DriveFileManager(email);
    await driveManager.initialize();

    // Testar diferentes funcionalidades
    const resultados = {};

    // 1. Listar todos os arquivos
    console.log('1. Testando listarArquivos...');
    resultados.todosArquivos = await driveManager.listarArquivos({ limite: 100 });

    // 2. Obter estatísticas
    console.log('2. Testando obterEstatisticas...');
    resultados.estatisticas = await driveManager.obterEstatisticas();

    // 3. Listar arquivos recentes
    console.log('3. Testando listarArquivosRecentes...');
    resultados.arquivosRecentes = await driveManager.listarArquivosRecentes(7);

    // 4. Listar arquivos compartilhados
    console.log('4. Testando listarArquivosCompartilhados...');
    resultados.arquivosCompartilhados = await driveManager.listarArquivosCompartilhados();

    // 5. Listar planilhas
    console.log('5. Testando listarPorTipo (planilhas)...');
    resultados.planilhas = await driveManager.listarPorTipo(MIME_TYPES.GOOGLE_SHEET);

    // 6. Listar documentos
    console.log('6. Testando listarPorTipo (documentos)...');
    resultados.documentos = await driveManager.listarPorTipo(MIME_TYPES.GOOGLE_DOC);

    // 7. Buscar arquivos por nome
    console.log('7. Testando buscarArquivos...');
    resultados.busca = await driveManager.buscarArquivos('teste');

    res.json({ 
      sucesso: true, 
      mensagem: 'Teste do DriveFileManager executado com sucesso!',
      email,
      resultados 
    });
  } catch (error) {
    console.error('Erro ao testar DriveFileManager:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar DriveFileManager', 
      detalhes: error.message 
    });
  }
};

// Testar diferentes queries para debug
const testarQueries = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando queries para: ${email}`);
    
    const driveManager = new DriveFileManager(email);
    await driveManager.initialize();

    // Testar diferentes queries
    const resultados = await driveManager.testarQueries();

    res.json({ 
      sucesso: true, 
      mensagem: 'Teste de queries executado com sucesso!',
      email,
      resultados 
    });
  } catch (error) {
    console.error('Erro ao testar queries:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar queries', 
      detalhes: error.message 
    });
  }
};

// Testar Admin SDK (Domain Wide Delegation)
const testarAdminSDK = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando Admin SDK para: ${email}`);
    
    const driveManager = new DriveFileManager(email);
    await driveManager.initialize();

    // Testar Admin SDK
    const resultados = await driveManager.buscarComAdminSDK();

    res.json({ 
      sucesso: true, 
      mensagem: 'Teste do Admin SDK executado com sucesso!',
      email,
      resultados 
    });
  } catch (error) {
    console.error('Erro ao testar Admin SDK:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar Admin SDK', 
      detalhes: error.message 
    });
  }
}; 

// Sincronizar arquivos e pastas do Drive para um usuário específico
const syncDrivePorUsuario = async (req, res) => {
  try {
    const email = req.params.email;
    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório.' });
    }
    const resultado = await driveService.syncDriveFilesPorUsuario(email);
    res.json({ sucesso: true, mensagem: `Sincronização do Drive para ${email} executada com sucesso!`, resultado });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao sincronizar arquivos/pastas do Drive para o usuário', detalhes: error.message });
  }
};

// Webhook do Drive
const webhookDrive = async (req, res) => {
  try {
    // Aqui você pode processar a notificação do Google Drive
    // Exemplo: logar o body recebido
    console.log('Webhook do Drive recebido:', req.body);
    res.status(200).json({ recebido: true });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao processar webhook do Drive', detalhes: error.message });
  }
}; 

// Forçar sincronização manual do Drive
const forcarSincronizacaoDrive = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email do usuário é obrigatório'
      });
    }

    console.log(`🔄 Forçando sincronização manual do Drive para: ${email}`);

    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Sincronização do Drive iniciada em background',
      usuario: email,
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const userModel = require('../models/userModel');
        const driveServiceJWT = require('../services/driveServiceJWT');

        const { getDriveClient } = require('../config/googleJWT');
        const drive = await getDriveClient(email);

        // Obter novo startPageToken
        const startPageTokenResponse = await drive.changes.getStartPageToken();
        const newStartPageToken = startPageTokenResponse.data.startPageToken;
        console.log(`📄 Novo startPageToken para ${email}: ${newStartPageToken}`);

        // Salvar o novo pageToken
        await userModel.saveDrivePageToken(email, newStartPageToken);

        // Buscar arquivos modificados recentemente (últimas 24 horas)
        const now = new Date();
        const timeMin = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        console.log(`🔍 Buscando arquivos modificados para ${email}...`);
        const files = await drive.files.list({
          q: `modifiedTime > '${timeMin.toISOString()}'`,
          fields: 'files(id,name,mimeType,parents,size,modifiedTime,createdTime,trashed,webViewLink)',
          orderBy: 'modifiedTime desc'
        });

        if (files.data.files && files.data.files.length > 0) {
          console.log(`📁 Encontrados ${files.data.files.length} arquivos para ${email}`);

          let arquivosProcessados = 0;
          for (const file of files.data.files) {
            try {
              console.log(`  📋 Processando: ${file.name} (${file.id})`);
              await driveServiceJWT.processarArquivoDriveJWT(file, email);
              arquivosProcessados++;
            } catch (error) {
              console.error(`Erro ao processar ${file.name}:`, error.message);
            }
          }

          console.log(`✅ Sincronização manual concluída para ${email}: ${arquivosProcessados} arquivos`);
        } else {
          console.log(`ℹ️ Nenhum arquivo modificado encontrado para ${email}`);
        }

      } catch (error) {
        console.error(`❌ Erro na sincronização manual para ${email}:`, error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar sincronização manual:', error);
    // Não re-throw pois já respondemos 202
  }
};





module.exports = {
  syncDrive,
  syncDrivePorUsuario,
  webhookDrive,
  configurarWebhookDrive,
  forcarSincronizacaoDrive,

}; 