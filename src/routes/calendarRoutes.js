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

// Configurar webhook do Calendar para todos os usuários
router.post('/configurar-webhook', calendarController.configurarWebhookCalendar);

// Testar webhook do Calendar
router.post('/testar-webhook', calendarController.testarWebhookCalendar);

// Rota para forçar sincronização manual do Calendar
router.post('/forcar-sincronizacao', calendarController.forcarSincronizacaoCalendar);

// Rota para limpar duplicatas do Calendar
router.post('/limpar-duplicatas', calendarController.limparDuplicatasCalendar);

// Rota para verificar estrutura da tabela Calendar
router.get('/verificar-estrutura', calendarController.verificarEstruturaCalendar);

// Rota para testar evento específico
router.post('/testar-evento-especifico', calendarController.testarEventoEspecifico);

module.exports = router; 