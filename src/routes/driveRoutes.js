const express = require('express');
const router = express.Router();
const driveController = require('../controllers/driveController');
const driveControllerJWT = require('../controllers/driveControllerJWT');

// Rotas originais (que não funcionavam)
router.post('/sync', driveController.syncDrive);
router.post('/webhook', driveController.configurarWebhookDrive);
router.post('/test-webhook', driveController.testarWebhookDrive);
router.get('/debug', driveController.debugDrive);
router.get('/test-autenticacao', driveController.testarAutenticacao);
router.get('/test-filemanager/:email', driveController.testDriveFileManager);
router.get('/test-queries/:email', driveController.testarQueries);
router.get('/test-admin-sdk/:email', driveController.testarAdminSDK);

// NOVAS ROTAS JWT (que funcionam!)
router.post('/sync-jwt', driveControllerJWT.syncDriveJWT);
router.get('/arquivos/:email', driveControllerJWT.listarArquivosUsuarioJWT);
router.get('/test-sync-jwt/:email', driveControllerJWT.testarSincronizacaoJWT);
router.post('/processar-mudanca-jwt', driveControllerJWT.processarMudancaDriveJWT);

module.exports = router; 