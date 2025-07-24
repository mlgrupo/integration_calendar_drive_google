const pool = require('../config/database');

// Registrar log simples
exports.logEvent = async (logData) => {
  try {
    const {
      tipo, descricao, detalhes, status
    } = logData;

    const result = await pool.query(
      `INSERT INTO google.logs (tipo, descricao, detalhes, status, criado_em)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [tipo, descricao, detalhes, status]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao registrar log:', error);
    throw error;
  }
};

// Registrar evento do Drive
exports.logDriveEvent = async (eventData) => {
  try {
    const {
      usuario_id, tipo_evento, recurso_tipo, recurso_id, detalhes,
      dados_anteriores, dados_novos, ip_origem, user_agent, timestamp_evento
    } = eventData;

    return await this.logEvent({
      tipo: 'DRIVE_EVENT',
      descricao: `${tipo_evento} - ${recurso_tipo} ${recurso_id}`,
      detalhes: JSON.stringify({
        usuario_id,
        tipo_evento,
        recurso_tipo,
        recurso_id,
        detalhes,
        dados_anteriores,
        dados_novos,
        ip_origem,
        user_agent,
        timestamp_evento
      }),
      status: 'SUCCESS'
    });
  } catch (error) {
    console.error('Erro ao registrar evento do Drive:', error);
    throw error;
  }
};

// Registrar evento do Calendar
exports.logCalendarEvent = async (eventData) => {
  try {
    const {
      usuario_id, tipo_evento, recurso_tipo, recurso_id, detalhes,
      dados_anteriores, dados_novos, ip_origem, user_agent, timestamp_evento
    } = eventData;

    return await this.logEvent({
      tipo: 'CALENDAR_EVENT',
      descricao: `${tipo_evento} - ${recurso_tipo} ${recurso_id}`,
      detalhes: JSON.stringify({
        usuario_id,
        tipo_evento,
        recurso_tipo,
        recurso_id,
        detalhes,
        dados_anteriores,
        dados_novos,
        ip_origem,
        user_agent,
        timestamp_evento
      }),
      status: 'SUCCESS'
    });
  } catch (error) {
    console.error('Erro ao registrar evento do Calendar:', error);
    throw error;
  }
};

// Registrar log de auditoria usando a tabela google.logs_auditoria
exports.logAuditoria = async (auditData) => {
  try {
    const {
      usuario_id, acao, recurso_tipo, recurso_id, detalhes,
      ip_origem, user_agent, timestamp_evento
    } = auditData;

    const result = await pool.query(
      `INSERT INTO google.logs_auditoria
        (usuario_id, acao, detalhes, erro, dados_raw, criado_em)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        usuario_id,
        acao,
        detalhes,
        false,
        JSON.stringify({
          recurso_tipo,
          recurso_id,
          ip_origem,
          user_agent,
          timestamp_evento
        })
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
    throw error;
  }
}; 