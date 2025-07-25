const { getCalendarClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');
const calendarEventModel = require('../models/calendarEventModel');
const { v4: uuidv4 } = require('uuid');

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

// Registrar webhook do Google Calendar usando JWT (padrão Google)
exports.registrarWebhookCalendarJWT = async (email, calendarId, webhookUrl) => {
  try {
    const { getCalendarClient } = require('../config/googleJWT');
    // Calendar: JWT deve ser para o usuário alvo (não superadmin)
    const calendar = await getCalendarClient(email);

    // Registrar canal de webhook com UUID válido
    const response = await calendar.events.watch({
      calendarId: calendarId,
      requestBody: {
        id: uuidv4(),
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });
    console.log('Canal do Calendar registrado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao registrar webhook do Calendar:', error.message);
    throw error;
  }
}; 

// Processar evento individual do Calendar via webhook
exports.processarEventoCalendarJWT = async (evento, userEmail, calendarId) => {
  try {
    // Buscar usuário no banco
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.warn(`Usuário não encontrado: ${userEmail}`);
      return;
    }

    // Verificar se é reunião
    const isReuniao = evento.conferenceData || 
      (evento.description && evento.description.toLowerCase().includes('meet')) ||
      (evento.description && evento.description.toLowerCase().includes('zoom'));

    // Buscar informações do calendário
    const calendar = await getCalendarClient(userEmail);
    const calendarInfo = await calendar.calendarList.get({ calendarId });
    const calendarName = calendarInfo.data.summary || calendarId;

    // Salvar/atualizar evento no banco
    await calendarEventModel.upsertEvent({
      usuario_id: usuario.id,
      event_id: evento.id,
      icaluid: evento.iCalUID || null,
      titulo: evento.summary || (isReuniao ? 'Reunião sem título' : 'Evento sem título'),
      descricao: evento.description || null,
      localizacao: evento.location || null,
      data_inicio: evento.start?.dateTime ? new Date(evento.start.dateTime) : null,
      data_fim: evento.end?.dateTime ? new Date(evento.end.dateTime) : null,
      duracao_minutos: evento.start?.dateTime && evento.end?.dateTime ? 
        Math.round((new Date(evento.end.dateTime) - new Date(evento.start.dateTime)) / (1000 * 60)) : null,
      recorrente: !!evento.recurrence,
      recorrencia: evento.recurrence ? evento.recurrence.join(';') : null,
      calendario_id: calendarId,
      calendario_nome: calendarName,
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

    console.log(`✅ Evento processado: ${evento.summary || 'Sem título'} (${isReuniao ? 'Reunião' : 'Evento'})`);
  } catch (error) {
    console.error('Erro ao processar evento do Calendar:', error.message);
    throw error;
  }
}; 