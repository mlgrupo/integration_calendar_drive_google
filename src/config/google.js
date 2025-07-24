const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: './.env' });

// Debug das variáveis de ambiente
console.log('=== DEBUG: Verificando variáveis de ambiente ===');
console.log('GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? 'Definido' : 'NÃO DEFINIDO');
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'Definido' : 'NÃO DEFINIDO');

if (process.env.GOOGLE_PRIVATE_KEY) {
  console.log('GOOGLE_PRIVATE_KEY length:', process.env.GOOGLE_PRIVATE_KEY.length);
  console.log('GOOGLE_PRIVATE_KEY starts with:', process.env.GOOGLE_PRIVATE_KEY.substring(0, 50));
  console.log('GOOGLE_PRIVATE_KEY ends with:', process.env.GOOGLE_PRIVATE_KEY.substring(process.env.GOOGLE_PRIVATE_KEY.length - 30));
  console.log('GOOGLE_PRIVATE_KEY contains \\n:', process.env.GOOGLE_PRIVATE_KEY.includes('\\n'));
  console.log('GOOGLE_PRIVATE_KEY contains ":', process.env.GOOGLE_PRIVATE_KEY.includes('"'));
}

// Configuração das credenciais da Service Account
const serviceAccountCredentials = {
  type: 'service_account',
  project_id: 'keen-clarity-458114-p7',
  private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '') : null,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
};

// Verificar se as credenciais estão corretas
console.log('=== DEBUG: Verificando credenciais processadas ===');
console.log('Client Email:', serviceAccountCredentials.client_email);
console.log('Private Key length:', serviceAccountCredentials.private_key?.length || 0);
console.log('Private Key starts with:', serviceAccountCredentials.private_key?.substring(0, 50) || 'N/A');
console.log('Private Key ends with:', serviceAccountCredentials.private_key?.substring(serviceAccountCredentials.private_key.length - 30) || 'N/A');

// Configuração do Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountCredentials,
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/admin.directory.user.readonly'
  ]
});

// Função para obter cliente autenticado para um usuário específico
async function getGoogleClient(scopes, userEmail) {
  console.log(`Configurando autenticação para: ${userEmail}`);
  console.log(`Scopes: ${Array.isArray(scopes) ? scopes.join(', ') : scopes}`);

  // Impersonation para o domínio
  const googleAuthOptions = {
    credentials: serviceAccountCredentials,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
  };
  if (userEmail && userEmail.endsWith('@reconectaoficial.com.br')) {
    console.log(`Aplicando impersonation para: ${userEmail}`);
    if (!serviceAccountCredentials.private_key) {
      console.error('ERRO: Chave privada não está disponível!');
      throw new Error('Chave privada não está disponível. Verifique a variável GOOGLE_PRIVATE_KEY.');
    }
    googleAuthOptions.subject = userEmail; // Impersonation
  }

  const authClient = new google.auth.GoogleAuth(googleAuthOptions);
  try {
    console.log('Autorizando GoogleAuth...');
    const client = await authClient.getClient();
    console.log(`GoogleAuth autorizado com sucesso para: ${userEmail}`);
    return client;
  } catch (error) {
    console.error(`Erro ao autorizar GoogleAuth para ${userEmail}:`, error.message);
    console.error('Erro completo:', error);
    throw error;
  }
}

module.exports = { auth, getGoogleClient }; 