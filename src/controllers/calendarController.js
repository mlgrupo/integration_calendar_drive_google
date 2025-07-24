const calendarService = require('../services/calendarService');
const logModel = require('../models/logModel');

// Sincronizar eventos do Calendar (todos os usuários)
const syncCalendar = async (req, res) => {
  try {
    console.log('Sincronização de eventos do Calendar agendada (background)...');
    // Responde imediatamente
    res.status(202).json({ sucesso: true, mensagem: 'Sincronização de eventos do Calendar iniciada em background.' });
    // Roda o fluxo em background
    setImmediate(() => {
      calendarService.syncCalendarEvents((result) => {
        if (result?.error) {
          console.error('Erro na sincronização em background:', result.error);
        } else {
          console.log('Sincronização de eventos do Calendar finalizada:', result);
        }
      });
    });
  } catch (error) {
    console.error('Erro ao sincronizar Calendar:', error);
    res.status(500).json({
      erro: 'Erro ao sincronizar Calendar',
      detalhes: error.message
    });
  }
};

// Sincronizar eventos do Calendar para um usuário específico
const syncCalendarPorUsuario = async (req, res) => {
  try {
    const email = req.params.email;
    if (!email) {
      return res.status(400).json({ erro: 'Email é obrigatório.' });
    }
    const resultado = await calendarService.syncCalendarEventsPorUsuario(email);
    res.json({
      sucesso: true,
      mensagem: `Sincronização do Calendar para ${email} realizada com sucesso`,
      ...resultado
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao sincronizar Calendar para o usuário', detalhes: error.message });
  }
};

// Webhook do Calendar
const webhookCalendar = async (req, res) => {
  try {
    // Aqui você pode processar a notificação do Google Calendar
    // Exemplo: logar o body recebido
    console.log('Webhook do Calendar recebido:', req.body);
    res.status(200).json({ recebido: true });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao processar webhook do Calendar', detalhes: error.message });
  }
};

module.exports = {
  syncCalendar,
  syncCalendarPorUsuario,
  webhookCalendar
}; 