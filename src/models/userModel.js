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