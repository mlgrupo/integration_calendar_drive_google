const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({ path: './config.env' });

// Configuração da Service Account
const SERVICE_ACCOUNT_CONFIG = {
  email: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, ''),
  projectId: 'keen-clarity-458114-p7'
};

/**
 * Gera um JWT token para um usuário específico
 * @param {string} userEmail - Email do usuário para impersonation
 * @param {Array} scopes - Escopos necessários
 * @returns {string} JWT token
 */
function generateJWT(userEmail, scopes = ['https://www.googleapis.com/auth/drive']) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: SERVICE_ACCOUNT_CONFIG.email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 hora
    iat: now,
    sub: userEmail // Impersonation
  };

  return jwt.sign(payload, SERVICE_ACCOUNT_CONFIG.privateKey, { 
    algorithm: 'RS256',
    header: {
      alg: 'RS256',
      typ: 'JWT'
    }
  });
}

/**
 * Troca JWT por access token
 * @param {string} jwtToken - JWT token gerado
 * @returns {string} Access token
 */
async function exchangeJWTForToken(jwtToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtToken
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Erro ao trocar JWT por token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Obtém cliente autenticado para um usuário específico usando JWT
 * @param {string} userEmail - Email do usuário
 * @param {Array} scopes - Escopos necessários
 * @returns {Object} Cliente do Google autenticado
 */
async function getAuthenticatedClient(userEmail, scopes = ['https://www.googleapis.com/auth/drive']) {
  try {
    console.log(`Gerando JWT para: ${userEmail}`);
    
    // Gerar JWT
    const jwtToken = generateJWT(userEmail, scopes);
    
    // Trocar por access token
    const accessToken = await exchangeJWTForToken(jwtToken);
    
    console.log(`✓ Token obtido com sucesso para: ${userEmail}`);
    
    // Criar cliente autenticado
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken
    });
    
    return auth;
  } catch (error) {
    console.error(`Erro ao autenticar ${userEmail}:`, error.message);
    throw error;
  }
}

/**
 * Obtém cliente do Drive para um usuário específico
 * @param {string} userEmail - Email do usuário
 * @returns {Object} Cliente do Drive
 */
async function getDriveClient(userEmail) {
  const auth = await getAuthenticatedClient(userEmail, ['https://www.googleapis.com/auth/drive.readonly']);
  return google.drive({ version: 'v3', auth });
}

/**
 * Obtém cliente do Admin SDK para um usuário específico
 * @param {string} userEmail - Email do usuário
 * @returns {Object} Cliente do Admin SDK
 */
async function getAdminClient(userEmail) {
  const auth = await getAuthenticatedClient(userEmail, ['https://www.googleapis.com/auth/admin.directory.user.readonly']);
  return google.admin({ version: 'directory_v1', auth });
}

/**
 * Obtém cliente do Calendar para um usuário específico
 * @param {string} userEmail - Email do usuário
 * @returns {Object} Cliente do Calendar
 */
async function getCalendarClient(userEmail) {
  const auth = await getAuthenticatedClient(userEmail, ['https://www.googleapis.com/auth/calendar.readonly']);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Testa a autenticação JWT para um usuário específico
 * @param {string} userEmail - Email do usuário
 */
async function testJWTAuthentication(userEmail) {
  try {
    console.log(`\n=== TESTANDO JWT PARA: ${userEmail} ===`);
    
    // Testar Drive
    const drive = await getDriveClient(userEmail);
    const about = await drive.about.get({ fields: 'user,storageQuota' });
    console.log('✓ Drive conectado como:', about.data.user?.emailAddress);
    
    // Testar listagem de arquivos
    const files = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name, mimeType, size, owners)'
    });
    
    console.log(`✓ Arquivos encontrados: ${files.data.files?.length || 0}`);
    
    if (files.data.files && files.data.files.length > 0) {
      console.log('Primeiros arquivos:');
      files.data.files.slice(0, 3).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (${file.mimeType})`);
      });
    }
    
    return {
      success: true,
      user: about.data.user,
      filesCount: files.data.files?.length || 0,
      files: files.data.files || []
    };
    
  } catch (error) {
    console.error(`✗ Erro no teste JWT para ${userEmail}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gera um access token JWT para o Google Calendar usando impersonation
 * @param {string} emailUsuario - Email do usuário para impersonation
 * @returns {Promise<string>} Access token válido por 1 hora
 */
async function gerarAccessTokenCalendar(emailUsuario) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SERVICE_ACCOUNT_CONFIG.email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    sub: emailUsuario
  };
  const token = jwt.sign(payload, SERVICE_ACCOUNT_CONFIG.privateKey, { algorithm: 'RS256' });
  const response = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    }
  });
  return response.data.access_token;
}

/**
 * Busca a lista de calendários de um usuário usando access token JWT
 * @param {string} emailUsuario
 * @returns {Promise<any>} Lista de calendários
 */
async function listarCalendariosComToken(emailUsuario) {
  const accessToken = await gerarAccessTokenCalendar(emailUsuario);
  const response = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return response.data;
}

/**
 * Busca eventos de um calendário usando access token JWT
 * @param {string} emailUsuario
 * @param {string} calendarId
 * @param {object} params - Parâmetros extras para a busca de eventos
 * @returns {Promise<any>} Lista de eventos
 */
async function listarEventosComToken(emailUsuario, calendarId, params = {}) {
  const accessToken = await gerarAccessTokenCalendar(emailUsuario);
  const response = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    params
  });
  return response.data;
}

module.exports = {
  getAuthenticatedClient,
  getDriveClient,
  getAdminClient,
  getCalendarClient,
  testJWTAuthentication,
  generateJWT,
  exchangeJWTForToken,
  gerarAccessTokenCalendar,
  listarCalendariosComToken,
  listarEventosComToken
}; 