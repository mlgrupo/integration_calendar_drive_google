const express = require('express');
const { google } = require('googleapis');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Configuração das credenciais da Service Account
const serviceAccountCredentials = {
  type: 'service_account',
  project_id: 'keen-clarity-458114-p7',
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
};

// Configuração do Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountCredentials,
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/admin.directory.user.readonly'
  ]
});

// Função para obter cliente autenticado para um usuário específico
function getGoogleClient(scopes, userEmail) {
  const authClient = new google.auth.GoogleAuth({
    credentials: serviceAccountCredentials,
    scopes: scopes
  });

  // Impersonation para o domínio
  if (userEmail && userEmail.endsWith('@reconectaoficial.com.br')) {
    authClient.subject = userEmail;
  }

  return authClient;
}

// Endpoint para sincronizar usuários do domínio
app.get('/api/users/sync', async (req, res) => {
  try {
    const adminClient = await getGoogleClient(
      ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      process.env.ADMIN_EMAIL
    );

    const admin = google.admin({ version: 'directory_v1', auth: adminClient });
    
    const response = await admin.users.list({
      customer: 'my_customer',
      maxResults: 500,
      orderBy: 'email'
    });

    const users = response.data.users || [];
    
    // Salvar usuários no banco
    for (const user of users) {
      await pool.query(`
        INSERT INTO usuarios (email, nome, sobrenome, ativo, data_criacao)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET
          nome = EXCLUDED.nome,
          sobrenome = EXCLUDED.sobrenome,
          ativo = EXCLUDED.ativo,
          data_atualizacao = NOW()
      `, [
        user.primaryEmail,
        user.name?.givenName || '',
        user.name?.familyName || '',
        user.suspended === false,
        new Date(user.creationTime)
      ]);
    }

    res.json({ 
      success: true, 
      message: `${users.length} usuários sincronizados`,
      users: users.length 
    });

  } catch (error) {
    console.error('Erro ao sincronizar usuários:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para sincronizar arquivos do Drive
app.get('/api/drive/sync', async (req, res) => {
  try {
    const driveClient = await getGoogleClient(
      ['https://www.googleapis.com/auth/drive'],
      process.env.ADMIN_EMAIL
    );

    const drive = google.drive({ version: 'v3', auth: driveClient });
    
    // Buscar arquivos
    const filesResponse = await drive.files.list({
      pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, owners, shared, webViewLink)',
      q: "trashed=false"
    });

    const files = filesResponse.data.files || [];
    
    // Salvar arquivos no banco
    for (const file of files) {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      
      if (isFolder) {
        await pool.query(`
          INSERT INTO drive_folders (folder_id, nome, usuario_id, data_criacao, data_modificacao, link)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (folder_id) DO UPDATE SET
            nome = EXCLUDED.nome,
            data_modificacao = EXCLUDED.data_modificacao,
            link = EXCLUDED.link
        `, [
          file.id,
          file.name,
          file.owners?.[0]?.emailAddress || process.env.ADMIN_EMAIL,
          new Date(file.createdTime),
          new Date(file.modifiedTime),
          file.webViewLink
        ]);
      } else {
        const extensao = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
        
        await pool.query(`
          INSERT INTO drive_files (file_id, nome, extensao, tamanho, usuario_id, pasta_id, data_criacao, data_modificacao, link, compartilhado)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (file_id) DO UPDATE SET
            nome = EXCLUDED.nome,
            extensao = EXCLUDED.extensao,
            tamanho = EXCLUDED.tamanho,
            data_modificacao = EXCLUDED.data_modificacao,
            link = EXCLUDED.link,
            compartilhado = EXCLUDED.compartilhado
        `, [
          file.id,
          file.name,
          extensao,
          parseInt(file.size) || 0,
          file.owners?.[0]?.emailAddress || process.env.ADMIN_EMAIL,
          file.parents?.[0] || null,
          new Date(file.createdTime),
          new Date(file.modifiedTime),
          file.webViewLink,
          file.shared || false
        ]);
      }
    }

    // Registrar log
    await pool.query(`
      INSERT INTO logs (tipo, descricao, detalhes, status)
      VALUES ($1, $2, $3, $4)
    `, [
      'SYNC_DRIVE',
      `Sincronização do Drive concluída`,
      JSON.stringify({ arquivos: files.length }),
      'SUCCESS'
    ]);

    res.json({ 
      success: true, 
      message: `${files.length} arquivos/pastas sincronizados`,
      files: files.length 
    });

  } catch (error) {
    console.error('Erro ao sincronizar Drive:', error);
    
    // Registrar log de erro
    try {
      await pool.query(`
        INSERT INTO logs (tipo, descricao, detalhes, status)
        VALUES ($1, $2, $3, $4)
      `, [
        'SYNC_DRIVE',
        'Erro na sincronização do Drive',
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]);
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para configurar webhook do Drive
app.post('/api/drive/webhook/config', async (req, res) => {
  try {
    const driveClient = await getGoogleClient(
      ['https://www.googleapis.com/auth/drive'],
      process.env.ADMIN_EMAIL
    );

    const drive = google.drive({ version: 'v3', auth: driveClient });
    
    // Obter startPageToken
    const startPageToken = await drive.changes.getStartPageToken();
    
    // Configurar webhook
    const webhookResponse = await drive.changes.watch({
      pageToken: startPageToken.data.startPageToken,
      body: {
        id: 'drive-webhook-' + Date.now(),
        type: 'web_hook',
        address: process.env.WEBHOOK_URL + '/drive',
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });

    // Salvar configuração do webhook
    await pool.query(`
      INSERT INTO webhooks (tipo, webhook_id, resource_id, expiration, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tipo) DO UPDATE SET
        webhook_id = EXCLUDED.webhook_id,
        resource_id = EXCLUDED.resource_id,
        expiration = EXCLUDED.expiration,
        status = EXCLUDED.status
    `, [
      'DRIVE',
      webhookResponse.data.id,
      webhookResponse.data.resourceId,
      new Date(webhookResponse.data.expiration),
      'ACTIVE'
    ]);

    res.json({ 
      success: true, 
      message: 'Webhook do Drive configurado com sucesso',
      webhook: webhookResponse.data
    });

  } catch (error) {
    console.error('Erro ao configurar webhook do Drive:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para receber webhook do Drive
app.post('/webhook/drive', async (req, res) => {
  try {
    console.log('Webhook do Drive recebido:', req.body);
    
    // Processar mudanças
    const changes = req.body.changes || [];
    
    for (const change of changes) {
      await pool.query(`
        INSERT INTO logs (tipo, descricao, detalhes, status)
        VALUES ($1, $2, $3, $4)
      `, [
        'WEBHOOK_DRIVE',
        'Mudança detectada no Drive',
        JSON.stringify(change),
        'INFO'
      ]);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro ao processar webhook do Drive:', error);
    res.status(500).send('Error');
  }
});

// Endpoint para renovar webhooks
app.post('/api/webhook/renew', async (req, res) => {
  try {
    // Renovar webhook do Drive
    const driveClient = await getGoogleClient(
      ['https://www.googleapis.com/auth/drive'],
      process.env.ADMIN_EMAIL
    );

    const drive = google.drive({ version: 'v3', auth: driveClient });
    
    const startPageToken = await drive.changes.getStartPageToken();
    
    const webhookResponse = await drive.changes.watch({
      pageToken: startPageToken.data.startPageToken,
      body: {
        id: 'drive-webhook-' + Date.now(),
        type: 'web_hook',
        address: process.env.WEBHOOK_URL + '/drive',
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000)
      }
    });

    await pool.query(`
      UPDATE webhooks 
      SET webhook_id = $1, resource_id = $2, expiration = $3, status = 'ACTIVE'
      WHERE tipo = 'DRIVE'
    `, [
      webhookResponse.data.id,
      webhookResponse.data.resourceId,
      new Date(webhookResponse.data.expiration)
    ]);

    res.json({ 
      success: true, 
      message: 'Webhooks renovados com sucesso'
    });

  } catch (error) {
    console.error('Erro ao renovar webhooks:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para verificar status dos webhooks
app.get('/api/webhook/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhooks ORDER BY tipo');
    
    res.json({ 
      success: true, 
      webhooks: result.rows 
    });

  } catch (error) {
    console.error('Erro ao verificar status dos webhooks:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para listar usuários
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios ORDER BY email');
    
    res.json({ 
      success: true, 
      users: result.rows 
    });

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para listar arquivos do Drive
app.get('/api/drive/files', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drive_files ORDER BY data_modificacao DESC LIMIT 100');
    
    res.json({ 
      success: true, 
      files: result.rows 
    });

  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para listar pastas do Drive
app.get('/api/drive/folders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drive_folders ORDER BY data_modificacao DESC LIMIT 100');
    
    res.json({ 
      success: true, 
      folders: result.rows 
    });

  } catch (error) {
    console.error('Erro ao listar pastas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 