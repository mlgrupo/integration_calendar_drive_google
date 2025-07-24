const { getCalendarClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');
const calendarEventModel = require('../models/calendarEventModel');

// Sincronizar eventos do Calendar para todos os usuários usando JWT
exports.syncCalendarEventsJWT = async () => {
  try {
    const usuarios = await userModel.getAllUsers();
    let totalEventos = 0;
    let totalReunioes = 0;

    console.log(`Iniciando sincronização JWT do Calendar para ${usuarios.length} usuários...`);

    for (const usuario of usuarios) {
      console.log(`\n=== Processando usuário: ${usuario.email} ===`);
      try {
        const calendar = await getCalendarClient(usuario.email);
        // Buscar todos os calendários do usuário
        const calendarsResponse = await calendar.calendarList.list();
        const calendars = calendarsResponse.data.items || [];
        for (const cal of calendars) {
          // Buscar eventos do calendário
          const eventsResponse = await calendar.events.list({
            calendarId: cal.id,
            timeMin: new Date().toISOString(),
            maxResults: 1000,
            singleEvents: true,
            orderBy: 'startTime'
          });
          for (const evento of eventsResponse.data.items) {
            const isReuniao = evento.conferenceData || 
              (evento.description && evento.description.toLowerCase().includes('meet')) ||
              (evento.description && evento.description.toLowerCase().includes('zoom'));
            await calendarEventModel.upsertEvent({
              usuario_id: usuario.id,
              event_id: evento.id,
              titulo: evento.summary || (isReuniao ? 'Reunião sem título' : 'Evento sem título'),
              descricao: evento.description || null,
              localizacao: evento.location || null,
              data_inicio: evento.start?.dateTime ? new Date(evento.start.dateTime) : null,
              data_fim: evento.end?.dateTime ? new Date(evento.end.dateTime) : null,
              duracao_minutos: evento.start?.dateTime && evento.end?.dateTime ? 
                Math.round((new Date(evento.end.dateTime) - new Date(evento.start.dateTime)) / (1000 * 60)) : null,
              recorrente: !!evento.recurrence,
              recorrencia: evento.recurrence ? evento.recurrence.join(';') : null,
              calendario_id: cal.id,
              calendario_nome: cal.summary,
              status: evento.status || 'confirmed',
              visibilidade: evento.visibility || 'default',
              transparencia: evento.transparency || 'opaque',
              convidados: evento.attendees ? JSON.stringify(evento.attendees) : null,
              organizador_email: evento.organizer?.email || null,
              organizador_nome: evento.organizer?.displayName || null,
              criado_em: evento.created ? new Date(evento.created) : null,
              modificado_em: evento.updated ? new Date(evento.updated) : null,
              dados_completos: evento
            });
            if (isReuniao) totalReunioes++; else totalEventos++;
          }
        }
      } catch (userError) {
        console.error(`Erro ao processar usuário ${usuario.email}:`, userError.message);
        // Continua para o próximo usuário
      }
    }
    console.log(`\n=== Sincronização JWT do Calendar concluída ===`);
    console.log(`Total: ${totalEventos} eventos, ${totalReunioes} reuniões`);
    return { totalEventos, totalReunioes };
  } catch (error) {
    console.error('Erro ao sincronizar eventos do Calendar com JWT:', error);
    throw error;
  }
}; 