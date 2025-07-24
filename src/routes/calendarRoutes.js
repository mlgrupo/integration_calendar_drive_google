const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Sincronização geral do Calendar (todos os usuários)
router.post('/sync', calendarController.syncCalendar);

// Sincronização do Calendar por usuário
router.post('/sync/:email', calendarController.syncCalendarPorUsuario);

// Webhook do Calendar
router.post('/webhook', calendarController.webhookCalendar);

module.exports = router; 