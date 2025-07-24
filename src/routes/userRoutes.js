const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Listagem e busca de usuários
router.get('/', userController.listarUsuarios);
router.get('/id/:id', userController.buscarUsuarioPorId);
router.get('/email/:email', userController.buscarUsuarioPorEmail);

// Adicionar usuário manualmente
router.post('/', userController.adicionarUsuario);

// Sincronização de usuários do Google Workspace
router.post('/sync-workspace', userController.buscarUsuariosWorkspace);

// Sincronização completa (usuários + Drive)
router.post('/sync-completa', userController.sincronizarCompleta);

module.exports = router; 