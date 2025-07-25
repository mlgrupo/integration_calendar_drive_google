require('dotenv').config({ path: './.env' });
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./src/routes');
const logger = require('./src/middlewares/logger');
const { errorHandler, unhandledRejectionHandler, uncaughtExceptionHandler } = require('./src/middlewares/errorHandler');
const { sanitizeInput } = require('./src/middlewares/validation');
const monitoringService = require('./src/services/monitoringService');
const { initScheduledJobs } = require('./src/jobs/renewWebhooks');

const app = express();

// Configurar handlers de erro não capturados
process.on('unhandledRejection', unhandledRejectionHandler);
process.on('uncaughtException', uncaughtExceptionHandler);

// Middlewares de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
  message: {
    sucesso: false,
    erro: 'Muitas requisições, tente novamente em 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Middlewares de parsing
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json' 
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}));

// Compressão
app.use(compression());

// Middlewares customizados
app.use(sanitizeInput);
app.use(logger);

// Middleware de monitoramento
app.use((req, res, next) => {
  const start = Date.now();
  monitoringService.incrementRequest();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitoringService.recordResponseTime(duration);
    
    if (res.statusCode >= 400) {
      monitoringService.incrementError();
    }
  });
  
  next();
});

// Rotas
app.use('/api', routes);

// Rota de health check
app.get('/health', async (req, res) => {
  try {
    const healthReport = await monitoringService.getHealthReport();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ...healthReport
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Rota de métricas (protegida em produção)
app.get('/metrics', (req, res) => {
  if (process.env.NODE_ENV === 'production' && req.headers.authorization !== `Bearer ${process.env.METRICS_TOKEN}`) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  
  res.json({
    sucesso: true,
    metrics: monitoringService.getStats()
  });
});

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    sucesso: false,
    erro: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Inicializar jobs agendados
initScheduledJobs();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
  console.log(`📈 Métricas: http://localhost:${PORT}/metrics`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 