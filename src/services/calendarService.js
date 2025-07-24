const { google } = require('googleapis');
const { getGoogleClient } = require('../config/google');
const userModel = require('../models/userModel');
const calendarEventModel = require('../models/calendarEventModel');
const logModel = require('../models/logModel');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const SERVICE_ACCOUNT_EMAIL = 'acesso-completo-drive-gw@keen-clarity-458114-p7.iam.gserviceaccount.com';
const SERVICE_ACCOUNT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxrv199RakNvfX\nzKo3ZFd3AW4P/xe4NDL2MIkx3uP9LSLT0hRKBem7fC3byQEySubF3EL+1gKiyCG1\npC27u6BJKP8SF+u3ehArVyhSiOITIdGahHGJTV4ZqRp5WZxSbPCPh5ReN+rtZtUq\nKmXM6MNzZadvLF0U3ZUrl+UUBdhqR1Q3RnryMNtZYQSmkiiqQxcWGIlnx8mKlMe0\n1cUuzXFlyuFKhheHBBHmdXJzmDukh+yxxMifTKLYcmkA2AYEPu+g1NwuqCascQpc\nlGf43t4STLXNkrNjHAecsmZBq/RjuTodWDIq4YhIA0lRKfad/cYFhuHYfcdE6FjY\nn1PPraPjAgMBAAECggEABH4RKLMerG47W/hvwVDHKVoe50ai2eRv+WuGvH0PNKKE\ng+iG3MxDeZsNKcZuQlBEf3IvO3Q7wtPejlIlWd7HkbH4qQNz0ULDz+S3P0b4uFUd\nkJOSr08Gdw2gfrr2Sds5Rde+t5cgWHpGH3fM9R5ZerxyPExZ2iI0GFMR1qzDKQSz\n02DfiRd7Vsm2pCUl278gre6YnIUDV+2h0zLyHsj73NeVAowj1p3sIx9A7r8oBDbT\nMQhD3IQphNLb98k10VXzJupLktCHAJfTF/1BaXddDqA6yAaTGzeZ+WV0u4pHR2uA\naKu/2bXfflhNHUpEHz/gmF/J2INq7U6qeHN4Tu/Y+QKBgQDsxHNIAyxcef1LsAAm\nZtG2/8fKTJwwEwUwDqqth1d15aiFCt8hgjgQ5ugRaL5rtChvcjBHaOU8gzFAX3F/\n41muJ/WyIisxdNDjTGd4vagWd+d/1Q1D87SjnkvSU2+xFA4uyxgzEuNYA58PEeY9\n+dIUBifjBYnaKN9i0gznas2qlwKBgQDAHeYPjzoxlTkrd3Phrls3cgsjqkqsojSh\n3zZ5zPzB5n8UsmtroLhrv4fPCyVlvi+v8fPYYdBMEiUSl6PD/0BVRLzKZhSL/KKE\nt3DZzKElidHpw8h3WLzzrOowR/70uCQyErpG3QSlV20eCZh51hKw4JEsMwI578Ht\nWxcsNx62lQKBgQC7G1h7DT7uad0ZBiJoNpL+ik4J+dboSu+rlbud3LnqSq6NTRUe\nNvk1qjS1JVBubvYRdGzg0e1uj8LJO2PHjBRgA+Yver8lm0pEhimzCjYeY21H4UdV\nbu9O6hbDRPqcNtwqcIdUPVX6RQpa72tDiPxSpLa6urLA+9HlF1fpPccASwKBgFbj\n7u6wn+hXDoFbSH0VB8p++QzLc3S69EUWGKRkExl7r5Rj0fPewCpzePAqoWJv70+L\nhfci3jvZpQzQqs/1vVoTebOtEbPysmqGMTNAus2olNk+pIdeCi/H0C/AEE8Mjcpb\n8AYm5ngFn6OLQXwxV0jKeL5d367mgnZg0Y087NY1AoGBAKYswSewGPA1YVv7Xvza\nwhOpb/nC1lHyT/WeT/7Uwk74TPU+2n+U5IbjF/NuCFXUln9XPydrhR6Pxl6NYZ3f\nF/Y4PyDnG/p2NjYjLM4HUvVWFYgEcH4Mm77ebee7r+ZlRSjtScc5MWvT2Zhv3q5/\niba5vqfcC7w9+/BBJvX2dR/A\n-----END PRIVATE KEY-----`;

// Sincronizar eventos do Calendar para todos os usuários do domínio
exports.syncCalendarEvents = async () => {
  try {
    let totalEventos = 0;
    let totalReunioes = 0;
    let totalUsuarios = 0;
    const usuarios = await userModel.getAllUsers();
    console.log(`👥 Encontrados ${usuarios.length} usuários cadastrados no banco.`);
    for (const usuario of usuarios) {
      try {
        console.log(`\n👤 Processando usuário: ${usuario.email} (${usuario.nome || ''})`);
        totalUsuarios++;
        // Gerar access token JWT manualmente
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          iss: SERVICE_ACCOUNT_EMAIL,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          aud: 'https://oauth2.googleapis.com/token',
          exp: now + 3600,
          iat: now,
          sub: usuario.email,
        };
        const token = jwt.sign(payload, SERVICE_ACCOUNT_PRIVATE_KEY, { algorithm: 'RS256' });
        const response = await axios.post('https://oauth2.googleapis.com/token', null, {
          params: {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token,
          },
        });
        const accessToken = response.data.access_token;
        // Buscar todos os calendários do usuário
        const calendarList = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        for (const calendar of calendarList.data.items) {
          let nextPageToken = undefined;
          do {
            const events = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: {
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime',
                showDeleted: true,
                showHiddenInvitations: true,
                alwaysIncludeEmail: true,
                pageToken: nextPageToken
              },
            });
            for (const evento of events.data.items) {
              const isReuniao = evento.conferenceData || evento.hangoutLink || (evento.summary && evento.summary.toLowerCase().match(/meeting|reunião|call|teams|skype|chamada|meet/)) || (evento.description && evento.description.toLowerCase().match(/meet|zoom|teams|skype|webex|jitsi|call/));
              const dataInicio = evento.start?.dateTime ? new Date(evento.start.dateTime) : (evento.start?.date ? new Date(evento.start.date + 'T00:00:00') : null);
              const dataFim = evento.end?.dateTime ? new Date(evento.end.dateTime) : (evento.end?.date ? new Date(evento.end.date + 'T23:59:59') : null);
              const duracaoMinutos = dataInicio && dataFim ? Math.round((dataFim - dataInicio) / (1000 * 60)) : null;
              const dadosEvento = {
                usuario_id: usuario.id,
                usuario_email: usuario.email,
                usuario_nome: usuario.nome || usuario.email,
                event_id: evento.id,
                titulo: evento.summary || (isReuniao ? 'Reunião sem título' : 'Evento sem título'),
                descricao: evento.description || null,
                localizacao: evento.location || null,
                data_inicio: dataInicio,
                data_fim: dataFim,
                duracao_minutos: duracaoMinutos,
                recorrente: !!evento.recurrence,
                recorrencia: evento.recurrence ? evento.recurrence.join(';') : null,
                calendario_id: calendar.id,
                calendario_nome: calendar.summary,
                status: evento.status || 'confirmed',
                visibilidade: evento.visibility || 'default',
                transparencia: evento.transparency || 'opaque',
                convidados: evento.attendees ? JSON.stringify(evento.attendees) : null,
                organizador_email: evento.organizer?.email || null,
                organizador_nome: evento.organizer?.displayName || null,
                criado_em: evento.created ? new Date(evento.created) : null,
                modificado_em: evento.updated ? new Date(evento.updated) : null,
                dados_completos: evento
              };
              await calendarEventModel.upsertEvent(dadosEvento);
              if (isReuniao) {
                totalReunioes++;
              } else {
                totalEventos++;
              }
              await logModel.logCalendarEvent({
                usuario_id: usuario.id,
                tipo_evento: 'sync',
                recurso_tipo: isReuniao ? 'meeting' : 'event',
                recurso_id: evento.id,
                detalhes: `Sincronização ${isReuniao ? 'reunião' : 'evento'} - ${usuario.email} - ${calendar.summary}`,
                dados_anteriores: null,
                dados_novos: evento,
                ip_origem: null,
                user_agent: 'jwt-manual-sync',
                timestamp_evento: new Date()
              });
            }
            nextPageToken = events.data.nextPageToken;
          } while (nextPageToken);
        }
      } catch (userError) {
        console.log(`   ❌ Erro ao processar usuário ${usuario.email}: ${userError.message}`);
        continue;
      }
    }
    console.log(`\n🎉 Sincronização concluída: Usuários: ${totalUsuarios}, Eventos: ${totalEventos}, Reuniões: ${totalReunioes}`);
    return { totalEventos, totalReunioes, totalUsuarios };
  } catch (error) {
    console.error('❌ Erro ao sincronizar eventos:', error);
    throw error;
  }
};

// Configurar webhook do Calendar
exports.configurarWatchCalendar = async (email, webhookUrl) => {
  try {
    const userAuth = await getGoogleClient(['https://www.googleapis.com/auth/calendar'], email);
    const calendar = google.calendar({ version: 'v3', auth: userAuth });

    // Configurar watch para o calendário principal
    const watchResponse = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: `calendar-watch-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
      }
    });

    return watchResponse.data;
  } catch (error) {
    console.error('Erro ao configurar watch do Calendar:', error);
    throw error;
  }
};