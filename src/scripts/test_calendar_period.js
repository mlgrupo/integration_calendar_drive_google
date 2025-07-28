const calendarServiceJWT = require('../services/calendarServiceJWT');
const userModel = require('../models/userModel');

async function testCalendarPeriod() {
  try {
    console.log('🧪 Testando período do Calendar (1 mês para trás e 1 mês para frente)...');
    
    // Buscar um usuário para teste
    const usuarios = await userModel.getAllUsers();
    if (usuários.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const usuario = usuarios[0];
    console.log(`👤 Usando usuário: ${usuario.email} (ID: ${usuario.id})`);
    
    // 1. Calcular período
    console.log('\n📅 1. Calculando período de busca...');
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    console.log(`   Data atual: ${now.toISOString()}`);
    console.log(`   1 mês atrás: ${oneMonthAgo.toISOString()}`);
    console.log(`   1 mês à frente: ${oneMonthAhead.toISOString()}`);
    console.log(`   Período total: ${Math.round((oneMonthAhead - oneMonthAgo) / (1000 * 60 * 60 * 24))} dias`);
    
    // 2. Testar busca de eventos
    console.log('\n📅 2. Testando busca de eventos...');
    
    try {
      const { getCalendarClient } = require('../config/googleJWT');
      const calendar = await getCalendarClient(usuario.email);
      
      // Buscar calendários
      const calendarsResponse = await calendar.calendarList.list();
      const calendars = calendarsResponse.data.items || [];
      
      console.log(`📅 Encontrados ${calendars.length} calendários`);
      
      let totalEventos = 0;
      for (const cal of calendars) {
        try {
          console.log(`\n📅 Buscando eventos no calendário: ${cal.summary}`);
          
          const eventsResponse = await calendar.events.list({
            calendarId: cal.id,
            timeMin: oneMonthAgo.toISOString(),
            timeMax: oneMonthAhead.toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime'
          });
          
          const eventos = eventsResponse.data.items || [];
          console.log(`   ✅ Encontrados ${eventos.length} eventos`);
          
          if (eventos.length > 0) {
            console.log(`   📊 Primeiros 3 eventos:`);
            eventos.slice(0, 3).forEach((evento, index) => {
              const startDate = evento.start?.dateTime ? new Date(evento.start.dateTime) : null;
              const endDate = evento.end?.dateTime ? new Date(evento.end.dateTime) : null;
              
              console.log(`      ${index + 1}. ${evento.summary || 'Sem título'}`);
              console.log(`         Início: ${startDate ? startDate.toISOString() : 'N/A'}`);
              console.log(`         Fim: ${endDate ? endDate.toISOString() : 'N/A'}`);
            });
          }
          
          totalEventos += eventos.length;
          
        } catch (calError) {
          console.error(`   ❌ Erro no calendário ${cal.summary}:`, calError.message);
        }
      }
      
      console.log(`\n📊 Total de eventos encontrados: ${totalEventos}`);
      
    } catch (apiError) {
      console.error('❌ Erro ao acessar API do Calendar:', apiError.message);
    }
    
    // 3. Testar sincronização completa
    console.log('\n📅 3. Testando sincronização completa...');
    
    try {
      const resultado = await calendarServiceJWT.syncCalendarEventsJWT();
      console.log('✅ Sincronização concluída:', resultado);
    } catch (syncError) {
      console.error('❌ Erro na sincronização:', syncError.message);
    }
    
    // 4. Verificar eventos no banco
    console.log('\n📅 4. Verificando eventos no banco de dados...');
    
    const pool = require('../config/database');
    const { rows } = await pool.query(
      `SELECT 
        event_id, 
        titulo, 
        data_inicio, 
        data_fim,
        criado_em
       FROM google.calendar_events 
       WHERE usuario_id = $1 
       AND data_inicio >= $2 
       AND data_inicio <= $3
       ORDER BY data_inicio ASC 
       LIMIT 10`,
      [usuario.id, oneMonthAgo.toISOString(), oneMonthAhead.toISOString()]
    );
    
    if (rows.length > 0) {
      console.log(`📊 Eventos no banco (período de 1 mês):`);
      rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.titulo}`);
        console.log(`      Início: ${row.data_inicio}`);
        console.log(`      Fim: ${row.data_fim}`);
        console.log(`      Criado: ${row.criado_em}`);
      });
    } else {
      console.log('⚠️ Nenhum evento encontrado no banco para o período especificado');
    }
    
    console.log('\n🎉 Teste de período do Calendar concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testCalendarPeriod().then(() => {
    console.log('🏁 Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testCalendarPeriod }; 