const userModel = require('../models/userModel');
const { google } = require('googleapis');
const { getGoogleClient } = require('../config/google');
const logModel = require('../models/logModel');
const userService = require('../services/userService'); // Added userService import

// Listar todos os usuários
const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await userModel.getAllUsers();
    
    res.json({ 
      sucesso: true, 
      usuarios,
      total: usuarios.length
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ 
      erro: 'Falha ao listar usuários', 
      detalhes: error.message 
    });
  }
};

// Adicionar usuário manualmente
const adicionarUsuario = async (req, res) => {
  try {
    const { email, nome } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    const usuario = await userModel.getOrCreateUsuario(email, nome);
    
    // Registrar log
    await logModel.logAuditoria({
      usuario_id: usuario.id,
      acao: 'adicionar_usuario',
      recurso_tipo: 'usuario',
      recurso_id: usuario.id,
      detalhes: `Usuário adicionado: ${email}`,
      ip_origem: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp_evento: new Date()
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Usuário adicionado com sucesso!',
      usuario 
    });
  } catch (error) {
    console.error('Erro ao adicionar usuário:', error);
    res.status(500).json({ 
      erro: 'Falha ao adicionar usuário', 
      detalhes: error.message 
    });
  }
};

// Buscar usuários do Google Workspace (Domain Wide Delegation)
const buscarUsuariosWorkspace = async (req, res) => {
  try {
    console.log('Buscando usuários do Google Workspace...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
    
    // Usar Admin SDK para buscar usuários do domínio
    const userAuth = await getGoogleClient([
      'https://www.googleapis.com/auth/admin.directory.user.readonly'
    ], adminEmail);
    
    const admin = google.admin({ version: 'directory_v1', auth: userAuth });
    
    // Buscar usuários do domínio
    const response = await admin.users.list({
      domain: 'reconectaoficial.com.br',
      maxResults: 500,
      orderBy: 'email'
    });

    const usuariosWorkspace = response.data.users || [];
    console.log(`Encontrados ${usuariosWorkspace.length} usuários no Google Workspace`);

    // Adicionar/atualizar usuários no banco
    const usuariosAdicionados = [];
    const usuariosAtualizados = [];

    for (const user of usuariosWorkspace) {
      try {
        const usuario = await userModel.getOrCreateUsuario(
          user.primaryEmail,
          user.name?.fullName || user.name?.givenName || null
        );
        
        if (usuario) {
          if (usuario.nome !== (user.name?.fullName || user.name?.givenName)) {
            usuariosAtualizados.push(usuario);
          } else {
            usuariosAdicionados.push(usuario);
          }
        }
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.primaryEmail}:`, error.message);
      }
    }

    // Registrar log
    await logModel.logAuditoria({
      usuario_id: null,
      acao: 'buscar_usuarios_workspace',
      recurso_tipo: 'workspace',
      recurso_id: 'domain',
      detalhes: `Busca de usuários do Workspace: ${usuariosAdicionados.length} adicionados, ${usuariosAtualizados.length} atualizados`,
      ip_origem: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp_evento: new Date()
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Usuários do Google Workspace sincronizados!',
      resultado: {
        totalWorkspace: usuariosWorkspace.length,
        adicionados: usuariosAdicionados.length,
        atualizados: usuariosAtualizados.length,
        usuarios: usuariosWorkspace.map(u => ({
          email: u.primaryEmail,
          nome: u.name?.fullName || u.name?.givenName,
          ativo: u.suspended === false
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuários do Workspace:', error);
    res.status(500).json({ 
      erro: 'Falha ao buscar usuários do Google Workspace', 
      detalhes: error.message 
    });
  }
};

// Sincronizar todos os usuários do domínio Google Workspace para o banco
const syncWorkspace = async (req, res) => {
  try {
    console.log('Sincronização de usuários do Workspace agendada (background)...');
    // Responde imediatamente
    res.status(202).json({ sucesso: true, mensagem: 'Sincronização de usuários do Workspace iniciada em background.' });
    // Roda o fluxo em background
    setImmediate(() => {
      userService.syncUsers().then((result) => {
        console.log('Sincronização de usuários do Workspace finalizada:', result);
      }).catch((err) => {
        console.error('Erro na sincronização de usuários em background:', err);
      });
    });
  } catch (error) {
    console.error('Erro ao sincronizar usuários:', error);
    res.status(500).json({
      erro: 'Erro ao sincronizar usuários',
      detalhes: error.message
    });
  }
};

// Sincronizar usuários e Drive em uma única operação
const sincronizarCompleta = async (req, res) => {
  try {
    console.log('Iniciando sincronização completa...');
    
    // 1. Buscar usuários do Google Workspace
    console.log('1. Buscando usuários do Google Workspace...');
    const adminEmail = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';
    
    const userAuth = await getGoogleClient([
      'https://www.googleapis.com/auth/admin.directory.user.readonly'
    ], adminEmail);
    
    const admin = google.admin({ version: 'directory_v1', auth: userAuth });
    
    const response = await admin.users.list({
      domain: 'reconectaoficial.com.br',
      maxResults: 500,
      orderBy: 'email'
    });

    const usuariosWorkspace = response.data.users || [];
    console.log(`Encontrados ${usuariosWorkspace.length} usuários no Google Workspace`);

    // 2. Adicionar usuários ao banco
    console.log('2. Adicionando usuários ao banco...');
    const usuariosProcessados = [];

    for (const user of usuariosWorkspace) {
      try {
        const usuario = await userModel.getOrCreateUsuario(
          user.primaryEmail,
          user.name?.fullName || user.name?.givenName || null
        );
        usuariosProcessados.push(usuario);
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.primaryEmail}:`, error.message);
      }
    }

    console.log(`Processados ${usuariosProcessados.length} usuários`);

    // 3. Sincronizar Drive para cada usuário
    console.log('3. Sincronizando Drive para cada usuário...');
    const driveService = require('../services/driveService');
    const resultadoDrive = await driveService.syncDriveFiles();

    // Registrar log
    await logModel.logAuditoria({
      usuario_id: null,
      acao: 'sincronizacao_completa',
      recurso_tipo: 'sistema',
      recurso_id: 'all',
      detalhes: `Sincronização completa: ${usuariosProcessados.length} usuários, ${resultadoDrive.totalArquivos} arquivos, ${resultadoDrive.totalPastas} pastas`,
      ip_origem: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp_evento: new Date()
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Sincronização completa executada com sucesso!',
      resultado: {
        usuarios: {
          total: usuariosProcessados.length,
          processados: usuariosProcessados.map(u => ({ id: u.id, email: u.email, nome: u.nome }))
        },
        drive: resultadoDrive
      }
    });
  } catch (error) {
    console.error('Erro na sincronização completa:', error);
    res.status(500).json({ 
      erro: 'Falha na sincronização completa', 
      detalhes: error.message 
    });
  }
};

// Buscar usuário por ID
const buscarUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    const usuario = await userModel.getUserById(id);
    
    if (!usuario) {
      return res.status(404).json({ 
        erro: 'Usuário não encontrado' 
      });
    }

    res.json({ 
      sucesso: true, 
      usuario 
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ 
      erro: 'Falha ao buscar usuário', 
      detalhes: error.message 
    });
  }
};

// Buscar usuário por email
const buscarUsuarioPorEmail = async (req, res) => {
  try {
    const { email } = req.params;
    
    const usuario = await userModel.getUserByEmail(email);
    
    if (!usuario) {
      return res.status(404).json({ 
        erro: 'Usuário não encontrado' 
      });
    }

    res.json({ 
      sucesso: true, 
      usuario 
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ 
      erro: 'Falha ao buscar usuário', 
      detalhes: error.message 
    });
  }
}; 

module.exports = {
  listarUsuarios,
  adicionarUsuario,
  buscarUsuariosWorkspace,
  syncWorkspace,
  sincronizarCompleta,
  buscarUsuarioPorId,
  buscarUsuarioPorEmail,
}; 