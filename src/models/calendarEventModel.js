const pool = require('../config/database');

// Buscar evento por ID
exports.getEventById = async (eventId, usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.calendar_events WHERE event_id = $1 AND usuario_id = $2', 
      [eventId, usuarioId]
    );
    return rows[0];
  } catch (error) {
    console.error('Erro ao buscar evento por ID:', error);
    throw error;
  }
};

// Inserir ou atualizar evento (upsert por event_id+usuario_id)
exports.upsertEvent = async (eventData) => {
  try {
    const {
      usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
      duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
      status, visibilidade, transparencia, convidados, organizador_email,
      organizador_nome, criado_em, modificado_em, dados_completos
    } = eventData;

    console.log(`[CalendarModel] Processando evento: event_id=${event_id}, icaluid=${icaluid}`);
    
    // ESTRATÉGIA SIMPLIFICADA: Sempre usar event_id + usuario_id como chave única
    const result = await pool.query(
      `INSERT INTO google.calendar_events
        (usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
         duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
         status, visibilidade, transparencia, convidados, organizador_email,
         organizador_nome, criado_em, modificado_em, dados_completos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       ON CONFLICT (event_id, usuario_id) DO UPDATE SET
         icaluid = EXCLUDED.icaluid,
         titulo = EXCLUDED.titulo,
         descricao = EXCLUDED.descricao,
         localizacao = EXCLUDED.localizacao,
         data_inicio = EXCLUDED.data_inicio,
         data_fim = EXCLUDED.data_fim,
         duracao_minutos = EXCLUDED.duracao_minutos,
         recorrente = EXCLUDED.recorrente,
         recorrencia = EXCLUDED.recorrencia,
         calendario_id = EXCLUDED.calendario_id,
         calendario_nome = EXCLUDED.calendario_nome,
         status = EXCLUDED.status,
         visibilidade = EXCLUDED.visibilidade,
         transparencia = EXCLUDED.transparencia,
         convidados = EXCLUDED.convidados,
         organizador_email = EXCLUDED.organizador_email,
         organizador_nome = EXCLUDED.organizador_nome,
         criado_em = EXCLUDED.criado_em,
         modificado_em = EXCLUDED.modificado_em,
         dados_completos = EXCLUDED.dados_completos,
         updated_at = NOW()
       RETURNING *`,
      [
        usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
        duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
        status, visibilidade, transparencia, convidados, organizador_email,
        organizador_nome, criado_em, modificado_em, dados_completos
      ]
    );

    console.log(`[CalendarModel] ✅ Evento upsert: ${result.rows[0].event_id} - ${result.rows[0].titulo}`);
    return result.rows[0];
  } catch (error) {
    console.error('[CalendarModel] ❌ Erro no upsertEvent:', error);
    console.error('[CalendarModel] 🔍 Detalhes do erro:', {
      code: error.code,
      constraint: error.constraint,
      detail: error.detail,
      table: error.table,
      schema: error.schema
    });
    
    // Se for erro de índice único em icaluid, tentar resolver
    if (error.code === '23505' && error.constraint && (
        error.constraint.includes('icaluid') || 
        error.constraint === 'idx_calendar_events_icaluid' ||
        error.constraint === 'idx_calendar_events_unique_icaluid'
    )) {
      console.log(`[CalendarModel] 🔧 Tentando resolver conflito de índice único em icaluid: ${icaluid}`);
      try {
        // Verificar se já existe um evento com este icaluid para este usuário
        const existingEvent = await pool.query(
          'SELECT id, event_id, usuario_id FROM google.calendar_events WHERE icaluid = $1 AND usuario_id = $2',
          [icaluid, usuario_id]
        );
        
        if (existingEvent.rows.length > 0) {
          // Atualizar o evento existente
          const updateResult = await pool.query(
            `UPDATE google.calendar_events SET
               titulo = $1, descricao = $2, localizacao = $3, data_inicio = $4, data_fim = $5,
               duracao_minutos = $6, recorrente = $7, recorrencia = $8, calendario_id = $9,
               calendario_nome = $10, status = $11, visibilidade = $12, transparencia = $13,
               convidados = $14, organizador_email = $15, organizador_nome = $16,
               criado_em = $17, modificado_em = $18, dados_completos = $19, updated_at = NOW()
             WHERE id = $20
             RETURNING *`,
            [
              titulo, descricao, localizacao, data_inicio, data_fim, duracao_minutos,
              recorrente, recorrencia, calendario_id, calendario_nome, status,
              visibilidade, transparencia, convidados, organizador_email,
              organizador_nome, criado_em, modificado_em, dados_completos,
              existingEvent.rows[0].id
            ]
          );
          console.log(`[CalendarModel] ✅ Evento atualizado via UPDATE: ${updateResult.rows[0].event_id}`);
          return updateResult.rows[0];
        } else {
          // Se não existe para este usuário, tentar inserir sem icaluid
          console.log(`[CalendarModel] 🔄 Tentando inserir sem icaluid para evitar conflito`);
          const fallbackResult = await pool.query(
            `INSERT INTO google.calendar_events
               (usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
                duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
                status, visibilidade, transparencia, convidados, organizador_email,
                organizador_nome, criado_em, modificado_em, dados_completos)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
             ON CONFLICT (event_id, usuario_id) DO UPDATE SET
               titulo = EXCLUDED.titulo,
               descricao = EXCLUDED.descricao,
               localizacao = EXCLUDED.localizacao,
               data_inicio = EXCLUDED.data_inicio,
               data_fim = EXCLUDED.data_fim,
               duracao_minutos = EXCLUDED.duracao_minutos,
               recorrente = EXCLUDED.recorrente,
               recorrencia = EXCLUDED.recorrencia,
               calendario_id = EXCLUDED.calendario_id,
               calendario_nome = EXCLUDED.calendario_nome,
               status = EXCLUDED.status,
               visibilidade = EXCLUDED.visibilidade,
               transparencia = EXCLUDED.transparencia,
               convidados = EXCLUDED.convidados,
               organizador_email = EXCLUDED.organizador_email,
               organizador_nome = EXCLUDED.organizador_nome,
               criado_em = EXCLUDED.criado_em,
               modificado_em = EXCLUDED.modificado_em,
               dados_completos = EXCLUDED.dados_completos,
               updated_at = NOW()
             RETURNING *`,
            [
              usuario_id, event_id, null, titulo, descricao, localizacao, data_inicio, data_fim,
              duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
              status, visibilidade, transparencia, convidados, organizador_email,
              organizador_nome, criado_em, modificado_em, dados_completos
            ]
          );
          console.log(`[CalendarModel] ✅ Evento inserido sem icaluid: ${fallbackResult.rows[0].event_id}`);
          return fallbackResult.rows[0];
        }
      } catch (fallbackError) {
        console.error('[CalendarModel] ❌ Erro no fallback:', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
};

// Listar eventos por usuário
exports.getEventsByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.calendar_events WHERE usuario_id = $1 ORDER BY data_inicio DESC',
      [usuarioId]
    );
    return rows;
  } catch (error) {
    console.error('Erro ao buscar eventos do usuário:', error);
    throw error;
  }
};

// Contar eventos por usuário
exports.countEventsByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as total FROM google.calendar_events WHERE usuario_id = $1',
      [usuarioId]
    );
    return parseInt(rows[0].total);
  } catch (error) {
    console.error('Erro ao contar eventos do usuário:', error);
    throw error;
  }
}; 