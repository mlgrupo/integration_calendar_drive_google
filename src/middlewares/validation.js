const { body, param, query, validationResult } = require('express-validator');

// Middleware para validar resultados da validação
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Dados inválidos',
      detalhes: errors.array()
    });
  }
  next();
};

// Validações para usuários
const validateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('nome')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  validate
];

// Validações para webhooks
const validateWebhook = [
  body('webhookUrl')
    .optional()
    .isURL()
    .withMessage('URL do webhook inválida'),
  validate
];

// Validações para sincronização
const validateSync = [
  query('force')
    .optional()
    .isBoolean()
    .withMessage('Parâmetro force deve ser true ou false'),
  validate
];

// Validações para parâmetros de rota
const validateEmail = [
  param('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  validate
];

// Sanitização de entrada
const sanitizeInput = (req, res, next) => {
  // Sanitizar headers suspeitos
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-forwarded-proto'];
  suspiciousHeaders.forEach(header => {
    if (req.headers[header]) {
      delete req.headers[header];
    }
  });
  
  // Limitar tamanho do body
  if (req.body && JSON.stringify(req.body).length > 10000) {
    return res.status(413).json({
      sucesso: false,
      erro: 'Payload muito grande'
    });
  }
  
  next();
};

module.exports = {
  validateUser,
  validateWebhook,
  validateSync,
  validateEmail,
  sanitizeInput,
  validate
}; 