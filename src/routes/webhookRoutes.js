const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook do Drive (recebe notificações em tempo real)
router.post('/drive', webhookController.driveWebhook);

// Webhook do Calendar (temporariamente desativado)
router.post('/calendar', webhookController.calendarWebhook);

// Forçar renovação de webhooks
router.post('/renovar', webhookController.forcarRenovacao);

// Renovar webhooks para TODOS os usuários manualmente
router.post('/renovar-todos', webhookController.renovarWebhooksTodos);

// Verificar status dos webhooks
router.get('/status', webhookController.verificarStatus);

// Configurar webhook para um usuário específico
router.post('/configurar/:email', webhookController.configurarWebhookUsuario);

// Configurar webhooks para TODOS os usuários automaticamente
router.post('/configurar-todos', webhookController.configurarWebhooksTodos);

// Rota para diagnosticar Drive
router.post('/diagnosticar-drive', webhookController.diagnosticarDrive);

// Rota para forçar sincronização do Drive
router.post('/forcar-sync-drive', webhookController.forcarSyncDrive);

module.exports = router; 