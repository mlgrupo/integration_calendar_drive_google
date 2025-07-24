module.exports = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor', detalhes: err.message });
}; 