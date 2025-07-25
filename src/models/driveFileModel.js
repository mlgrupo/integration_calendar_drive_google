const pool = require('../config/database');

// Buscar arquivo por ID
exports.getFileById = async (fileId, usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.drive_files WHERE file_id = $1 AND usuario_id = $2', 
      [fileId, usuarioId]
    );
    return rows[0];
  } catch (error) {
    console.error('Erro ao buscar arquivo por ID:', error);
    throw error;
  }
};

// Inserir ou atualizar arquivo
exports.upsertFile = async (fileData) => {
  try {
    const {
      usuario_id, file_id, nome, mime_type, tamanho, folder_id, 
      caminho_completo, dono_email, compartilhado, visibilidade, 
      permissoes, criado_em, modificado_em, versao, md5_checksum, 
      web_view_link, download_link, thumbnail_link, starred, 
      trashed, tipo_arquivo, extensao, dados_completos
    } = fileData;

    const result = await pool.query(
      `INSERT INTO google.drive_files
        (usuario_id, file_id, nome, mime_type, tamanho, folder_id, caminho_completo, 
         dono_email, compartilhado, visibilidade, permissoes, criado_em, modificado_em, 
         versao, md5_checksum, web_view_link, download_link, thumbnail_link, starred, 
         trashed, tipo_arquivo, extensao, dados_completos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       ON CONFLICT (file_id, usuario_id) DO UPDATE SET
         nome = EXCLUDED.nome,
         mime_type = EXCLUDED.mime_type,
         tamanho = EXCLUDED.tamanho,
         folder_id = EXCLUDED.folder_id,
         caminho_completo = EXCLUDED.caminho_completo,
         dono_email = EXCLUDED.dono_email,
         compartilhado = EXCLUDED.compartilhado,
         visibilidade = EXCLUDED.visibilidade,
         permissoes = EXCLUDED.permissoes,
         criado_em = EXCLUDED.criado_em,
         modificado_em = EXCLUDED.modificado_em,
         versao = EXCLUDED.versao,
         md5_checksum = EXCLUDED.md5_checksum,
         web_view_link = EXCLUDED.web_view_link,
         download_link = EXCLUDED.download_link,
         thumbnail_link = EXCLUDED.thumbnail_link,
         starred = EXCLUDED.starred,
         trashed = EXCLUDED.trashed,
         tipo_arquivo = EXCLUDED.tipo_arquivo,
         extensao = EXCLUDED.extensao,
         dados_completos = EXCLUDED.dados_completos
       RETURNING *`,
      [
        usuario_id, file_id, nome, mime_type, tamanho, folder_id, caminho_completo,
        dono_email, compartilhado, visibilidade, permissoes, criado_em, modificado_em,
        versao, md5_checksum, web_view_link, download_link, thumbnail_link, starred,
        trashed, tipo_arquivo, extensao, dados_completos
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao inserir/atualizar arquivo:', error);
    throw error;
  }
};

// Listar arquivos por usuário
exports.getFilesByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM google.drive_files WHERE usuario_id = $1 ORDER BY modificado_em DESC',
      [usuarioId]
    );
    return rows;
  } catch (error) {
    console.error('Erro ao buscar arquivos do usuário:', error);
    throw error;
  }
};

// Contar arquivos por usuário
exports.countFilesByUser = async (usuarioId) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as total FROM google.drive_files WHERE usuario_id = $1',
      [usuarioId]
    );
    return parseInt(rows[0].total);
  } catch (error) {
    console.error('Erro ao contar arquivos do usuário:', error);
    throw error;
  }
}; 

// Marcar arquivo como deletado
exports.marcarComoDeletado = async (fileId, usuarioId) => {
  try {
    const result = await pool.query(
      `UPDATE google.drive_files 
       SET trashed = true, 
           modificado_em = NOW() 
       WHERE file_id = $1 AND usuario_id = $2
       RETURNING *`,
      [fileId, usuarioId]
    );
    
    if (result.rows.length > 0) {
      console.log(`Arquivo marcado como deletado: ${fileId}`);
      return result.rows[0];
    } else {
      console.warn(`Arquivo não encontrado para marcar como deletado: ${fileId}`);
      return null;
    }
  } catch (error) {
    console.error('Erro ao marcar arquivo como deletado:', error);
    throw error;
  }
}; 