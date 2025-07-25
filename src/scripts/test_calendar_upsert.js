const calendarEventModel = require('../models/calendarEventModel');
const userModel = require('../models/userModel');

async function testCalendarUpsert() {
  try {
    console.log('🧪 Testando upsert de eventos do Calendar...');
    
    // Buscar um usuário para teste
    const usuarios = await userModel.getAllUsers();
    if (usuarios.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const usuario = usuarios[0];
    console.log(`👤 Usando usuário: ${usuario.email} (ID: ${usuario.id})`);
    
    // Dados de teste
    const eventoTeste = {
      usuario_id: usuario.id,
      event_id: 'test_event_123',
      icaluid: 'test_icaluid_456@google.com',
      titulo: 'Evento de Teste',
      descricao: 'Descrição do evento de teste',
      localizacao: 'Local de Teste',
      data_inicio: new Date(),
      data_fim: new Date(Date.now() + 60 * 60 * 1000), // 1 hora depois
      duracao_minutos: 60,
      recorrente: false,
      recorrencia: null,
      calendario_id: 'primary',
      calendario_nome: 'Calendário Principal',
      status: 'confirmed',
      visibilidade: 'default',
      transparencia: 'opaque',
      convidados: JSON.stringify([]),
      organizador_email: usuario.email,
      organizador_nome: 'Teste',
      criado_em: new Date(),
      modificado_em: new Date(),
      dados_completos: { test: true }
    };
    
    console.log('📝 Inserindo evento de teste...');
    const resultado1 = await calendarEventModel.upsertEvent(eventoTeste);
    console.log('✅ Primeira inserção:', resultado1.id, resultado1.titulo);
    
    // Tentar inserir o mesmo evento (deve fazer update)
    console.log('📝 Tentando inserir o mesmo evento (deve fazer update)...');
    eventoTeste.titulo = 'Evento de Teste - ATUALIZADO';
    eventoTeste.modificado_em = new Date();
    
    const resultado2 = await calendarEventModel.upsertEvent(eventoTeste);
    console.log('✅ Segunda inserção (update):', resultado2.id, resultado2.titulo);
    
    // Testar com evento sem icaluid
    console.log('📝 Testando evento sem icaluid...');
    const eventoTeste2 = {
      ...eventoTeste,
      event_id: 'test_event_789',
      icaluid: null,
      titulo: 'Evento sem iCalUID'
    };
    
    const resultado3 = await calendarEventModel.upsertEvent(eventoTeste2);
    console.log('✅ Evento sem icaluid:', resultado3.id, resultado3.titulo);
    
    console.log('🎉 Todos os testes passaram!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testCalendarUpsert().then(() => {
    console.log('🏁 Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testCalendarUpsert }; 