module.exports = function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal Server Error' });
};
