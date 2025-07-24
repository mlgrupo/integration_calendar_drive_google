const { google } = require('googleapis');
const { getGoogleClient } = require('../config/google');
const userModel = require('../models/userModel');
const logModel = require('../models/logModel');

// Sincronizar usuários do domínio via Admin SDK
exports.syncUsers = async () => {
  try {
    // Escopo correto e sub do superadmin
    const adminAuth = await getGoogleClient([
      'https://www.googleapis.com/auth/admin.directory.user.readonly'
    ], process.env.ADMIN_EMAIL); // superadmin
    const admin = google.admin({ version: 'directory_v1', auth: adminAuth });

    // Buscar todos os usuários do domínio (padrão Google)
    const response = await admin.users.list({
      customer: 'my_customer', // NÃO use domain aqui!
      maxResults: 500,
      orderBy: 'email'
    });

    let totalUsuarios = 0;
    let novosUsuarios = 0;

    for (const user of response.data.users) {
      if (user.primaryEmail && user.primaryEmail.endsWith('@reconectaoficial.com.br')) {
        // Verificar se o usuário já existe
        const existingUser = await userModel.getUserByEmail(user.primaryEmail);
        if (!existingUser) {
          // Criar novo usuário
          await userModel.getOrCreateUsuario(
            user.primaryEmail,
            user.name ? `${user.name.givenName || ''} ${user.name.familyName || ''}`.trim() : null
          );
          novosUsuarios++;
        }
        totalUsuarios++;
        // Registrar log de auditoria
        await logModel.logAuditoria({
          usuario_id: existingUser ? existingUser.id : null,
          acao: existingUser ? 'sync_existing' : 'sync_new',
          recurso_tipo: 'user',
          recurso_id: user.primaryEmail,
          detalhes: `Sincronização de usuário via Admin SDK`,
          ip_origem: null,
          user_agent: null,
          timestamp_evento: new Date()
        });
      }
    }
    return { totalUsuarios, novosUsuarios };
  } catch (error) {
    console.error('Erro ao sincronizar usuários:', error);
    throw error;
  }
};

// Listar todos os usuários cadastrados
exports.getAllUsers = async () => {
  try {
    return await userModel.getAllUsers();
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    throw error;
  }
};

// Buscar usuário por email
exports.getUserByEmail = async (email) => {
  try {
    return await userModel.getUserByEmail(email);
  } catch (error) {
    console.error('Erro ao buscar usuário por email:', error);
    throw error;
  }
};

// Criar ou atualizar usuário
exports.createOrUpdateUser = async (email, nome = null) => {
  try {
    return await userModel.getOrCreateUsuario(email, nome);
  } catch (error) {
    console.error('Erro ao criar/atualizar usuário:', error);
    throw error;
  }
}; 