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

// Inserir ou atualizar evento
exports.upsertEvent = async (eventData) => {
  try {
    const {
      usuario_id, event_id, iCalUID, titulo, descricao, localizacao, data_inicio, data_fim,
      duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
      status, visibilidade, transparencia, convidados, organizador_email,
      organizador_nome, criado_em, modificado_em, dados_completos
    } = eventData;

    const result = await pool.query(
      `INSERT INTO google.calendar_events
        (usuario_id, event_id, iCalUID, titulo, descricao, localizacao, data_inicio, data_fim,
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
         dados_completos = EXCLUDED.dados_completos
       RETURNING *`,
      [
        usuario_id, event_id, iCalUID, titulo, descricao, localizacao, data_inicio, data_fim,
        duracao_minutos, recorrente, recorrencia, calendario_id, calendario_nome,
        status, visibilidade, transparencia, convidados, organizador_email,
        organizador_nome, criado_em, modificado_em, dados_completos
      ]
    );

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