const pool = require('../config/database');

// Buscar pasta por ID
exports.getFolderById = async (folderId, usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.drive_folders WHERE folder_id = $1 AND usuario_id = $2', 
      [folderId, usuarioId]
    );
    return rows[0];
  } catch (error) {
    console.error('Erro ao buscar pasta por ID:', error);
    throw error;
  }
};

// Inserir ou atualizar pasta
exports.upsertFolder = async (folderData) => {
  try {
    const {
      usuario_id, folder_id, nome, caminho_completo, parent_folder_id,
      cor_rgb, compartilhado, visibilidade, permissoes, criado_em,
      modificado_em, ultimo_acesso, tamanho_total, quantidade_arquivos,
      quantidade_subpastas, dados_completos
    } = folderData;

    const result = await pool.query(
      `INSERT INTO google.drive_folders
        (usuario_id, folder_id, nome, caminho_completo, parent_folder_id,
         cor_rgb, compartilhado, visibilidade, permissoes, criado_em,
         modificado_em, ultimo_acesso, tamanho_total, quantidade_arquivos,
         quantidade_subpastas, dados_completos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (folder_id, usuario_id) DO UPDATE SET
         nome = EXCLUDED.nome,
         caminho_completo = EXCLUDED.caminho_completo,
         parent_folder_id = EXCLUDED.parent_folder_id,
         cor_rgb = EXCLUDED.cor_rgb,
         compartilhado = EXCLUDED.compartilhado,
         visibilidade = EXCLUDED.visibilidade,
         permissoes = EXCLUDED.permissoes,
         criado_em = EXCLUDED.criado_em,
         modificado_em = EXCLUDED.modificado_em,
         ultimo_acesso = EXCLUDED.ultimo_acesso,
         tamanho_total = EXCLUDED.tamanho_total,
         quantidade_arquivos = EXCLUDED.quantidade_arquivos,
         quantidade_subpastas = EXCLUDED.quantidade_subpastas,
         dados_completos = EXCLUDED.dados_completos
       RETURNING *`,
      [
        usuario_id, folder_id, nome, caminho_completo, parent_folder_id,
        cor_rgb, compartilhado, visibilidade, permissoes, criado_em,
        modificado_em, ultimo_acesso, tamanho_total, quantidade_arquivos,
        quantidade_subpastas, dados_completos
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao inserir/atualizar pasta:', error);
    throw error;
  }
};

// Listar pastas por usuário
exports.getFoldersByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.drive_folders WHERE usuario_id = $1 ORDER BY modificado_em DESC',
      [usuarioId]
    );
    return rows;
  } catch (error) {
    console.error('Erro ao buscar pastas do usuário:', error);
    throw error;
  }
};

// Contar pastas por usuário
exports.countFoldersByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as total FROM google.drive_folders WHERE usuario_id = $1',
      [usuarioId]
    );
    return parseInt(rows[0].total);
  } catch (error) {
    console.error('Erro ao contar pastas do usuário:', error);
    throw error;
  }
}; 