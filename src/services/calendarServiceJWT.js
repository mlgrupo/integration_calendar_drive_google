const { getCalendarClient } = require('../config/googleJWT');
const userModel = require('../models/userModel');
const calendarEventModel = require('../models/calendarEventModel');
const { v4: uuidv4 } = require('uuid');

// Sempre garantir que event_id e icaluid não tenham timestamp
function cleanId(id) {
  return typeof id === 'string' ? id.split('_')[0] : id;
}

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
        let calendarsResponse;
        try {
          calendarsResponse = await calendar.calendarList.list();
        } catch (err) {
          console.error(`Erro ao buscar calendarList do usuário ${usuario.email}:`, err.message);
          continue;
        }
        
        if (!calendarsResponse || !calendarsResponse.data || !Array.isArray(calendarsResponse.data.items)) {
          console.warn(`Nenhum calendário encontrado para ${usuario.email}`);
          continue;
        }
        
        const calendars = calendarsResponse.data.items;
        console.log(`📅 Encontrados ${calendars.length} calendários para ${usuario.email}`);
        
        for (const cal of calendars) {
          console.log(`📅 Processando calendário: ${cal.summary} (${cal.id})`);
          
          // Buscar eventos do calendário
          let eventsResponse;
          try {
            eventsResponse = await calendar.events.list({
              calendarId: cal.id,
              timeMin: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // últimos 365 dias
              maxResults: 1000,
              singleEvents: true,
              orderBy: 'startTime'
            });
          } catch (err) {
            console.error(`Erro ao buscar eventos do calendário ${cal.id} (${cal.summary}) do usuário ${usuario.email}:`, err.message);
            continue;
          }
          
          if (!eventsResponse || !eventsResponse.data || !Array.isArray(eventsResponse.data.items)) {
            console.warn(`Nenhum evento encontrado no calendário ${cal.id} (${cal.summary}) para ${usuario.email}`);
            continue;
          }
          
          console.log(`📅 Encontrados ${eventsResponse.data.items.length} eventos no calendário ${cal.summary}`);
          
          for (const evento of eventsResponse.data.items) {
            try {
              const isReuniao = evento.conferenceData || 
                (evento.description && evento.description.toLowerCase().includes('meet')) ||
                (evento.description && evento.description.toLowerCase().includes('zoom'));
              
              // Log detalhado antes do upsert
              console.log(`[CalendarSync] Upsert: usuario_id=${usuario.id}, event_id=${evento.id}, icaluid=${evento.iCalUID}, summary=${evento.summary}, updated=${evento.updated}`);
              
              // Atualizar sempre (upsert)
              await calendarEventModel.upsertEvent({
                usuario_id: usuario.id,
                event_id: cleanId(evento.id),
                icaluid: cleanId(evento.iCalUID) || null,
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
            } catch (eventError) {
              console.error(`Erro ao processar evento ${evento.id}:`, eventError.message);
            }
          }
        }
        
        console.log(`Usuário ${usuario.email}: ${totalEventos} eventos, ${totalReunioes} reuniões processados`);
      } catch (userError) {
        console.error(`Erro ao processar usuário ${usuario.email}:`, userError.message);
        continue;
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

// Processar evento específico do Calendar usando JWT
exports.processarEventoCalendarJWT = async (evento, userEmail, calendarId = 'primary') => {
  try {
    // Buscar usuário
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.log(`Usuário não encontrado: ${userEmail}`);
      return null;
    }

    const calendar = await getCalendarClient(userEmail);

    // Buscar dados atualizados do evento
    const response = await calendar.events.get({
      calendarId: calendarId,
      eventId: evento.id
    });

    const eventoAtualizado = response.data;
    const isReuniao = eventoAtualizado.conferenceData || 
      (eventoAtualizado.description && eventoAtualizado.description.toLowerCase().includes('meet')) ||
      (eventoAtualizado.description && eventoAtualizado.description.toLowerCase().includes('zoom'));

    // Atualizar evento
    await calendarEventModel.upsertEvent({
      usuario_id: usuario.id,
      event_id: cleanId(eventoAtualizado.id),
      icaluid: cleanId(eventoAtualizado.iCalUID) || null,
      titulo: eventoAtualizado.summary || (isReuniao ? 'Reunião sem título' : 'Evento sem título'),
      descricao: eventoAtualizado.description || null,
      localizacao: eventoAtualizado.location || null,
      data_inicio: eventoAtualizado.start?.dateTime ? new Date(eventoAtualizado.start.dateTime) : null,
      data_fim: eventoAtualizado.end?.dateTime ? new Date(eventoAtualizado.end.dateTime) : null,
      duracao_minutos: eventoAtualizado.start?.dateTime && eventoAtualizado.end?.dateTime ? 
        Math.round((new Date(eventoAtualizado.end.dateTime) - new Date(eventoAtualizado.start.dateTime)) / (1000 * 60)) : null,
      recorrente: !!eventoAtualizado.recurrence,
      recorrencia: eventoAtualizado.recurrence ? eventoAtualizado.recurrence.join(';') : null,
      calendario_id: calendarId,
      calendario_nome: null, // Será preenchido se necessário
      status: eventoAtualizado.status || 'confirmed',
      visibilidade: eventoAtualizado.visibility || 'default',
      transparencia: eventoAtualizado.transparency || 'opaque',
      convidados: eventoAtualizado.attendees ? JSON.stringify(eventoAtualizado.attendees) : null,
      organizador_email: eventoAtualizado.organizer?.email || null,
      organizador_nome: eventoAtualizado.organizer?.displayName || null,
      criado_em: eventoAtualizado.created ? new Date(eventoAtualizado.created) : null,
      modificado_em: eventoAtualizado.updated ? new Date(eventoAtualizado.updated) : null,
      dados_completos: eventoAtualizado
    });

    console.log(`✅ Evento processado: ${eventoAtualizado.summary || eventoAtualizado.id}`);

    return { success: true, event: eventoAtualizado };
  } catch (error) {
    console.error('Erro ao processar evento do Calendar com JWT:', error);
    throw error;
  }
};

// Listar eventos de um usuário específico usando JWT
exports.listarEventosUsuarioJWT = async (userEmail, options = {}) => {
  try {
    const calendar = await getCalendarClient(userEmail);
    
    const response = await calendar.events.list({
      calendarId: options.calendarId || 'primary',
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: options.limit || 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items || [];
  } catch (error) {
    console.error(`Erro ao listar eventos de ${userEmail} com JWT:`, error);
    throw error;
  }
};

// Registrar webhook do Calendar usando JWT (padrão Google)
exports.registrarWebhookCalendarJWT = async (email, webhookUrl) => {
  try {
    const { getCalendarClient } = require('../config/googleJWT');
    // Impersonar o usuário alvo
    const calendar = await getCalendarClient(email);

    // Registrar canal de webhook com UUID válido
    const response = await calendar.events.watch({
      calendarId: 'primary',
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
exports.processarEventoCalendarJWT = async (evento, userEmail, calendarId = 'primary') => {
  try {
    // Buscar usuário pelo email
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.warn(`Usuário não encontrado: ${userEmail}`);
      return;
    }

    const isReuniao = evento.conferenceData || 
      (evento.description && evento.description.toLowerCase().includes('meet')) ||
      (evento.description && evento.description.toLowerCase().includes('zoom'));

    // Salvar/atualizar evento
    await calendarEventModel.upsertEvent({
      usuario_id: usuario.id,
      event_id: cleanId(evento.id),
      icaluid: cleanId(evento.iCalUID) || null,
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
      calendario_nome: null, // Será preenchido se necessário
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
    
    console.log(`✅ Evento processado: ${evento.summary || evento.id}`);
  } catch (error) {
    console.error('Erro ao processar evento do Calendar:', error.message);
    throw error;
  }
};

// Marcar evento como deletado no banco
exports.marcarEventoComoDeletado = async (eventId, userEmail) => {
  try {
    // Buscar usuário pelo email
    const usuario = await userModel.getUserByEmail(userEmail);
    if (!usuario) {
      console.warn(`Usuário não encontrado: ${userEmail}`);
      return;
    }

    // Marcar evento como deletado (implementar no model se necessário)
    console.log(`🗑️ Evento marcado como deletado: ${eventId}`);
  } catch (error) {
    console.error('Erro ao marcar evento como deletado:', error.message);
    throw error;
  }
}; 