const { getDriveClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');
const driveFileModel = require('../models/driveFileModel');
const driveFolderModel = require('../models/driveFolderModel');
// const logModel = require('../models/logModel'); // Comentado temporariamente
const { v4: uuidv4 } = require('uuid');

// Sempre garantir que file_id e folder_id não tenham timestamp
function cleanId(id) {
  return typeof id === 'string' ? id.split('_')[0] : id;
}

// Sincronizar arquivos e pastas do Drive para todos os usuários usando JWT
// MODIFICADO: Buscar apenas dos Shared Drives (drives compartilhados)
exports.syncDriveFilesJWT = async () => {
  try {
    const usuarios = await userModel.getAllUsers();
    let totalArquivos = 0;
    let totalPastas = 0;

    console.log(`Iniciando sincronização JWT para ${usuarios.length} usuários (APENAS Shared Drives)...`);

    for (const usuario of usuarios) {
      console.log(`\n=== Processando usuário: ${usuario.email} ===`);
      try {
        // Usar a nova abordagem JWT
        const drive = await getDriveClient(usuario.email);

        // BUSCAR APENAS SHARED DRIVES (removido Meu Drive)
        console.log('Buscando apenas Shared Drives...');
        const drivesResponse = await drive.drives.list();
        const sharedDrives = drivesResponse.data.drives || [];
        
        if (sharedDrives.length === 0) {
          console.log(`⚠️ Nenhum Shared Drive encontrado para ${usuario.email}`);
          continue;
        }
        
        console.log(`📁 Encontrados ${sharedDrives.length} Shared Drives para ${usuario.email}`);
        
        for (const sharedDrive of sharedDrives) {
          console.log(`📂 Processando Shared Drive: ${sharedDrive.name} (${sharedDrive.id})`);
          
          let allFiles = [];
          let nextPageToken = null;
          let pageCount = 0;
          
          // Buscar todos os arquivos com paginação
          do {
            pageCount++;
            console.log(`   📄 Buscando página ${pageCount}...`);
            
            const sharedDriveResponse = await drive.files.list({
              pageSize: 1000,
              pageToken: nextPageToken,
              fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed, version, md5Checksum, exportLinks, thumbnailLink)',
              q: 'trashed = false',
              corpora: 'drive',
              driveId: sharedDrive.id,
              includeItemsFromAllDrives: true,
              supportsAllDrives: true
            });
            
            const files = sharedDriveResponse.data.files || [];
            allFiles = allFiles.concat(files);
            nextPageToken = sharedDriveResponse.data.nextPageToken;
            
            console.log(`   📄 Página ${pageCount}: ${files.length} arquivos encontrados`);
            
          } while (nextPageToken);
          
          console.log(`📄 Total de ${allFiles.length} itens no Shared Drive: ${sharedDrive.name} (${pageCount} páginas)`);
          
          for (const arquivo of allFiles) {
            const isFolder = arquivo.mimeType === 'application/vnd.google-apps.folder';
            if (isFolder) {
              await driveFolderModel.upsertFolder({
                usuario_id: usuario.id,
                folder_id: cleanId(arquivo.id),
                nome: arquivo.name,
                caminho_completo: null,
                parent_folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
                cor_rgb: null,
                compartilhado: arquivo.shared || false,
                visibilidade: null,
                permissoes: null,
                criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
                modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
                ultimo_acesso: null,
                tamanho_total: 0,
                quantidade_arquivos: 0,
                quantidade_subpastas: 0,
                dados_completos: arquivo,
                origem_drive: sharedDrive.id,
                nome_drive: sharedDrive.name
              });
              totalPastas++;
            } else {
              await driveFileModel.upsertFile({
                usuario_id: usuario.id,
                file_id: cleanId(arquivo.id),
                nome: arquivo.name,
                mime_type: arquivo.mimeType,
                tamanho: arquivo.size || null,
                folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
                caminho_completo: null,
                dono_email: arquivo.owners && arquivo.owners[0] ? arquivo.owners[0].emailAddress : null,
                compartilhado: arquivo.shared || false,
                visibilidade: null,
                permissoes: null,
                criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
                modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
                versao: arquivo.version ? parseInt(arquivo.version) : 1,
                md5_checksum: arquivo.md5Checksum || null,
                web_view_link: arquivo.webViewLink || null,
                download_link: arquivo.exportLinks ? JSON.stringify(arquivo.exportLinks) : null,
                thumbnail_link: arquivo.thumbnailLink || null,
                starred: arquivo.starred || false,
                trashed: arquivo.trashed || false,
                tipo_arquivo: arquivo.mimeType ? arquivo.mimeType.split('.').pop() : null,
                extensao: arquivo.name && arquivo.name.includes('.') ? arquivo.name.split('.').pop() : null,
                dados_completos: arquivo,
                origem_drive: sharedDrive.id,
                nome_drive: sharedDrive.name
              });
              totalArquivos++;
            }
          }
        }

        console.log(`✅ Usuário ${usuario.email}: ${totalArquivos} arquivos, ${totalPastas} pastas processados (apenas Shared Drives)`);
      } catch (userError) {
        console.error(`❌ Erro ao processar usuário ${usuario.email}:`, userError.message);
        // Continuar com o próximo usuário
      }
    }

    console.log(`\n=== Sincronização JWT concluída (APENAS Shared Drives) ===`);
    console.log(`Total: ${totalArquivos} arquivos, ${totalPastas} pastas`);
    
    return { totalArquivos, totalPastas };
  } catch (error) {
    console.error('❌ Erro ao sincronizar arquivos/pastas do Drive com JWT:', error);
    throw error;
  }
};

// Processar mudança específica do Drive usando JWT
exports.processarMudancaDriveJWT = async (fileId, userEmail) => {
  try {
    // Buscar usuário
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.log(`Usuário não encontrado: ${userEmail}`);
      return null;
    }

    const drive = await getDriveClient(userEmail);

    // Buscar dados atualizados do arquivo/pasta
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, parents, owners, shared, createdTime, modifiedTime, version, md5Checksum, webViewLink, exportLinks, thumbnailLink, starred, trashed'
    });

    const arquivo = response.data;
    const isFolder = arquivo.mimeType === 'application/vnd.google-apps.folder';

    if (isFolder) {
      // Atualizar pasta
      await driveFolderModel.upsertFolder({
        usuario_id: usuario.id,
        folder_id: cleanId(arquivo.id),
        nome: arquivo.name,
        caminho_completo: null,
        parent_folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
        cor_rgb: null,
        compartilhado: arquivo.shared || false,
        visibilidade: null,
        permissoes: null,
        criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
        modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
        ultimo_acesso: null,
        tamanho_total: 0,
        quantidade_arquivos: 0,
        quantidade_subpastas: 0,
        dados_completos: arquivo
      });
    } else {
      // Atualizar arquivo
      await driveFileModel.upsertFile({
        usuario_id: usuario.id,
        file_id: cleanId(arquivo.id),
        nome: arquivo.name,
        mime_type: arquivo.mimeType,
        tamanho: arquivo.size || null,
        folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
        caminho_completo: null,
        dono_email: arquivo.owners && arquivo.owners[0] ? arquivo.owners[0].emailAddress : null,
        compartilhado: arquivo.shared || false,
        visibilidade: null,
        permissoes: null,
        criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
        modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
        versao: arquivo.version ? parseInt(arquivo.version) : 1,
        md5_checksum: arquivo.md5Checksum || null,
        web_view_link: arquivo.webViewLink || null,
        download_link: arquivo.exportLinks ? JSON.stringify(arquivo.exportLinks) : null,
        thumbnail_link: arquivo.thumbnailLink || null,
        starred: arquivo.starred || false,
        trashed: arquivo.trashed || false,
        tipo_arquivo: arquivo.mimeType ? arquivo.mimeType.split('.').pop() : null,
        extensao: arquivo.name && arquivo.name.includes('.') ? arquivo.name.split('.').pop() : null,
        dados_completos: arquivo
      });
    }

    // Registrar log (comentado temporariamente)
    /*
    await logModel.logDriveEvent({
      usuario_id: usuario.id,
      tipo_evento: 'webhook_update_jwt',
      recurso_tipo: isFolder ? 'folder' : 'file',
      recurso_id: arquivo.id,
      detalhes: `Atualização automática via webhook JWT: ${arquivo.name}`,
      dados_anteriores: null,
      dados_novos: arquivo,
      ip_origem: null,
      user_agent: null,
      timestamp_evento: new Date()
    });
    */

    return { success: true, file: arquivo };
  } catch (error) {
    console.error('Erro ao processar mudança do Drive com JWT:', error);
    throw error;
  }
};

// Listar arquivos de um usuário específico usando JWT (APENAS Shared Drives)
exports.listarArquivosUsuarioJWT = async (userEmail, options = {}) => {
  try {
    const drive = await getDriveClient(userEmail);
    
    // Buscar apenas dos Shared Drives
    const drivesResponse = await drive.drives.list();
    const sharedDrives = drivesResponse.data.drives || [];
    
    if (sharedDrives.length === 0) {
      console.log(`⚠️ Nenhum Shared Drive encontrado para ${userEmail}`);
      return [];
    }
    
    let allFiles = [];
    
    for (const sharedDrive of sharedDrives) {
      console.log(`📂 Listando arquivos do Shared Drive: ${sharedDrive.name}`);
      
      const response = await drive.files.list({
        pageSize: options.limit || 100,
        fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed)',
        q: options.query || 'trashed=false',
        corpora: 'drive',
        driveId: sharedDrive.id,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
      
      const files = response.data.files || [];
      // Adicionar informações do drive compartilhado
      files.forEach(file => {
        file.sharedDriveId = sharedDrive.id;
        file.sharedDriveName = sharedDrive.name;
      });
      
      allFiles = allFiles.concat(files);
    }

    return allFiles;
  } catch (error) {
    console.error(`❌ Erro ao listar arquivos de ${userEmail} com JWT:`, error);
    throw error;
  }
}; 

// Configurar webhook do Drive usando JWT
exports.configurarWatchDriveJWT = async (email, webhookUrl) => {
  try {
    console.log(`Configurando webhook do Drive para ${email} (usando JWT)`);
    
    // Usar a nova abordagem JWT
    const { getDriveClient } = require('../config/googleJWT');
    const drive = await getDriveClient(email);

    // Obter token de página inicial
    const about = await drive.about.get({
      fields: '*'
    });
    const startPageToken = about.data.startPageToken;

    // Configurar watch
    const watchResponse = await drive.changes.watch({
      pageToken: startPageToken,
      requestBody: {
        id: `drive-watch-${email}-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });

    console.log('Webhook configurado com sucesso:', watchResponse.data);
    return watchResponse.data;
  } catch (error) {
    console.error('Erro ao configurar watch do Drive:', error);
    throw error;
  }
}; 

// Registrar webhook do Drive usando JWT (APENAS SHARED DRIVES)
exports.registrarWebhookDriveJWT = async (email, webhookUrl) => {
  try {
    const { getDriveClient } = require('../config/googleJWT');
    // Impersonar o usuário alvo
    const drive = await getDriveClient(email);

    // Verificar se o usuário tem acesso a Shared Drives
    console.log(`🔍 Verificando Shared Drives para ${email}...`);
    const drivesResponse = await drive.drives.list();
    const sharedDrives = drivesResponse.data.drives || [];
    
    if (sharedDrives.length === 0) {
      console.log(`⚠️ Nenhum Shared Drive encontrado para ${email}`);
      throw new Error(`Usuário ${email} não tem acesso a Shared Drives`);
    }
    
    console.log(`📁 Encontrados ${sharedDrives.length} Shared Drives para ${email}`);

    // Obter startPageToken corretamente (incluindo Shared Drives)
    const startPageTokenResponse = await drive.changes.getStartPageToken({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    const startPageToken = startPageTokenResponse.data.startPageToken;
    if (!startPageToken) throw new Error('startPageToken não encontrado');

    console.log(`📄 StartPageToken obtido: ${startPageToken}`);

    // Registrar canal de webhook com UUID válido (incluindo Shared Drives)
    const response = await drive.changes.watch({
      pageToken: startPageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      requestBody: {
        id: `shared-drives-watch-${email}-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });
    
    console.log('✅ Canal do Drive (Shared Drives) registrado:', response.data);
    console.log(`📊 Configurado para monitorar ${sharedDrives.length} Shared Drives`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao registrar webhook do Drive (Shared Drives):', error.message);
    throw error;
  }
}; 

// Processar arquivo individual do Drive via webhook (APENAS SHARED DRIVES)
exports.processarArquivoDriveJWT = async (arquivo, userEmail) => {
  try {
    // Buscar usuário pelo email
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.warn(`Usuário não encontrado: ${userEmail}`);
      return;
    }

    // Verificar se é um arquivo de Shared Drive
    if (!arquivo.driveId) {
      console.log(`🚫 Arquivo do Meu Drive ignorado: ${arquivo.name} (${arquivo.id})`);
      return;
    }

    console.log(`📁 Processando arquivo do Shared Drive: ${arquivo.name} (Drive: ${arquivo.driveId})`);

    const isFolder = arquivo.mimeType === 'application/vnd.google-apps.folder';

    if (isFolder) {
      // Salvar/atualizar pasta
      await driveFolderModel.upsertFolder({
        usuario_id: usuario.id,
        folder_id: cleanId(arquivo.id),
        nome: arquivo.name,
        caminho_completo: null,
        parent_folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
        cor_rgb: null,
        compartilhado: arquivo.shared || false,
        visibilidade: null,
        permissoes: null,
        criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
        modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
        ultimo_acesso: null,
        tamanho_total: 0,
        quantidade_arquivos: 0,
        quantidade_subpastas: 0,
        dados_completos: arquivo,
        origem_drive: arquivo.driveId,
        nome_drive: arquivo.driveName || null
      });
      console.log(`✅ Pasta do Shared Drive processada: ${arquivo.name} (${arquivo.driveId})`);
    } else {
      // Salvar/atualizar arquivo
      await driveFileModel.upsertFile({
        usuario_id: usuario.id,
        file_id: cleanId(arquivo.id),
        nome: arquivo.name,
        mime_type: arquivo.mimeType,
        tamanho: arquivo.size || null,
        folder_id: arquivo.parents ? cleanId(arquivo.parents[0]) : null,
        caminho_completo: null,
        dono_email: arquivo.owners && arquivo.owners[0] ? arquivo.owners[0].emailAddress : null,
        compartilhado: arquivo.shared || false,
        visibilidade: null,
        permissoes: null,
        criado_em: arquivo.createdTime ? new Date(arquivo.createdTime) : null,
        modificado_em: arquivo.modifiedTime ? new Date(arquivo.modifiedTime) : null,
        versao: arquivo.version ? parseInt(arquivo.version) : 1,
        md5_checksum: arquivo.md5Checksum || null,
        web_view_link: arquivo.webViewLink || null,
        download_link: arquivo.exportLinks ? JSON.stringify(arquivo.exportLinks) : null,
        thumbnail_link: arquivo.thumbnailLink || null,
        starred: arquivo.starred || false,
        trashed: arquivo.trashed || false,
        tipo_arquivo: arquivo.mimeType ? arquivo.mimeType.split('.').pop() : null,
        extensao: arquivo.name && arquivo.name.includes('.') ? arquivo.name.split('.').pop() : null,
        dados_completos: arquivo,
        origem_drive: arquivo.driveId,
        nome_drive: arquivo.driveName || null
      });
      console.log(`✅ Arquivo do Shared Drive processado: ${arquivo.name} (${arquivo.driveId})`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar arquivo do Shared Drive:', error.message);
    throw error;
  }
};

// Marcar arquivo como deletado no banco
exports.marcarArquivoComoDeletado = async (fileId, userEmail) => {
  try {
    // Buscar usuário pelo email
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.warn(`Usuário não encontrado: ${userEmail}`);
      return;
    }

    // Marcar arquivo como deletado
    await driveFileModel.marcarComoDeletado(fileId, usuario.id);
    console.log(`🗑️ Arquivo marcado como deletado: ${fileId}`);
  } catch (error) {
    console.error('Erro ao marcar arquivo como deletado:', error.message);
    throw error;
  }
}; 

 

 