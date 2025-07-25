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

// Inserir ou atualizar evento (upsert por icaluid OU event_id+usuario_id)
exports.upsertEvent = async (eventData) => {
  try {
    const {
      usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
      duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
      status, visibilidade, transparencia, convidados, organizador_email,
      organizador_nome, criado_em, modificado_em, dados_completos
    } = eventData;

    // ESTRATÉGIA: Sempre usar iCalUID como chave principal (é único globalmente)
    let result;
    
    console.log(`[CalendarModel] Processando evento: event_id=${event_id}, icaluid=${icaluid}`);
    
    // Se tem iCalUID, usar ele como chave única (recomendado pelo Google)
    if (icaluid && icaluid.trim() !== '') {
      console.log(`[CalendarModel] 🎯 Usando iCalUID como chave única: ${icaluid}`);
      try {
        result = await pool.query(
          `INSERT INTO google.calendar_events
            (usuario_id, event_id, icaluid, titulo, descricao, localizacao, data_inicio, data_fim,
             duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
             status, visibilidade, transparencia, convidados, organizador_email,
             organizador_nome, criado_em, modificado_em, dados_completos)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           ON CONFLICT (icaluid) DO UPDATE SET
             usuario_id = EXCLUDED.usuario_id,
             event_id = EXCLUDED.event_id,
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
        console.log(`[CalendarModel] ✅ Evento upsert por iCalUID (${icaluid}):`, result.rows[0].event_id, result.rows[0].titulo);
        return result.rows[0];
      } catch (error) {
        console.warn(`[CalendarModel] ⚠️ Erro no upsert por iCalUID:`, error.message);
        // Se der erro no iCalUID, tentar por event_id
      }
    }
    
    // Fallback: usar event_id + usuario_id (para eventos sem iCalUID)
    console.log(`[CalendarModel] 🔄 Fallback: usando event_id+usuario_id: ${event_id} + ${usuario_id}`);
    result = await pool.query(
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
    console.log(`[CalendarModel] ✅ Evento upsert por event_id+usuario_id (${event_id}):`, result.rows[0].event_id, result.rows[0].titulo);
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao inserir/atualizar evento:', error);
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