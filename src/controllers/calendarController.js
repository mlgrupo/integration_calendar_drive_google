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

// Limpar duplicatas do Calendar
const limparDuplicatasCalendar = async (req, res) => {
  try {
    console.log('🧹 Iniciando limpeza de duplicatas do Calendar...');
    
    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Limpeza de duplicatas iniciada em background',
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const pool = require('../config/database');
        
        // 1. Verificar se a coluna icaluid existe
        const { rows: columns } = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'google' 
          AND table_name = 'calendar_events' 
          AND column_name = 'icaluid'
        `);
        
        if (columns.length === 0) {
          console.log('📝 Adicionando coluna icaluid...');
          await pool.query('ALTER TABLE google.calendar_events ADD COLUMN icaluid VARCHAR(255)');
        }
        
        // 2. Contar duplicatas antes
        const { rows: duplicatasAntes } = await pool.query(`
          SELECT COUNT(*) as total
          FROM (
            SELECT event_id, usuario_id, COUNT(*) as cnt
            FROM google.calendar_events
            GROUP BY event_id, usuario_id
            HAVING COUNT(*) > 1
          ) duplicatas
        `);
        
        console.log(`📊 Duplicatas encontradas: ${duplicatasAntes[0].total}`);
        
        // 3. Remover duplicatas (manter apenas a mais recente)
        const { rowCount: removidas } = await pool.query(`
          DELETE FROM google.calendar_events 
          WHERE id NOT IN (
            SELECT MAX(id) 
            FROM google.calendar_events 
            GROUP BY event_id, usuario_id
          )
        `);
        
        console.log(`🗑️ Registros removidos: ${removidas}`);
        
        // 4. Criar constraints únicos se não existirem
        try {
          await pool.query(`
            ALTER TABLE google.calendar_events 
            ADD CONSTRAINT calendar_events_icaluid_unique 
            UNIQUE (icaluid)
          `);
          console.log('✅ Constraint único para icaluid criado');
        } catch (error) {
          if (error.code === '23505') {
            console.log('ℹ️ Constraint único para icaluid já existe');
          } else {
            console.warn('⚠️ Erro ao criar constraint icaluid:', error.message);
          }
        }
        
        try {
          await pool.query(`
            ALTER TABLE google.calendar_events 
            ADD CONSTRAINT calendar_events_event_id_usuario_id_unique 
            UNIQUE (event_id, usuario_id)
          `);
          console.log('✅ Constraint único para (event_id, usuario_id) criado');
        } catch (error) {
          if (error.code === '23505') {
            console.log('ℹ️ Constraint único para (event_id, usuario_id) já existe');
          } else {
            console.warn('⚠️ Erro ao criar constraint event_id+usuario_id:', error.message);
          }
        }
        
        // 5. Criar índices para performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid ON google.calendar_events(icaluid)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON google.calendar_events(event_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_id ON google.calendar_events(usuario_id)');
        console.log('✅ Índices criados');
        
        // 6. Estatísticas finais
        const { rows: stats } = await pool.query(`
          SELECT 
            'Total de eventos' as info,
            COUNT(*) as total
          FROM google.calendar_events
          UNION ALL
          SELECT 
            'Eventos com icaluid' as info,
            COUNT(*) as total
          FROM google.calendar_events 
          WHERE icaluid IS NOT NULL
          UNION ALL
          SELECT 
            'Eventos sem icaluid' as info,
            COUNT(*) as total
          FROM google.calendar_events 
          WHERE icaluid IS NULL
        `);
        
        console.log('📊 Estatísticas finais:');
        stats.forEach(stat => {
          console.log(`  - ${stat.info}: ${stat.total}`);
        });
        
        console.log('🎉 Limpeza de duplicatas concluída!');
        
      } catch (error) {
        console.error('❌ Erro na limpeza de duplicatas:', error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar limpeza de duplicatas:', error);
    // Não re-throw pois já respondemos 202
  }
};

// Verificar estrutura da tabela Calendar
const verificarEstruturaCalendar = async (req, res) => {
  try {
    const pool = require('../config/database');
    
    // Verificar colunas
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'google' 
      AND table_name = 'calendar_events'
      ORDER BY ordinal_position
    `);
    
    // Verificar constraints
    const { rows: constraints } = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint 
      WHERE conrelid = 'google.calendar_events'::regclass
    `);
    
    // Verificar índices
    const { rows: indexes } = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'calendar_events' 
      AND schemaname = 'google'
    `);
    
    // Estatísticas
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total_eventos,
        COUNT(CASE WHEN icaluid IS NOT NULL THEN 1 END) as com_icaluid,
        COUNT(CASE WHEN icaluid IS NULL THEN 1 END) as sem_icaluid
      FROM google.calendar_events
    `);
    
    res.json({
      sucesso: true,
      estrutura: {
        colunas: columns,
        constraints: constraints,
        indices: indexes
      },
      estatisticas: stats[0]
    });
    
  } catch (error) {
    console.error('Erro ao verificar estrutura:', error);
    res.status(500).json({ 
      erro: 'Falha ao verificar estrutura da tabela', 
      detalhes: error.message 
    });
  }
};

// Testar processamento de evento específico
const testarEventoEspecifico = async (req, res) => {
  try {
    const { email, eventData } = req.body;
    
    if (!email || !eventData) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email e eventData são obrigatórios'
      });
    }

    console.log(`🧪 Testando processamento de evento específico para: ${email}`);
    console.log('📋 Dados do evento:', JSON.stringify(eventData, null, 2));

    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Teste de evento específico iniciado em background',
      usuario: email,
      event_id: eventData.id,
      icaluid: eventData.iCalUID,
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const calendarServiceJWT = require('../services/calendarServiceJWT');
        
        // Processar o evento específico
        const resultado = await calendarServiceJWT.processarEventoCalendarJWT(
          eventData, 
          email, 
          'primary'
        );
        
        console.log('✅ Teste concluído:', resultado);
        
      } catch (error) {
        console.error('❌ Erro no teste:', error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar teste:', error);
    // Não re-throw pois já respondemos 202
  }
};

module.exports = {
  syncCalendar,
  syncCalendarPorUsuario,
  webhookCalendar,
  configurarWebhookCalendar,
  testarWebhookCalendar,
  forcarSincronizacaoCalendar,
  limparDuplicatasCalendar,
  verificarEstruturaCalendar,
  testarEventoEspecifico
}; 