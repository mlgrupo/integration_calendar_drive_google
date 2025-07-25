const calendarService = require('../services/calendarService');
const calendarServiceJWT = require('../services/calendarServiceJWT');
const logModel = require('../models/logModel');

// Sincronizar eventos do Calendar
const syncCalendar = async (req, res) => {
  try {
    console.log('Sincronização do Calendar agendada (background)...');
    // Responde imediatamente
    res.status(202).json({ sucesso: true, mensagem: 'Sincronização do Calendar iniciada em background.' });
    // Roda o fluxo em background
    setImmediate(async () => {
      try {
        const resultado = await calendarServiceJWT.syncCalendarEventsJWT();
        await logModel.logAuditoria({
          usuario_id: null,
          acao: 'sync_calendar',
          recurso_tipo: 'calendar',
          recurso_id: 'all_users',
          detalhes: `Sincronização do Calendar executada: ${resultado.totalEventos} eventos, ${resultado.totalReunioes} reuniões`,
          ip_origem: req.ip,
          user_agent: req.get('User-Agent'),
          timestamp_evento: new Date()
        });
        console.log('Sincronização do Calendar finalizada:', resultado);
      } catch (error) {
        console.error('Erro na sincronização do Calendar em background:', error);
      }
    });
  } catch (error) {
    console.error('Erro ao sincronizar Calendar:', error);
    res.status(500).json({ 
      erro: 'Falha ao sincronizar eventos do Calendar', 
      detalhes: error.message 
    });
  }
};

// Configurar webhook do Calendar para todos os usuários do banco
const configurarWebhookCalendar = async (req, res) => {
  try {
    const userModel = require('../models/userModel');
    const webhookUrl = process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/calendar/webhook` : (req.body?.webhookUrl || null);
    if (!webhookUrl) {
      return res.status(400).json({ erro: 'webhookUrl não informado e WEBHOOK_URL não está configurado.' });
    }
    const usuarios = await userModel.getAllUsers();
    let total = 0;
    let erros = [];
    for (const usuario of usuarios) {
      try {
        await calendarServiceJWT.registrarWebhookCalendarJWT(usuario.email, webhookUrl);
        total++;
      } catch (err) {
        erros.push({ email: usuario.email, erro: err.message });
      }
    }
    res.json({ sucesso: true, mensagem: `Webhooks do Calendar configurados para ${total} usuários.`, erros });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao configurar webhooks do Calendar', detalhes: error.message });
  }
};

// Testar webhook do Calendar
const testarWebhookCalendar = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando webhook do Calendar para ${email}`);

    // Simular um webhook de teste
    const testData = {
      events: [
        {
          id: 'test-event-id',
          summary: 'Teste de Evento',
          start: { dateTime: new Date().toISOString() },
          end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
        }
      ]
    };

    // Processar o teste
    const resultado = await calendarServiceJWT.processarEventoCalendarJWT(testData.events[0], email);
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Teste do webhook do Calendar executado!',
      resultado,
      testData
    });
  } catch (error) {
    console.error('Erro ao testar webhook do Calendar:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar webhook do Calendar', 
      detalhes: error.message 
    });
  }
};

// Sincronização do Calendar por usuário
const syncCalendarPorUsuario = async (req, res) => {
  try {
    const { email } = req.params;
    const resultado = await calendarService.syncCalendarEvents(email);
    res.json({ sucesso: true, resultado });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao sincronizar Calendar do usuário', detalhes: error.message });
  }
};

// Webhook do Calendar
const webhookCalendar = async (req, res) => {
  try {
    // Aqui você pode processar a notificação do Google Calendar
    // Exemplo: logar o body recebido
    console.log('Webhook do Calendar recebido:', req.body);
    res.status(200).json({ recebido: true });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao processar webhook do Calendar', detalhes: error.message });
  }
};

// Forçar sincronização manual do Calendar
const forcarSincronizacaoCalendar = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email do usuário é obrigatório'
      });
    }

    console.log(`🔄 Forçando sincronização manual do Calendar para: ${email}`);

    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Sincronização do Calendar iniciada em background',
      usuario: email,
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const userModel = require('../models/userModel');
        const calendarServiceJWT = require('../services/calendarServiceJWT');

        const { getCalendarClient } = require('../config/googleJWT');
        const calendar = await getCalendarClient(email);

        // Buscar todos os calendários do usuário
        let calendarsResponse;
        try {
          calendarsResponse = await calendar.calendarList.list();
        } catch (err) {
          console.error(`Erro ao buscar calendarList do usuário ${email}:`, err.message);
          return;
        }
        
        if (!calendarsResponse || !calendarsResponse.data || !Array.isArray(calendarsResponse.data.items)) {
          console.warn(`Nenhum calendário encontrado para ${email}`);
          return;
        }
        
        const calendars = calendarsResponse.data.items;
        console.log(`📅 Encontrados ${calendars.length} calendários para ${email}`);

        let totalEventos = 0;
        let totalReunioes = 0;

        for (const cal of calendars) {
          console.log(`📅 Processando calendário: ${cal.summary} (${cal.id})`);
          
          // Buscar eventos modificados recentemente (últimas 24 horas)
          const now = new Date();
          const timeMin = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Últimas 24 horas
          const timeMax = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // Próximos 7 dias

          try {
            const eventsResponse = await calendar.events.list({
              calendarId: cal.id,
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              maxResults: 1000,
              singleEvents: true,
              orderBy: 'startTime'
            });

            if (eventsResponse.data.items && eventsResponse.data.items.length > 0) {
              console.log(`📅 Encontrados ${eventsResponse.data.items.length} eventos no calendário ${cal.summary}`);
              
              for (const evento of eventsResponse.data.items) {
                try {
                  const isReuniao = evento.conferenceData || 
                    (evento.description && evento.description.toLowerCase().includes('meet')) ||
                    (evento.description && evento.description.toLowerCase().includes('zoom'));
                  
                  console.log(`  📋 Processando evento: ${evento.summary || evento.id}`);
                  await calendarServiceJWT.processarEventoCalendarJWT(evento, email, cal.id);
                  
                  if (isReuniao) totalReunioes++; else totalEventos++;
                } catch (error) {
                  console.error(`Erro ao processar evento ${evento.id}:`, error.message);
                }
              }
            } else {
              console.log(`ℹ️ Nenhum evento encontrado no calendário ${cal.summary}`);
            }
          } catch (err) {
            console.error(`Erro ao buscar eventos do calendário ${cal.id}:`, err.message);
          }
        }

        console.log(`✅ Sincronização manual concluída para ${email}: ${totalEventos} eventos, ${totalReunioes} reuniões`);

      } catch (error) {
        console.error(`❌ Erro na sincronização manual para ${email}:`, error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar sincronização manual:', error);
    // Não re-throw pois já respondemos 202
  }
};

module.exports = {
  syncCalendar,
  syncCalendarPorUsuario,
  webhookCalendar,
  configurarWebhookCalendar,
  testarWebhookCalendar,
  forcarSincronizacaoCalendar
}; 