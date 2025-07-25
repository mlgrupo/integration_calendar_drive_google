const pool = require('../config/database');

// Buscar ou criar usuário
exports.getOrCreateUsuario = async (email, nome = null) => {
  try {
    // Primeiro, tentar buscar o usuário existente
    let result = await pool.query(
      'SELECT * FROM google.usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Se não existir, criar novo usuário
    result = await pool.query(
      'INSERT INTO google.usuarios (email, nome, ativo, criado_em) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, nome, true, new Date()]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao buscar/criar usuário:', error);
    throw error;
  }
};

// Listar todos os usuários
exports.getAllUsers = async () => {
  try {
    const { rows } = await pool.query('SELECT * FROM google.usuarios ORDER BY nome, email');
    return rows;
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    throw error;
  }
};

// Buscar usuário por ID
exports.getUserById = async (id) => {
  try {
    const { rows } = await pool.query('SELECT * FROM google.usuarios WHERE id = $1', [id]);
    return rows[0];
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error);
    throw error;
  }
};

// Buscar usuário por email
exports.getUserByEmail = async (email) => {
  try {
    const { rows } = await pool.query('SELECT * FROM google.usuarios WHERE email = $1', [email]);
    return rows[0];
  } catch (error) {
    console.error('Erro ao buscar usuário por email:', error);
    throw error;
  }
};

// Buscar usuário pelo resourceId do canal do Drive
exports.getUserByResourceId = async (resourceId) => {
  try {
    const { rows } = await pool.query(
      'SELECT email FROM google.drive_channels WHERE resource_id = $1 ORDER BY atualizado_em DESC LIMIT 1',
      [resourceId]
    );
    return rows[0]?.email || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por resourceId:', error);
    throw error;
  }
};

// Buscar pageToken salvo para o usuário
exports.getDrivePageToken = async (email) => {
  try {
    const { rows } = await pool.query(
      'SELECT page_token FROM google.drive_channels WHERE email = $1 ORDER BY atualizado_em DESC LIMIT 1',
      [email]
    );
    return rows[0]?.page_token || null;
  } catch (error) {
    console.error('Erro ao buscar pageToken:', error);
    throw error;
  }
};

// Salvar/atualizar pageToken para o usuário
exports.saveDrivePageToken = async (email, resourceId, channelId, pageToken) => {
  try {
    await pool.query(
      `INSERT INTO google.drive_channels (email, resource_id, channel_id, page_token, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (resource_id) DO UPDATE SET
         email = EXCLUDED.email,
         channel_id = EXCLUDED.channel_id,
         page_token = EXCLUDED.page_token,
         atualizado_em = NOW()`,
      [email, resourceId, channelId, pageToken]
    );
  } catch (error) {
    console.error('Erro ao salvar pageToken:', error);
    throw error;
  }
};

// Buscar usuário pelo resourceId do canal do Calendar
exports.getUserByCalendarResourceId = async (resourceId) => {
  try {
    const { rows } = await pool.query(
      'SELECT email FROM google.calendar_channels WHERE resource_id = $1 ORDER BY atualizado_em DESC LIMIT 1',
      [resourceId]
    );
    return rows[0]?.email || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por resourceId do Calendar:', error);
    throw error;
  }
};

// Salvar/atualizar canal do Calendar
exports.saveCalendarChannel = async (email, resourceId, channelId, calendarId) => {
  try {
    await pool.query(
      `INSERT INTO google.calendar_channels (email, resource_id, channel_id, calendar_id, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (resource_id) DO UPDATE SET
         email = EXCLUDED.email,
         channel_id = EXCLUDED.channel_id,
         calendar_id = EXCLUDED.calendar_id,
         atualizado_em = NOW()`,
      [email, resourceId, channelId, calendarId]
    );
  } catch (error) {
    console.error('Erro ao salvar canal do Calendar:', error);
    throw error;
  }
}; 