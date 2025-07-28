const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');

async function testDriveSyncComplete() {
  try {
    console.log('🧪 Testando sincronização completa do Drive (Shared Drives)...');
    
    // Buscar um usuário para teste
    const usuarios = await userModel.getAllUsers();
    if (usuarios.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const usuario = usuarios[0];
    console.log(`👤 Usando usuário: ${usuario.email} (ID: ${usuario.id})`);
    
    // 1. Verificar Shared Drives disponíveis
    console.log('\n📁 1. Verificando Shared Drives disponíveis...');
    
    try {
      const { getDriveClient } = require('../config/googleJWT');
      const drive = await getDriveClient(usuario.email);
      
      const drivesResponse = await drive.drives.list();
      const sharedDrives = drivesResponse.data.drives || [];
      
      if (sharedDrives.length === 0) {
        console.log('⚠️ Nenhum Shared Drive encontrado para este usuário');
        return;
      }
      
      console.log(`📁 Encontrados ${sharedDrives.length} Shared Drives:`);
      sharedDrives.forEach((drive, index) => {
        console.log(`   ${index + 1}. ${drive.name} (${drive.id})`);
      });
      
      // 2. Testar busca com paginação em cada Shared Drive
      console.log('\n📁 2. Testando busca com paginação...');
      
      let totalArquivos = 0;
      let totalPastas = 0;
      
      for (const sharedDrive of sharedDrives) {
        console.log(`\n📂 Processando Shared Drive: ${sharedDrive.name} (${sharedDrive.id})`);
        
        let allFiles = [];
        let nextPageToken = null;
        let pageCount = 0;
        
        // Buscar todos os arquivos com paginação
        do {
          pageCount++;
          console.log(`   📄 Buscando página ${pageCount}...`);
          
          const response = await drive.files.list({
            pageSize: 1000,
            pageToken: nextPageToken,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed, version, md5Checksum, exportLinks, thumbnailLink)',
            q: 'trashed = false',
            corpora: 'drive',
            driveId: sharedDrive.id,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true
          });
          
          const files = response.data.files || [];
          allFiles = allFiles.concat(files);
          nextPageToken = response.data.nextPageToken;
          
          console.log(`   📄 Página ${pageCount}: ${files.length} arquivos encontrados`);
          
        } while (nextPageToken);
        
        console.log(`📄 Total de ${allFiles.length} itens no Shared Drive: ${sharedDrive.name} (${pageCount} páginas)`);
        
        // Contar arquivos e pastas
        let arquivosCount = 0;
        let pastasCount = 0;
        
        allFiles.forEach(file => {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            pastasCount++;
          } else {
            arquivosCount++;
          }
        });
        
        console.log(`   📊 Resumo: ${arquivosCount} arquivos, ${pastasCount} pastas`);
        
        totalArquivos += arquivosCount;
        totalPastas += pastasCount;
        
        // Mostrar alguns exemplos
        if (allFiles.length > 0) {
          console.log(`   📋 Exemplos de arquivos:`);
          allFiles.slice(0, 5).forEach((file, index) => {
            const type = file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
            console.log(`      ${index + 1}. ${type} ${file.name} (${file.id})`);
          });
          
          if (allFiles.length > 5) {
            console.log(`      ... e mais ${allFiles.length - 5} itens`);
          }
        }
      }
      
      console.log(`\n📊 Resumo geral:`);
      console.log(`   Total de arquivos: ${totalArquivos}`);
      console.log(`   Total de pastas: ${totalPastas}`);
      console.log(`   Total de itens: ${totalArquivos + totalPastas}`);
      
    } catch (apiError) {
      console.error('❌ Erro ao acessar API do Drive:', apiError.message);
    }
    
    // 3. Testar sincronização completa
    console.log('\n📁 3. Testando sincronização completa...');
    
    try {
      const resultado = await driveServiceJWT.syncDriveFilesJWT();
      console.log('✅ Sincronização concluída:', resultado);
    } catch (syncError) {
      console.error('❌ Erro na sincronização:', syncError.message);
    }
    
    // 4. Verificar arquivos no banco
    console.log('\n📁 4. Verificando arquivos no banco de dados...');
    
    const pool = require('../config/database');
    const { rows: files } = await pool.query(
      'SELECT COUNT(*) as total FROM google.drive_files WHERE usuario_id = $1',
      [usuario.id]
    );
    
    const { rows: folders } = await pool.query(
      'SELECT COUNT(*) as total FROM google.drive_folders WHERE usuario_id = $1',
      [usuario.id]
    );
    
    console.log(`📊 Arquivos no banco: ${files[0]?.total || 0}`);
    console.log(`📊 Pastas no banco: ${folders[0]?.total || 0}`);
    
    // Verificar alguns arquivos recentes
    const { rows: recentFiles } = await pool.query(
      `SELECT nome, mime_type, tamanho, origem_drive, nome_drive 
       FROM google.drive_files 
       WHERE usuario_id = $1 
       ORDER BY criado_em DESC 
       LIMIT 5`,
      [usuario.id]
    );
    
    if (recentFiles.length > 0) {
      console.log(`📋 Arquivos recentes no banco:`);
      recentFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.nome} (${file.mime_type}) - ${file.origem_drive}`);
      });
    }
    
    console.log('\n🎉 Teste de sincronização completa do Drive concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testDriveSyncComplete().then(() => {
    console.log('🏁 Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testDriveSyncComplete }; 