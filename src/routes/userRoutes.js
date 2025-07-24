const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Listar todos os usuários cadastrados no banco
router.get('/', userController.listarUsuarios);

// Sincronizar todos os usuários do domínio Google Workspace para o banco
router.post('/sync-workspace', userController.buscarUsuariosWorkspace);

module.exports = router; 