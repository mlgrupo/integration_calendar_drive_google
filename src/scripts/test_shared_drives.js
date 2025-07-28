const driveServiceJWT = require('../services/driveServiceJWT');
const userModel = require('../models/userModel');

async function testSharedDrives() {
  try {
    console.log('🧪 Testando funcionalidades de Shared Drives...');
    
    // Buscar um usuário para teste
    const usuarios = await userModel.getAllUsers();
    if (usuarios.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const usuario = usuarios[0];
    console.log(`👤 Usando usuário: ${usuario.email} (ID: ${usuario.id})`);
    
    // 1. Testar listagem de Shared Drives
    console.log('\n📁 1. Testando listagem de Shared Drives...');
    const sharedDrives = await driveServiceJWT.listarSharedDrivesUsuarioJWT(usuario.email);
    
    if (sharedDrives.length === 0) {
      console.log('⚠️ Nenhum Shared Drive encontrado para este usuário');
      console.log('💡 Dica: Verifique se o usuário tem acesso a Shared Drives');
      return;
    }
    
    console.log(`✅ Encontrados ${sharedDrives.length} Shared Drives:`);
    sharedDrives.forEach((drive, index) => {
      console.log(`   ${index + 1}. ${drive.name} (${drive.id})`);
    });
    
    // 2. Testar listagem de arquivos do primeiro Shared Drive
    const primeiroDrive = sharedDrives[0];
    console.log(`\n📂 2. Testando listagem de arquivos do Shared Drive: ${primeiroDrive.name}`);
    
    const arquivos = await driveServiceJWT.listarArquivosSharedDriveJWT(
      usuario.email, 
      primeiroDrive.id,
      { limit: 10 }
    );
    
    console.log(`✅ Encontrados ${arquivos.length} arquivos no Shared Drive "${primeiroDrive.name}":`);
    arquivos.forEach((arquivo, index) => {
      const tipo = arquivo.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
      console.log(`   ${index + 1}. ${tipo} ${arquivo.name} (${arquivo.id})`);
    });
    
    // 3. Testar sincronização completa (apenas Shared Drives)
    console.log('\n🔄 3. Testando sincronização completa (apenas Shared Drives)...');
    const resultado = await driveServiceJWT.syncDriveFilesJWT();
    
    console.log(`✅ Sincronização concluída:`);
    console.log(`   📄 Arquivos: ${resultado.totalArquivos}`);
    console.log(`   📁 Pastas: ${resultado.totalPastas}`);
    
    console.log('\n🎉 Todos os testes passaram!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testSharedDrives().then(() => {
    console.log('🏁 Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testSharedDrives }; 