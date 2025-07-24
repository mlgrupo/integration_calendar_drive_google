const { google } = require('googleapis');
const { getGoogleClient } = require('../config/google');

// Verificar se o webhook está configurado
exports.verificarWebhookConfigurado = async (email) => {
  try {
    console.log(`Verificando webhook para: ${email}`);
    
    const userAuth = getGoogleClient(['https://www.googleapis.com/auth/drive'], email);
    const drive = google.drive({ version: 'v3', auth: userAuth });

    // Tentar obter informações sobre o watch
    const about = await drive.about.get({
      fields: 'changes/largestChangeId'
    });

    console.log('Token de página atual:', about.data.changes.largestChangeId);
    
    return {
      success: true,
      largestChangeId: about.data.changes.largestChangeId,
      message: 'Drive API acessível'
    };
  } catch (error) {
    console.error('Erro ao verificar webhook:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Listar arquivos recentes para teste
exports.listarArquivosRecentes = async (email, maxResults = 10) => {
  try {
    console.log(`Listando arquivos recentes para: ${email}`);
    
    const userAuth = getGoogleClient(['https://www.googleapis.com/auth/drive.readonly'], email);
    const drive = google.drive({ version: 'v3', auth: userAuth });

    const response = await drive.files.list({
      pageSize: maxResults,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });

    console.log(`Encontrados ${response.data.files.length} arquivos`);
    
    return {
      success: true,
      files: response.data.files,
      count: response.data.files.length
    };
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Simular mudança de arquivo
exports.simularMudancaArquivo = async (fileId, email) => {
  try {
    console.log(`Simulando mudança para arquivo: ${fileId}`);
    
    const userAuth = getGoogleClient(['https://www.googleapis.com/auth/drive'], email);
    const drive = google.drive({ version: 'v3', auth: userAuth });

    // Buscar dados do arquivo
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, modifiedTime'
    });

    console.log('Arquivo encontrado:', file.data);
    
    return {
      success: true,
      file: file.data,
      message: 'Arquivo acessível para simulação'
    };
  } catch (error) {
    console.error('Erro ao simular mudança:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 