const driveServiceJWT = require('./driveServiceJWT');
const { DriveFileManager, MIME_TYPES } = require('./driveFileManager');
const userModel = require('../models/userModel');
const driveFileModel = require('../models/driveFileModel');
const driveFolderModel = require('../models/driveFolderModel');
const logModel = require('../models/logModel');

// Sincronizar arquivos e pastas do Drive para todos os usuários (AGORA USA JWT)
exports.syncDriveFiles = async () => {
  try {
    console.log('Iniciando sincronização usando JWT...');
    
    // Usar a nova abordagem JWT que funciona
    const resultado = await driveServiceJWT.syncDriveFilesJWT();
    
    console.log(`\n=== Sincronização concluída (JWT) ===`);
    console.log(`Total: ${resultado.totalArquivos} arquivos, ${resultado.totalPastas} pastas`);
    
    return resultado;
  } catch (error) {
    console.error('Erro ao sincronizar arquivos/pastas do Drive:', error);
    throw error;
  }
};

// Processar mudança específica do Drive (usado pelos webhooks) - AGORA USA JWT
exports.processarMudancaDrive = async (fileId, userEmail) => {
  try {
    console.log(`Processando mudança do Drive para ${userEmail} (usando JWT)`);
    
    // Usar a nova abordagem JWT
    const resultado = await driveServiceJWT.processarMudancaDriveJWT(fileId, userEmail);
    
    return resultado;
  } catch (error) {
    console.error('Erro ao processar mudança do Drive:', error);
    throw error;
  }
};

// Configurar webhook do Drive - AGORA USA JWT
exports.configurarWatchDrive = async (email, webhookUrl) => {
  try {
    console.log(`Configurando webhook do Drive para ${email} (usando JWT)`);
    
    // Usar a nova abordagem JWT
    const { getDriveClient } = require('../config/googleJWT');
    const drive = await getDriveClient(email);

    // Obter token de página inicial
    const about = await drive.about.get({
      fields: 'changes/largestChangeId'
    });
    const startPageToken = about.data.changes.largestChangeId;

    // Configurar watch
    const watchResponse = await drive.changes.watch({
      pageToken: startPageToken,
      requestBody: {
        id: `drive-watch-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });

    return watchResponse.data;
  } catch (error) {
    console.error('Erro ao configurar watch do Drive:', error);
    throw error;
  }
}; 