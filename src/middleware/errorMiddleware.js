const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.response?.status || 500;
  const message = err.response?.data?.message || err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode
    }
  });
};

module.exports = errorMiddleware;
