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

// Verificar status dos webhooks do Calendar
const verificarWebhooksCalendar = async (req, res) => {
  try {
    console.log('🔍 Verificando status dos webhooks do Calendar...');
    
    const pool = require('../config/database');
    const userModel = require('../models/userModel');
    
    // 1. Verificar usuários cadastrados
    const usuarios = await userModel.getAllUsers();
    console.log(`📋 Total de usuários: ${usuarios.length}`);
    
        // 2. Verificar estrutura da tabela calendar_channels primeiro
    let canais = [];
    try {
      const { rows: estrutura } = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_channels'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Estrutura da tabela calendar_channels:', estrutura);
      
      // Verificar se a tabela existe e tem dados
      const { rows: canaisData } = await pool.query(`
        SELECT * FROM google.calendar_channels LIMIT 5
      `);
      
      canais = canaisData;
      console.log(`📡 Canais de webhook encontrados: ${canais.length}`);
      
    } catch (error) {
      console.warn('⚠️ Tabela calendar_channels não existe ou tem estrutura diferente:', error.message);
      canais = [];
    }
    
    // 3. Verificar webhooks ativos via API do Google
    const resultados = [];
    
    for (const usuario of usuarios) {
      try {
        console.log(`🔍 Verificando webhook para: ${usuario.email}`);
        
        const { getCalendarClient } = require('../config/googleJWT');
        const calendar = await getCalendarClient(usuario.email);
        
        // Verificar se há webhooks ativos
        const webhooks = await calendar.events.watch({
          calendarId: 'primary',
          requestBody: {
            id: 'test-check',
            type: 'web_hook',
            address: 'https://test.com/webhook',
            expiration: Date.now() + (60 * 1000) // 1 minuto
          }
        });
        
        resultados.push({
          email: usuario.email,
          status: 'ativo',
          resourceId: webhooks.data.resourceId,
          expiration: new Date(webhooks.data.expiration).toISOString()
        });
        
        console.log(`✅ Webhook ativo para ${usuario.email}`);
        
      } catch (error) {
        console.error(`❌ Erro ao verificar webhook para ${usuario.email}:`, error.message);
        resultados.push({
          email: usuario.email,
          status: 'erro',
          erro: error.message
        });
      }
    }
    
    // 4. Verificar logs de webhook recentes
    let logs = [];
    try {
      const { rows: logsData } = await pool.query(`
        SELECT 
          l.*,
          u.email as usuario_email
        FROM google.logs l
        LEFT JOIN google.usuarios u ON l.usuario_id = u.id
        WHERE l.tipo_evento LIKE '%webhook%' 
        OR l.tipo_evento LIKE '%calendar%'
        ORDER BY l.timestamp_evento DESC
        LIMIT 10
      `);
      logs = logsData;
    } catch (error) {
      console.warn('⚠️ Erro ao buscar logs:', error.message);
      logs = [];
    }
    
    res.json({
      sucesso: true,
      estatisticas: {
        total_usuarios: usuarios.length,
        canais_webhook: canais.length,
        webhooks_ativos: resultados.filter(r => r.status === 'ativo').length,
        webhooks_com_erro: resultados.filter(r => r.status === 'erro').length
      },
      usuarios: usuarios.map(u => ({ id: u.id, email: u.email })),
      canais_webhook: canais,
      webhooks_status: resultados,
      logs_recentes: logs
    });
    
  } catch (error) {
    console.error('Erro ao verificar webhooks:', error);
    res.status(500).json({ 
      erro: 'Falha ao verificar webhooks', 
      detalhes: error.message 
    });
  }
};

// Forçar configuração de webhooks para todos os usuários
const forcarConfiguracaoWebhooks = async (req, res) => {
  try {
    console.log('🔄 Forçando configuração de webhooks do Calendar...');
    
    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Configuração de webhooks iniciada em background',
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const userModel = require('../models/userModel');
        const calendarServiceJWT = require('../services/calendarServiceJWT');
        const pool = require('../config/database');
        
        const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com';
        const usuarios = await userModel.getAllUsers();
        
        console.log(`📋 Configurando webhooks para ${usuarios.length} usuários...`);
        
        let sucessos = 0;
        let erros = 0;
        
        for (const usuario of usuarios) {
          try {
            console.log(`🔄 Configurando webhook para: ${usuario.email}`);
            
            // Configurar webhook do Calendar
            const resultado = await calendarServiceJWT.registrarWebhookCalendarJWT(
              usuario.email, 
              `${webhookUrl}/api/calendar/webhook`
            );
            
            // Salvar no banco
            if (resultado.resourceId) {
              await userModel.saveCalendarChannel(
                usuario.email, 
                resultado.resourceId, 
                resultado.id, 
                'primary'
              );
              
              console.log(`✅ Webhook configurado para ${usuario.email}:`, resultado.resourceId);
              sucessos++;
            }
            
            // Pequena pausa para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (error) {
            console.error(`❌ Erro ao configurar webhook para ${usuario.email}:`, error.message);
            erros++;
          }
        }
        
        console.log(`🎉 Configuração concluída: ${sucessos} sucessos, ${erros} erros`);
        
      } catch (error) {
        console.error('❌ Erro geral na configuração:', error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar configuração:', error);
    // Não re-throw pois já respondemos 202
  }
};

// Corrigir horários dos eventos existentes para fuso de São Paulo
const corrigirHorariosEventos = async (req, res) => {
  try {
    console.log('🕐 Iniciando correção de horários dos eventos...');
    
    // Responder imediatamente
    res.status(202).json({
      sucesso: true,
      mensagem: 'Correção de horários iniciada em background',
      timestamp: new Date().toISOString()
    });

    // Executar em background
    setImmediate(async () => {
      try {
        const pool = require('../config/database');
        const { converterParaSP } = require('../utils/formatDate');
        
        // Buscar todos os eventos
        const { rows: eventos } = await pool.query(`
          SELECT id, event_id, data_inicio, data_fim, titulo
          FROM google.calendar_events
          WHERE data_inicio IS NOT NULL
          ORDER BY data_inicio DESC
        `);
        
        console.log(`📅 Encontrados ${eventos.length} eventos para corrigir`);
        
        let corrigidos = 0;
        let erros = 0;
        
        for (const evento of eventos) {
          try {
            // Converter horários para SP
            const dataInicioSP = converterParaSP(evento.data_inicio.toISOString());
            const dataFimSP = converterParaSP(evento.data_fim.toISOString());
            
            // Atualizar no banco
            await pool.query(`
              UPDATE google.calendar_events 
              SET 
                data_inicio = $1,
                data_fim = $2,
                updated_at = NOW()
              WHERE id = $3
            `, [dataInicioSP, dataFimSP, evento.id]);
            
            console.log(`✅ Evento corrigido: ${evento.titulo} (${evento.event_id})`);
            console.log(`   Antes: ${evento.data_inicio} → ${evento.data_fim}`);
            console.log(`   Depois: ${dataInicioSP} → ${dataFimSP}`);
            
            corrigidos++;
            
          } catch (error) {
            console.error(`❌ Erro ao corrigir evento ${evento.id}:`, error.message);
            erros++;
          }
        }
        
        console.log(`🎉 Correção concluída: ${corrigidos} corrigidos, ${erros} erros`);
        
      } catch (error) {
        console.error('❌ Erro geral na correção:', error.message);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar correção:', error);
    // Não re-throw pois já respondemos 202
  }
};

// Criar tabelas de webhook se não existirem
const criarTabelasWebhook = async (req, res) => {
  try {
    console.log('🔧 Verificando e criando tabelas de webhook...');
    
    const pool = require('../config/database');
    
    // 1. Verificar se a tabela calendar_channels existe
    const { rows: calendarExists } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_channels'
      ) as exists
    `);
    
    if (!calendarExists[0].exists) {
      console.log('📝 Criando tabela calendar_channels...');
      await pool.query(`
        CREATE TABLE google.calendar_channels (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          channel_id VARCHAR(255) NOT NULL,
          calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          active BOOLEAN DEFAULT true
        )
      `);
      
      // Criar índices
      await pool.query('CREATE INDEX idx_calendar_channels_usuario_id ON google.calendar_channels(usuario_id)');
      await pool.query('CREATE INDEX idx_calendar_channels_resource_id ON google.calendar_channels(resource_id)');
      await pool.query('CREATE INDEX idx_calendar_channels_channel_id ON google.calendar_channels(channel_id)');
      await pool.query('CREATE INDEX idx_calendar_channels_active ON google.calendar_channels(active)');
      
      // Criar constraint único
      await pool.query(`
        ALTER TABLE google.calendar_channels 
        ADD CONSTRAINT calendar_channels_usuario_calendar_unique 
        UNIQUE (usuario_id, calendar_id)
      `);
      
      console.log('✅ Tabela calendar_channels criada!');
    } else {
      console.log('ℹ️ Tabela calendar_channels já existe');
    }
    
    // 2. Verificar se a tabela drive_channels existe
    const { rows: driveExists } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'google' 
        AND table_name = 'drive_channels'
      ) as exists
    `);
    
    if (!driveExists[0].exists) {
      console.log('📝 Criando tabela drive_channels...');
      await pool.query(`
        CREATE TABLE google.drive_channels (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          channel_id VARCHAR(255) NOT NULL,
          page_token VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          active BOOLEAN DEFAULT true
        )
      `);
      
      // Criar índices
      await pool.query('CREATE INDEX idx_drive_channels_usuario_id ON google.drive_channels(usuario_id)');
      await pool.query('CREATE INDEX idx_drive_channels_resource_id ON google.drive_channels(resource_id)');
      await pool.query('CREATE INDEX idx_drive_channels_channel_id ON google.drive_channels(channel_id)');
      await pool.query('CREATE INDEX idx_drive_channels_active ON google.drive_channels(active)');
      
      // Criar constraint único
      await pool.query(`
        ALTER TABLE google.drive_channels 
        ADD CONSTRAINT drive_channels_usuario_unique 
        UNIQUE (usuario_id)
      `);
      
      console.log('✅ Tabela drive_channels criada!');
    } else {
      console.log('ℹ️ Tabela drive_channels já existe');
    }
    
    // 3. Mostrar estrutura das tabelas
    const { rows: calendarStructure } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'google' 
      AND table_name = 'calendar_channels'
      ORDER BY ordinal_position
    `);
    
    const { rows: driveStructure } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'google' 
      AND table_name = 'drive_channels'
      ORDER BY ordinal_position
    `);
    
    res.json({
      sucesso: true,
      mensagem: 'Tabelas de webhook verificadas/criadas com sucesso',
      tabelas: {
        calendar_channels: {
          existe: calendarExists[0].exists,
          estrutura: calendarStructure
        },
        drive_channels: {
          existe: driveExists[0].exists,
          estrutura: driveStructure
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    res.status(500).json({ 
      erro: 'Falha ao criar tabelas de webhook', 
      detalhes: error.message 
    });
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
  testarEventoEspecifico,
  verificarWebhooksCalendar,
  forcarConfiguracaoWebhooks,
  corrigirHorariosEventos,
  criarTabelasWebhook
}; 