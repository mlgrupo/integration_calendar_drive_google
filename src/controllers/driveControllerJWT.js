const driveServiceJWT = require('../services/driveServiceJWT');
const logModel = require('../models/logModel');

// Sincronizar arquivos e pastas do Drive usando JWT
exports.syncDriveJWT = async (req, res) => {
  try {
    console.log('Iniciando sincronização do Drive com JWT...');
    
    const resultado = await driveServiceJWT.syncDriveFilesJWT();
    
    // Registrar log de auditoria
    await logModel.logAuditoria({
      usuario_id: null,
      acao: 'sync_drive_jwt',
      recurso_tipo: 'drive',
      recurso_id: 'all_users',
      detalhes: `Sincronização do Drive com JWT executada: ${resultado.totalArquivos} arquivos, ${resultado.totalPastas} pastas`,
      ip_origem: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp_evento: new Date()
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Sincronização do Drive com JWT executada com sucesso!',
      resultado 
    });
  } catch (error) {
    console.error('Erro ao sincronizar Drive com JWT:', error);
    res.status(500).json({ 
      erro: 'Falha ao sincronizar arquivos/pastas do Drive com JWT', 
      detalhes: error.message 
    });
  }
};

// Listar arquivos de um usuário específico usando JWT
exports.listarArquivosUsuarioJWT = async (req, res) => {
  try {
    const { email } = req.params;
    const { limit, query } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Listando arquivos de ${email} com JWT...`);

    const arquivos = await driveServiceJWT.listarArquivosUsuarioJWT(email, {
      limit: limit ? parseInt(limit) : 100,
      query: query || 'trashed=false'
    });

    res.json({ 
      sucesso: true, 
      mensagem: `Arquivos de ${email} listados com sucesso!`,
      email,
      total: arquivos.length,
      arquivos 
    });
  } catch (error) {
    console.error('Erro ao listar arquivos com JWT:', error);
    res.status(500).json({ 
      erro: 'Falha ao listar arquivos com JWT', 
      detalhes: error.message 
    });
  }
};

// Testar sincronização JWT para um usuário específico
exports.testarSincronizacaoJWT = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        erro: 'Email é obrigatório' 
      });
    }

    console.log(`Testando sincronização JWT para: ${email}`);

    // Listar arquivos do usuário
    const arquivos = await driveServiceJWT.listarArquivosUsuarioJWT(email, { limit: 10 });

    // Contar por tipo
    const tiposArquivos = {};
    let totalTamanho = 0;
    let pastas = 0;
    let arquivosCount = 0;

    arquivos.forEach(arquivo => {
      const tipo = arquivo.mimeType || 'desconhecido';
      tiposArquivos[tipo] = (tiposArquivos[tipo] || 0) + 1;
      
      if (arquivo.size) {
        totalTamanho += parseInt(arquivo.size);
      }

      if (arquivo.mimeType === 'application/vnd.google-apps.folder') {
        pastas++;
      } else {
        arquivosCount++;
      }
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Teste de sincronização JWT executado com sucesso!',
      email,
      resultado: {
        totalArquivos: arquivos.length,
        pastas,
        arquivos: arquivosCount,
        tamanhoTotal: totalTamanho,
        tiposArquivos,
        primeirosArquivos: arquivos.slice(0, 5).map(f => ({
          nome: f.name,
          tipo: f.mimeType,
          tamanho: f.size,
          modificado: f.modifiedTime
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao testar sincronização JWT:', error);
    res.status(500).json({ 
      erro: 'Falha ao testar sincronização JWT', 
      detalhes: error.message 
    });
  }
};

// Processar mudança específica do Drive usando JWT
exports.processarMudancaDriveJWT = async (req, res) => {
  try {
    const { fileId, userEmail } = req.body;
    
    if (!fileId || !userEmail) {
      return res.status(400).json({ 
        erro: 'fileId e userEmail são obrigatórios' 
      });
    }

    console.log(`Processando mudança do Drive com JWT: ${fileId} para ${userEmail}`);

    const resultado = await driveServiceJWT.processarMudancaDriveJWT(fileId, userEmail);
    
    res.json({ 
      sucesso: true, 
      mensagem: 'Mudança do Drive processada com sucesso via JWT!',
      resultado 
    });
  } catch (error) {
    console.error('Erro ao processar mudança do Drive com JWT:', error);
    res.status(500).json({ 
      erro: 'Falha ao processar mudança do Drive com JWT', 
      detalhes: error.message 
    });
  }
}; 