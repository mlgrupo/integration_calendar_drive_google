const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || 'acesso-completo-drive-gw@keen-clarity-458114-p7.iam.gserviceaccount.com';
const SERVICE_ACCOUNT_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n') || `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxrv199RakNvfX\nzKo3ZFd3AW4P/xe4NDL2MIkx3uP9LSLT0hRKBem7fC3byQEySubF3EL+1gKiyCG1\npC27u6BJKP8SF+u3ehArVyhSiOITIdGahHGJTV4ZqRp5WZxSbPCPh5ReN+rtZtUq\nKmXM6MNzZadvLF0U3ZUrl+UUBdhqR1Q3RnryMNtZYQSmkiiqQxcWGIlnx8mKlMe0\n1cUuzXFlyuFKhheHBBHmdXJzmDukh+yxxMifTKLYcmkA2AYEPu+g1NwuqCascQpc\nlGf43t4STLXNkrNjHAecsmZBq/RjuTodWDIq4YhIA0lRKfad/cYFhuHYfcdE6FjY\nn1PPraPjAgMBAAECggEABH4RKLMerG47W/hvwVDHKVoe50ai2eRv+WuGvH0PNKKE\ng+iG3MxDeZsNKcZuQlBEf3IvO3Q7wtPejlIlWd7HkbH4qQNz0ULDz+S3P0b4uFUd\nkJOSr08Gdw2gfrr2Sds5Rde+t5cgWHpGH3fM9R5ZerxyPExZ2iI0GFMR1qzDKQSz\n02DfiRd7Vsm2pCUl278gre6YnIUDV+2h0zLyHsj73NeVAowj1p3sIx9A7r8oBDbT\nMQhD3IQphNLb98k10VXzJupLktCHAJfTF/1BaXddDqA6yAaTGzeZ+WV0u4pHR2uA\naKu/2bXfflhNHUpEHz/gmF/J2INq7U6qeHN4Tu/Y+QKBgQDsxHNIAyxcef1LsAAm\nZtG2/8fKTJwwEwUwDqqth1d15aiFCt8hgjgQ5ugRaL5rtChvcjBHaOU8gzFAX3F/\n41muJ/WyIisxdNDjTGd4vagWd+d/1Q1D87SjnkvSU2+xFA4uyxgzEuNYA58PEeY9\n+dIUBifjBYnaKN9i0gznas2qlwKBgQDAHeYPjzoxlTkrd3Phrls3cgsjqkqsojSh\n3zZ5zPzB5n8UsmtroLhrv4fPCyVlvi+v8fPYYdBMEiUSl6PD/0BVRLzKZhSL/KKE\nt3DZzKElidHpw8h3WLzzrOowR/70uCQyErpG3QSlV20eCZh51hKw4JEsMwI578Ht\nWxcsNx62lQKBgQC7G1h7DT7uad0ZBiJoNpL+ik4J+dboSu+rlbud3LnqSq6NTRUe\nNvk1qjS1JVBubvYRdGzg0e1uj8LJO2PHjBRgA+Yver8lm0pEhimzCjYeY21H4UdV\nbu9O6hbDRPqcNtwqcIdUPVX6RQpa72tDiPxSpLa6urLA+9HlF1fpPccASwKBgFbj\n7u6wn+hXDoFbSH0VB8p++QzLc3S69EUWGKRkExl7r5Rj0fPewCpzePAqoWJv70+L\nhfci3jvZpQzQqs/1vVoTebOtEbPysmqGMTNAus2olNk+pIdeCi/H0C/AEE8Mjcpb\n8AYm5ngFn6OLQXwxV0jKeL5d367mgnZg0Y087NY1AoGBAKYswSewGPA1YVv7Xvza\nwhOpb/nC1lHyT/WeT/7Uwk74TPU+2n+U5IbjF/NuCFXUln9XPydrhR6Pxl6NYZ3f\nF/Y4PyDnG/p2NjYjLM4HUvVWFYgEcH4Mm77ebee7r+ZlRSjtScc5MWvT2Zhv3q5/\niba5vqfcC7w9+/BBJvX2dR/A\n-----END PRIVATE KEY-----`;
const USER_EMAIL = process.env.ADMIN_EMAIL || 'leorosso@reconectaoficial.com.br';

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Listar todos os usuários cadastrados no banco
router.get('/', userController.listarUsuarios);

// Endpoint para puxar e salvar usuários do domínio
router.post('/sync-workspace', async (req, res) => {
  try {
    console.log('Iniciando sync de usuários...');
    // Gerar token com escopo do Directory
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      sub: USER_EMAIL, // Precisa ser um admin do domínio
    };
    console.log('Payload JWT:', payload);
    const token = jwt.sign(payload, SERVICE_ACCOUNT_PRIVATE_KEY, { algorithm: 'RS256' });
    console.log('JWT gerado');
    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      },
      timeout: 30000
    });
    console.log('Access token recebido');
    const accessToken = response.data.access_token;

    // Buscar usuários do domínio (paginado)
    let pageToken = undefined;
    let allUsers = [];
    let pageCount = 0;
    do {
      pageCount++;
      console.log(`Buscando página ${pageCount} de usuários...`);
      const usersResp = await axios.get('https://admin.googleapis.com/admin/directory/v1/users', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          domain: 'reconectaoficial.com.br',
          maxResults: 500,
          orderBy: 'email',
          pageToken: pageToken
        },
        timeout: 30000
      });
      const users = usersResp.data.users || [];
      console.log(`Página ${pageCount} recebida, ${users.length} usuários.`);
      for (const user of users) {
        if (user.primaryEmail && user.primaryEmail.endsWith('@reconectaoficial.com.br')) {
          const nome = user.name ? user.name.fullName : null;
          await userModel.getOrCreateUsuario(user.primaryEmail, nome);
          allUsers.push({ email: user.primaryEmail, name: nome });
        }
      }
      pageToken = usersResp.data.nextPageToken;
    } while (pageToken);

    console.log(`Finalizado. Total de usuários salvos: ${allUsers.length}`);
    res.json({ sucesso: true, total: allUsers.length, usuarios: allUsers });
  } catch (error) {
    console.error('Erro no endpoint:', error.response?.data || error.message);
    res.status(500).json({ sucesso: false, erro: error.response?.data || error.message });
  }
});

module.exports = router; 