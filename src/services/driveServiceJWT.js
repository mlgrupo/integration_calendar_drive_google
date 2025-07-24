const { getDriveClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');
const driveFileModel = require('../models/driveFileModel');
const driveFolderModel = require('../models/driveFolderModel');
// const logModel = require('../models/logModel'); // Comentado temporariamente

// Sincronizar arquivos e pastas do Drive para todos os usuários usando JWT
exports.syncDriveFilesJWT = async () => {
  try {
    const usuarios = await userModel.getAllUsers();
    let totalArquivos = 0;
    let totalPastas = 0;

    console.log(`Iniciando sincronização JWT para ${usuarios.length} usuários...`);

    for (const usuario of usuarios) {
      console.log(`\n=== Processando usuário: ${usuario.email} ===`);
      
      try {
        // Usar a nova abordagem JWT
        const drive = await getDriveClient(usuario.email);

        // Buscar todos os arquivos
        console.log('Buscando arquivos com JWT...');
        const response = await drive.files.list({
          pageSize: 1000,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed, version, md5Checksum, exportLinks, thumbnailLink)'
        });

        const allFiles = response.data.files || [];

        // Mostrar alguns exemplos dos arquivos encontrados
        if (allFiles.length > 0) {
          console.log(`Arquivos encontrados: ${allFiles.length}`);
          console.log('Primeiros 5 arquivos:');
          allFiles.slice(0, 5).forEach((file, index) => {
            console.log(`${index + 1}. ${file.name} (${file.mimeType}) - Owner: ${file.owners?.[0]?.emailAddress || 'N/A'} - Shared: ${file.shared || false}`);
          });
        }

        // Processar arquivos encontrados
        for (const arquivo of allFiles) {
          const isFolder = arquivo.mimeType === 'application/vnd.google-apps.folder';
          console.log(`Processando: ${arquivo.name} (${isFolder ? 'pasta' : 'arquivo'})`);

          if (isFolder) {
            // Salvar/atualizar pasta
            await driveFolderModel.upsertFolder({
              usuario_id: usuario.id,
              folder_id: arquivo.id,
              nome: arquivo.name,
              caminho_completo: null, // Pode ser montado depois
              parent_folder_id: arquivo.parents ? arquivo.parents[0] : null,
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
            totalPastas++;
          } else {
            // Salvar/atualizar arquivo
            await driveFileModel.upsertFile({
              usuario_id: usuario.id,
              file_id: arquivo.id,
              nome: arquivo.name,
              mime_type: arquivo.mimeType,
              tamanho: arquivo.size || null,
              folder_id: arquivo.parents ? arquivo.parents[0] : null,
              caminho_completo: null, // Pode ser montado depois
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
            totalArquivos++;
          }

          // Registrar log de evento do Drive (comentado temporariamente)
          /*
          await logModel.logDriveEvent({
            usuario_id: usuario.id,
            tipo_evento: 'sync_jwt',
            recurso_tipo: isFolder ? 'folder' : 'file',
            recurso_id: arquivo.id,
            detalhes: `Sincronização de ${isFolder ? 'pasta' : 'arquivo'} via JWT`,
            dados_anteriores: null,
            dados_novos: arquivo,
            ip_origem: null,
            user_agent: null,
            timestamp_evento: new Date()
          });
          */
        }

        console.log(`Usuário ${usuario.email}: ${totalArquivos} arquivos, ${totalPastas} pastas processados`);
        
      } catch (userError) {
        console.error(`Erro ao processar usuário ${usuario.email}:`, userError.message);
        // Continuar com o próximo usuário
      }
    }

    console.log(`\n=== Sincronização JWT concluída ===`);
    console.log(`Total: ${totalArquivos} arquivos, ${totalPastas} pastas`);
    
    return { totalArquivos, totalPastas };
  } catch (error) {
    console.error('Erro ao sincronizar arquivos/pastas do Drive com JWT:', error);
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
        folder_id: arquivo.id,
        nome: arquivo.name,
        caminho_completo: null,
        parent_folder_id: arquivo.parents ? arquivo.parents[0] : null,
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
        file_id: arquivo.id,
        nome: arquivo.name,
        mime_type: arquivo.mimeType,
        tamanho: arquivo.size || null,
        folder_id: arquivo.parents ? arquivo.parents[0] : null,
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

// Listar arquivos de um usuário específico usando JWT
exports.listarArquivosUsuarioJWT = async (userEmail, options = {}) => {
  try {
    const drive = await getDriveClient(userEmail);
    
    const response = await drive.files.list({
      pageSize: options.limit || 100,
      fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed)',
      q: options.query || 'trashed=false'
    });

    return response.data.files || [];
  } catch (error) {
    console.error(`Erro ao listar arquivos de ${userEmail} com JWT:`, error);
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
      fields: 'changes/largestChangeId'
    });
    const startPageToken = about.data.changes.largestChangeId;

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