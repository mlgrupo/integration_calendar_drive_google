const logModel = require('../models/logModel');

// Classes de erro customizadas
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404);
  }
}

// Middleware de tratamento de erros
const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  console.error('❌ ERRO:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Categorizar erros
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = new NotFoundError(message);
  }

  if (err.code === 11000) {
    const message = 'Dados duplicados';
    error = new ValidationError(message);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = new AuthenticationError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = new AuthenticationError(message);
  }

  // Log de auditoria para erros operacionais
  if (error.isOperational !== false) {
    try {
      await logModel.logAuditoria({
        usuario_id: req.user?.id || null,
        acao: 'error',
        recurso_tipo: 'system',
        recurso_id: req.originalUrl,
        detalhes: `Erro ${error.statusCode}: ${error.message}`,
        ip_origem: req.ip,
        user_agent: req.get('User-Agent'),
        timestamp_evento: new Date()
      });
    } catch (logError) {
      console.error('Erro ao registrar log de auditoria:', logError);
    }
  }

  // Resposta de erro
  const errorResponse = {
    sucesso: false,
    erro: error.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  };

  res.status(error.statusCode || 500).json(errorResponse);
};

// Middleware para capturar erros assíncronos
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware para erros não capturados
const unhandledRejectionHandler = (reason, promise) => {
  console.error('❌ PROMISE REJECTION:', reason);
  console.error('Promise:', promise);
};

const uncaughtExceptionHandler = (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  unhandledRejectionHandler,
  uncaughtExceptionHandler
}; 