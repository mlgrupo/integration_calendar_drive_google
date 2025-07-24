const calendarService = require('../services/calendarService');
const logModel = require('../models/logModel');

// Sincronizar eventos do Calendar (REACTIVADO)
exports.syncCalendar = async (req, res) => {
  try {
    const resultado = await calendarService.syncCalendarEvents();
    res.json({
      sucesso: true,
      mensagem: 'Sincronização do Calendar realizada com sucesso',
      ...resultado
    });
  } catch (error) {
    console.error('Erro ao sincronizar Calendar:', error);
    res.status(500).json({
      erro: 'Erro ao sincronizar Calendar',
      detalhes: error.message
    });
  }
};

// Configurar webhook do Calendar para um usuário específico (REACTIVADO)
exports.configurarWebhookCalendar = async (req, res) => {
  try {
    const { email, webhookUrl } = req.body;

    if (!email || !webhookUrl) {
      return res.status(400).json({
        erro: 'Email e webhookUrl são obrigatórios'
      });
    }

    const resultado = await calendarService.configurarWatchCalendar(email, webhookUrl);
    res.json({
      sucesso: true,
      mensagem: 'Webhook do Calendar configurado com sucesso',
      resultado
    });
  } catch (error) {
    console.error('Erro ao configurar webhook do Calendar:', error);
    res.status(500).json({
      erro: 'Erro ao configurar webhook do Calendar',
      detalhes: error.message
    });
  }
}; 