require('dotenv').config({ path: './.env' });
const express = require('express');
const app = express();
const routes = require('./src/routes');
const logger = require('./src/middlewares/logger');
const errorHandler = require('./src/middlewares/errorHandler');
const { initScheduledJobs } = require('./src/jobs/renewWebhooks');

// Middlewares para interpretar o body das requisições
app.use(express.json({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true }));

// Middlewares
app.use(express.json());
app.use(logger);

// Rotas
app.use('/api', routes);

// Middleware de tratamento de erros
app.use(errorHandler);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Inicializar jobs agendados
initScheduledJobs();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
}); 