const express = require('express');
const router = express.Router();
const driveController = require('../controllers/driveController');

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Sincronização geral do Drive (todos os usuários)
router.post('/sync', driveController.syncDrive);

// Sincronização do Drive por usuário
router.post('/sync/:email', driveController.syncDrivePorUsuario);

// Webhook do Drive
router.post('/webhook', driveController.webhookDrive);

module.exports = router; 