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

// Rota para verificar status dos webhooks
router.get('/verificar-webhooks', calendarController.verificarWebhooksCalendar);

// Rota para forçar configuração de webhooks
router.post('/forcar-configuracao-webhooks', calendarController.forcarConfiguracaoWebhooks);

// Rota para corrigir horários dos eventos existentes
router.post('/corrigir-horarios', calendarController.corrigirHorariosEventos);

// Rota para criar tabelas de webhook
router.post('/criar-tabelas-webhook', calendarController.criarTabelasWebhook);

// Rota para verificar estrutura da tabela logs
router.post('/verificar-estrutura-logs', calendarController.verificarEstruturaLogs);

// Rota para testar sincronização de eventos passados
router.post('/testar-eventos-passados', calendarController.testarEventosPassados);

// Rota para corrigir constraints do icaluid
router.post('/corrigir-constraints-icaluid', calendarController.corrigirConstraintsIcaluid);

// Rota para remover constraint problemática do icaluid
router.post('/remover-constraint-icaluid', calendarController.removerConstraintIcaluid);

// Rota para verificar e corrigir todas as constraints
router.post('/verificar-corrigir-constraints', calendarController.verificarECorrigirConstraints);

module.exports = router; 