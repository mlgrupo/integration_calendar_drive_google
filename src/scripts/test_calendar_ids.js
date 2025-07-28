const calendarServiceJWT = require('../services/calendarServiceJWT');
const userModel = require('../models/userModel');

async function testCalendarIds() {
  try {
    console.log('🧪 Testando IDs do Calendar com timestamp...');
    
    // Buscar um usuário para teste
    const usuarios = await userModel.getAllUsers();
    if (usuarios.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const usuario = usuarios[0];
    console.log(`👤 Usando usuário: ${usuario.email} (ID: ${usuario.id})`);
    
    // 1. Testar função cleanId do Calendar
    console.log('\n📅 1. Testando função cleanId do Calendar...');
    
    const testIds = [
      'evento123_20241201T120000Z',
      'evento456_20241202T150000Z',
      'evento789',
      '_evento_especial',
      'evento_com_timestamp_20241203T180000Z'
    ];
    
    console.log('IDs de teste:');
    testIds.forEach(id => {
      const cleaned = calendarServiceJWT.cleanId ? calendarServiceJWT.cleanId(id) : id;
      console.log(`   Original: ${id} -> Limpo: ${cleaned}`);
    });
    
    // 2. Testar sincronização real
    console.log('\n📅 2. Testando sincronização real do Calendar...');
    
    try {
      const resultado = await calendarServiceJWT.syncCalendarEventsJWT();
      console.log('✅ Sincronização concluída:', resultado);
    } catch (syncError) {
      console.error('❌ Erro na sincronização:', syncError.message);
    }
    
    // 3. Verificar eventos no banco
    console.log('\n📅 3. Verificando eventos no banco de dados...');
    
    const calendarEventModel = require('../models/calendarEventModel');
    const pool = require('../config/database');
    
    const { rows } = await pool.query(
      'SELECT event_id, icaluid, titulo FROM google.calendar_events WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 5',
      [usuario.id]
    );
    
    if (rows.length > 0) {
      console.log('📊 Últimos 5 eventos no banco:');
      rows.forEach((row, index) => {
        console.log(`   ${index + 1}. event_id: ${row.event_id}, icaluid: ${row.icaluid}, título: ${row.titulo}`);
      });
    } else {
      console.log('⚠️ Nenhum evento encontrado no banco para este usuário');
    }
    
    console.log('\n🎉 Teste de IDs do Calendar concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testCalendarIds().then(() => {
    console.log('🏁 Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testCalendarIds }; 